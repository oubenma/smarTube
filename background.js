// IMPORTANT: Replace with your actual Gemini API Key
// **NEVER** commit or share keys publicly.
// Consider using chrome.storage or an options page for users to enter their keys.
const GEMINI_API_KEY = "AIzaSyBePCsxeJ2JaUvKf41fgxmY1ezgtJe9ZGQ"; // <<<--- PASTE YOUR GEMINI KEY HERE
const SUPADATA_API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6IjEifQ.eyJpc3MiOiJuYWRsZXMiLCJpYXQiOiIxNzQ1MzY1MTkyIiwicHVycG9zZSI6ImFwaV9hdXRoZW50aWNhdGlvbiIsInN1YiI6ImMzYTY2NGRkOTMyNzQwOTJiZGE5MWJkODRlZjk2MWJmIn0.dyEsUYsh33NBxxg-bMpDXzhWD8umI8KRhGUru2Pmb_4"; // <<<--- PASTE YOUR SUPADATA KEY HERE

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
// Note: Switched back to gemini-1.5-flash-latest as per context.md
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
const SUPADATA_API_BASE_URL = "https://api.supadata.ai/v1/youtube/transcript";


// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script received message:", request.action); // Log action
    if (request.action === "getSummary") {
        console.log("Background script received getSummary request for URL:", request.url);

        // Basic key validation
        if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith("AIzaSy") === false) {
             console.error("Gemini API Key not set correctly in background.js");
             sendResponse({ error: "Gemini API Key is missing or invalid. Please configure it." });
             return true;
        }
        if (!SUPADATA_API_KEY || SUPADATA_API_KEY.length < 20) {
             console.error("Supadata API Key not set correctly in background.js");
             sendResponse({ error: "Supadata API Key is missing or invalid. Please configure it." });
             return true;
        }

        // Chain the API calls: Get transcript first, then summarize
        getTranscript(request.url)
            .then(transcript => {
                if (!transcript || transcript.trim().length === 0) {
                    // Handle cases where transcript is empty or couldn't be fetched properly
                    throw new Error("Received empty or invalid transcript from Supadata.");
                }
                console.log("Transcript fetched successfully (length:", transcript.length,"). Calling Gemini API...");
                return callGeminiAPI(transcript); // Pass transcript to Gemini
            })
            .then(summary => {
                console.log("Sending summary back to content script.");
                sendResponse({ summary: summary });
            })
            .catch(error => {
                console.error("Error during summarization process:", error);
                // Send a more specific error message if possible
                let errorMessage = "Failed to generate summary.";
                if (error.message.includes("Supadata")) {
                    errorMessage = `Failed to fetch transcript: ${error.message}`;
                } else if (error.message.includes("Gemini")) {
                    errorMessage = `Failed to fetch summary from Gemini: ${error.message}`;
                } else {
                    errorMessage = error.message || errorMessage;
                }
                sendResponse({ error: errorMessage });
            });

        return true; // Indicates that the response will be sent asynchronously
    }
    // Handle other potential actions if needed
});


// New function to get transcript from Supadata
async function getTranscript(videoUrl) {
    console.log("Calling Supadata API for URL:", videoUrl);
    const transcriptUrl = `${SUPADATA_API_BASE_URL}?url=${encodeURIComponent(videoUrl)}&text=true`;

    try {
        const response = await fetch(transcriptUrl, {
            method: 'GET',
            headers: {
                'x-api-key': SUPADATA_API_KEY,
                'Accept': 'application/json' // Explicitly ask for JSON
            }
        });

        if (!response.ok) {
            let errorBody = {};
            try {
                 errorBody = await response.json();
            } catch (e) { /* Ignore if response is not JSON */ }
            console.error("Supadata API Error Response:", response.status, response.statusText, errorBody);
            // Provide more specific error messages based on status code if possible
            let detail = errorBody?.message || '';
            if (response.status === 401 || response.status === 403) {
                detail = "Invalid Supadata API Key.";
            } else if (response.status === 404) {
                 detail = "Transcript not found for this video.";
            } else if (response.status === 429) {
                 detail = "Supadata API rate limit exceeded.";
            }
            throw new Error(`Supadata API request failed (${response.status}): ${detail || response.statusText}`);
        }

        const data = await response.json();
        // console.log("Supadata API Raw Response:", data); // Optional: Log raw response for debugging

        if (data && typeof data.content === 'string') { // Check if content exists and is a string
            console.log("Transcript content length:", data.content.length);
            if (data.content.trim().length === 0) {
                console.warn("Supadata returned an empty transcript string.");
                // Decide if empty transcript is an error or just means no subtitles
                // For now, let's treat it as potentially valid but log a warning.
                // throw new Error("Supadata returned an empty transcript.");
            }
            return data.content; // Return the transcript text
        } else {
            console.error("Unexpected Supadata API response structure or missing content:", data);
            throw new Error("Could not extract transcript content from Supadata API response.");
        }

    } catch (error) {
        console.error('Error during fetch to Supadata API:', error);
        // Ensure the error message clearly indicates it's from Supadata
        throw new Error(`Supadata API Error: ${error.message}`);
    }
}


// Modified function to summarize transcript text
async function callGeminiAPI(transcriptText) { // Parameter changed from videoUrl
    console.log("Calling Gemini API to summarize transcript (length:", transcriptText.length, ")"); // Updated log

    // Updated prompt to summarize the provided text
    // const prompt = `Please provide a detailed summary of the following video transcript. Focus on the key topics, main points, and any significant conclusions or information presented:\n\n---\n\n${transcriptText}\n\n---\n\nSummary:`;
    const prompt = `Summarize the following video transcript into brief sentences of key points, then provide complete highlighted information in a list, choosing an appropriate emoji for each highlight.
Your output should use the following format: 
### Summary
{brief summary of this content}
### Highlights
- [Emoji] Bullet point with complete explanation :\n\n---\n\n${transcriptText}`;

    // var prompt = `give me list of 5 big cities in japan`; // Keep example commented out
    try {
        // Limit transcript size if necessary (Gemini has input token limits)
        // This is a basic example; more sophisticated truncation might be needed.
        const MAX_INPUT_LENGTH = 30000; // Adjust as needed based on Gemini model limits
        if (transcriptText.length > MAX_INPUT_LENGTH) {
            console.warn(`Transcript length (${transcriptText.length}) exceeds limit (${MAX_INPUT_LENGTH}). Truncating.`);
            transcriptText = transcriptText.substring(0, MAX_INPUT_LENGTH);
        }

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // Structure according to the Gemini API documentation
                "contents": [{
                    "parts": [{
                        "text": prompt
                    }]
                }],
                // Optional: Add generation config if needed (temperature, max tokens etc)
                 "generationConfig": {
                     "temperature": 0.7, // Adjust creativity vs factualness
                     "maxOutputTokens": 8192, // Max length of the summary
                 },
                 // Optional: Safety Settings
                 // "safetySettings": [ ... ]
            })
        });

        if (!response.ok) {
            // Try to get error details from the response body
            let errorBody = {};
            try {
                 errorBody = await response.json();
            } catch (e) { /* Ignore if response is not JSON */ }

            console.error("Gemini API Error Response:", response.status, response.statusText, errorBody);
            // Provide more specific error messages
            let detail = errorBody?.error?.message || '';
             if (response.status === 400 && detail.includes("API key not valid")) {
                 detail = "Invalid Gemini API Key.";
             } else if (response.status === 429) {
                 detail = "Gemini API rate limit exceeded or quota finished.";
             } else if (response.status >= 500) {
                 detail = "Gemini server error.";
             }
            throw new Error(`Gemini API request failed (${response.status}): ${detail || response.statusText}`);
        }

        const data = await response.json();
        console.log("Gemini API Raw Response:", data);

        // Extract the text from the response - structure depends on the Gemini API version/model
        // Check the actual API response structure to confirm the path
        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0)
        {
            return data.candidates[0].content.parts[0].text;
        } else if (data.error) {
            // Handle explicit errors returned in the JSON body
             throw new Error(`Gemini API Error: ${data.error.message}`);
        }
        else {
             console.error("Unexpected Gemini API response structure:", data);
            throw new Error("Could not extract summary text from Gemini API response.");
        }

    } catch (error) {
        console.error('Error during fetch to Gemini API:', error);
        // Ensure the error message clearly indicates it's from Gemini
        throw new Error(`Gemini API Error: ${error.message}`);
    }
}

console.log("Background service worker started.");
