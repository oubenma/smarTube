require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPADATA_API_KEYS = (process.env.SUPADATA_API_KEYS || '').split(',').filter(k => k.trim());
let currentSupaKeyIndex = 0;

// Helper to extract video ID from YouTube URL
const getYouTubeVideoId = (url) => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        if (urlObj.hostname.includes('youtube.com')) {
            return urlObj.searchParams.get('v');
        }
        return null;
    } catch (error) {
        return null;
    }
};

// Helper to get transcript from Supadata
const getTranscript = async (videoId) => {
    if (!SUPADATA_API_KEYS || SUPADATA_API_KEYS.length === 0) {
        throw new Error('Supadata API key not found.');
    }

    let error = null;
    for (let i = 0; i < SUPADATA_API_KEYS.length; i++) {
        const keyIndex = (currentSupaKeyIndex + i) % SUPADATA_API_KEYS.length;
        const apiKey = SUPADATA_API_KEYS[keyIndex];
        try {
            const response = await axios.get(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`, {
                headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            });
            if (response.data && response.data.transcript) {
                 // Update the current key index to use this key for the next initial request
                currentSupaKeyIndex = keyIndex;
                return response.data.transcript.map(t => t.text).join(' ');
            }
        } catch (err) {
            console.error(`Error with Supadata API key index ${keyIndex}:`, err.response ? err.response.data : err.message);
            error = err.response ? err.response.data : { message: 'An unknown error occurred' };
             if (err.response && (err.response.status === 429 || err.response.status === 401)) {
                // Rate limited or unauthorized, try next key
                continue;
            }
            break; // Don't cycle for other errors like "video not found"
        }
    }
    // If all keys failed
    throw new Error(error?.message || 'Failed to fetch transcript from all available Supadata keys.');
};


app.post('/api/summarize', async (req, res) => {
    const { youtubeUrl } = req.body;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured on the server.' });
    }
    if (!youtubeUrl) {
        return res.status(400).json({ error: 'YouTube URL is required.' });
    }

    const videoId = getYouTubeVideoId(youtubeUrl);
    if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

    try {
        const transcript = await getTranscript(videoId);
        if (!transcript) {
            return res.status(500).json({ error: 'Could not retrieve video transcript.' });
        }

        const prompt = `Based on the following transcript, please provide a concise, easy-to-read summary of the video. The summary should be well-structured, using markdown for formatting (like headings, bold text, and bullet points) to highlight the key points and main ideas. Do not add any introductory or concluding phrases like "This video is about..." or "In conclusion...". Just provide the summary directly.\n\nTranscript:\n${transcript}`;

        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] }
        );

        const summary = geminiResponse.data.candidates[0].content.parts[0].text;
        res.json({ summary });

    } catch (error) {
        console.error('Error in /api/summarize:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
});

app.post('/api/ask', async (req, res) => {
    const { youtubeUrl, question } = req.body;

     if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured on the server.' });
    }
    if (!youtubeUrl || !question) {
        return res.status(400).json({ error: 'YouTube URL and question are required.' });
    }

    const videoId = getYouTubeVideoId(youtubeUrl);
    if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

    try {
        const transcript = await getTranscript(videoId);
        if (!transcript) {
            return res.status(500).json({ error: 'Could not retrieve video transcript.' });
        }

        const prompt = `You are a helpful assistant. Based *only* on the provided video transcript, answer the user's question. If the answer is not present in the transcript, say "I couldn't find an answer to that in the video." Do not use any external knowledge.\n\nTranscript:\n${transcript}\n\nQuestion: ${question}`;

        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] }
        );

        const answer = geminiResponse.data.candidates[0].content.parts[0].text;
        res.json({ answer });

    } catch (error) {
        console.error('Error in /api/ask:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
