// background.js - Handles API calls and communication

// Constants
const GEMINI_MODEL = "gemini-1.5-flash-latest"; // Or "gemini-pro" etc.
const SUPADATA_API_BASE_URL = "https://api.supadata.ai/v1/youtube/transcript";
const API_KEYS_MISSING_ERROR = "API_KEYS_MISSING"; // Constant for error type

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script received message:", request.action);
    if (request.action === "getSummary") {
        console.log("Background script received getSummary request for URL:", request.url);

        // 1. Get API Keys and Language Preference from storage
        chrome.storage.sync.get(['geminiApiKey', 'supadataApiKey', 'summaryLanguage'], (items) => {
            const geminiApiKey = items.geminiApiKey;
            const supadataApiKey = items.supadataApiKey;
            const language = items.summaryLanguage || 'auto'; // Default to 'auto' if not set

            // 2. Validate Keys
            if (!geminiApiKey || !supadataApiKey || geminiApiKey.trim() === '' || supadataApiKey.trim() === '') {
                console.error("API Keys missing or invalid in storage.");
                sendResponse({ error: API_KEYS_MISSING_ERROR }); // Send specific error code
                return; // Stop processing
            }

            console.log("API Keys retrieved successfully.");

            // 3. Chain the API calls: Get transcript first, then summarize
            getTranscript(request.url, supadataApiKey) // Pass key
                .then(transcript => {
                    if (!transcript || transcript.trim().length === 0) {
                        throw new Error("Received empty or invalid transcript from Supadata.");
                    }
                    console.log("Transcript fetched successfully (length:", transcript.length,"). Calling Gemini API with language:", language);
                    return callGeminiAPI(transcript, geminiApiKey, language); // Pass transcript, key, and language
                })
                .then(summary => {
                    console.log("Sending summary back to content script.");
                    sendResponse({ summary: summary });
                })
                .catch(error => {
                    console.error("Error during summarization process:", error);
                    let errorMessage = "Failed to generate summary.";
                    // Check for specific error types if needed (e.g., distinguish Supadata vs Gemini errors)
                    if (error.message.includes("API key") || error.message.includes("API request failed")) {
                         errorMessage = error.message; // Use the specific error from the API call
                    } else if (error.message.includes("Supadata")) {
                        errorMessage = `Failed to fetch transcript: ${error.message}`;
                    } else if (error.message.includes("Gemini")) {
                        errorMessage = `Failed to fetch summary from Gemini: ${error.message}`;
                    } else {
                        errorMessage = error.message || errorMessage;
                    }
                    sendResponse({ error: errorMessage });
                });
        });

        return true; // Indicates that the response will be sent asynchronously
    }
    // Handle other potential actions if needed
});


// Function to get transcript from Supadata
async function getTranscript(videoUrl, supadataApiKey) { // Added apiKey parameter
    console.log("Calling Supadata API for URL:", videoUrl);
    const transcriptUrl = `${SUPADATA_API_BASE_URL}?url=${encodeURIComponent(videoUrl)}&text=true`;

    try {
        const response = await fetch(transcriptUrl, {
            method: 'GET',
            headers: {
                'x-api-key': supadataApiKey, // Use passed key
                'Accept': 'application/json'
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


// Function to summarize transcript text using Gemini API
async function callGeminiAPI(transcriptText, geminiApiKey, language) { // Added apiKey and language parameters
    console.log(`Calling Gemini API to summarize transcript (length: ${transcriptText.length}) in language: ${language}`);

    // Construct API URL dynamically
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    // Construct the prompt based on the selected language
    let languageInstruction = "";
    if (language === 'auto') {
        languageInstruction = "Generate the summary and highlights in the primary language used within the provided transcript.";
    } else {
        const languageMap = {
            'en': 'English',
            'ar': 'Arabic',
            'fr': 'French',
            'es': 'Spanish'
        };
        const targetLanguage = languageMap[language] || 'English'; // Default to English if somehow invalid
        languageInstruction = `Generate the summary and highlights **in ${targetLanguage}**.`;
    }

    const numbersAppearance = "Numbers should be written in normale numbers in all langues, e.g.,'1','151'. with english formatting.";

    const prompt = `Summarize the following video transcript into brief sentences of key points, then provide complete highlighted information in a list, choosing an appropriate emoji for each highlight.
${languageInstruction}.
${numbersAppearance}
Your output should use the following format:
### Summary
{brief summary of this content}
### Highlights
- [Emoji] Bullet point with complete explanation :\n\n---\n\n${transcriptText}`;
    console.log("Generated Gemini Prompt:", prompt); // Log the generated prompt for debugging

    try {
        // Limit transcript size if necessary
        const MAX_INPUT_LENGTH = 30000; // Example limit
        if (transcriptText.length > MAX_INPUT_LENGTH) {
            console.warn(`Transcript length (${transcriptText.length}) exceeds limit (${MAX_INPUT_LENGTH}). Truncating.`);
            transcriptText = transcriptText.substring(0, MAX_INPUT_LENGTH);
        }

        const response = await fetch(geminiApiUrl, { // Use dynamic URL
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
