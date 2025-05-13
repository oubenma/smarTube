// background.js - Handles API calls and communication

// Constants
const GEMINI_MODEL = "gemini-1.5-flash-latest"; // Or "gemini-pro" etc.
const SUPADATA_API_BASE_URL = "https://api.supadata.ai/v1/youtube/transcript";
const API_KEYS_MISSING_ERROR = "API_KEYS_MISSING"; // Constant for error type

// Listen for messages from the content script
console.log("SmarTube background service worker started.");

// Listen for messages from the content script
console.log("SmarTube background service worker started.");

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script received message:", request.action);

    if (request.action === "getSummary") {
        console.log("Background script received getSummary request for URL:", request.url);

        // 1. Get Gemini API Key and Language Preference from storage
        chrome.storage.sync.get(['geminiApiKey', 'summaryLanguage'], (items) => {
            const geminiApiKey = items.geminiApiKey;
            const language = items.summaryLanguage || 'auto';

            if (!geminiApiKey || geminiApiKey.trim() === '') {
                console.error("Gemini API Key missing or invalid in storage.");
                sendResponse({ error: API_KEYS_MISSING_ERROR });
                return;
            }
            console.log("Gemini API Key retrieved successfully.");

            // 2. Get transcript using the new recursive function, then summarize
            tryGetTranscriptRecursive(request.url)
                .then(transcript => {
                    if (!transcript || transcript.trim().length === 0) {
                        throw new Error("Received empty or invalid transcript from Supadata.");
                    }
                    console.log("Transcript fetched successfully (length:", transcript.length,"). Calling Gemini API with language:", language);
                    return callGeminiAPI(transcript, geminiApiKey, language);
                })
                .then(summary => {
                    console.log("Sending summary back to content script.");
                    sendResponse({ summary: summary });
                })
                .catch(error => {
                    console.error("Error during summarization process:", error);
                    let errorMessage = "Failed to generate summary.";
                    if (error.message === API_KEYS_MISSING_ERROR || error.message.includes("All Supadata API keys")) {
                        errorMessage = error.message; // Use specific error
                    } else if (error.message.includes("API key") || error.message.includes("API request failed")) {
                         errorMessage = error.message;
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
        return true; // Asynchronous response

    } else if (request.action === "openOptionsPage") {
        console.log("Background script received openOptionsPage request.");
        chrome.runtime.openOptionsPage();
    } else if (request.action === "askQuestion") {
        console.log("Background script received askQuestion request:", request.question, "for URL:", request.url);

        chrome.storage.sync.get(['geminiApiKey'], (items) => {
            const geminiApiKey = items.geminiApiKey;

            if (!geminiApiKey || geminiApiKey.trim() === '') {
                console.error("Gemini API Key missing or invalid for Q&A.");
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: "answerResponse", error: API_KEYS_MISSING_ERROR });
                    }
                });
                return;
            }
            console.log("Gemini API Key retrieved for Q&A.");

            tryGetTranscriptRecursive(request.url)
                .then(transcript => {
                    if (!transcript || transcript.trim().length === 0) {
                        throw new Error("Cannot answer question: Transcript is empty or invalid.");
                    }
                    console.log("Transcript fetched for Q&A. Calling Gemini for question.");
                    return callGeminiForQuestion(transcript, request.question, geminiApiKey);
                })
                .then(answer => {
                    console.log("Sending answer back to content script.");
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]?.id) {
                            chrome.tabs.sendMessage(tabs[0].id, { action: "answerResponse", answer: answer });
                        }
                    });
                })
                .catch(error => {
                    console.error("Error during Q&A process:", error);
                    let errorMessage = `Failed to get answer: ${error.message || "Unknown error"}`;
                     if (error.message === API_KEYS_MISSING_ERROR || error.message.includes("All Supadata API keys")) {
                        errorMessage = error.message; // Use specific error
                    }
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]?.id) {
                            chrome.tabs.sendMessage(tabs[0].id, { action: "answerResponse", error: errorMessage });
                        }
                    });
                });
        });
        sendResponse({ status: "Question received, processing..." }); // Acknowledge receipt
        return true; // Asynchronous response
    }
});

// --- Supadata API Key Management and Transcript Fetching ---

async function tryGetTranscriptRecursive(videoUrl, attemptCycle = 0, triedKeyIds = new Set()) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['supadataApiKeys', 'activeSupadataKeyId'], async (storageItems) => {
            let { supadataApiKeys, activeSupadataKeyId } = storageItems;

            if (!supadataApiKeys || supadataApiKeys.length === 0) {
                console.error("No Supadata API keys configured.");
                return reject(new Error(API_KEYS_MISSING_ERROR));
            }

            let activeKeyObj = null;
            if (activeSupadataKeyId) {
                activeKeyObj = supadataApiKeys.find(k => k.id === activeSupadataKeyId);
            }

            // If no active key ID or the active key object is not found, try to find the first non-rate-limited key
            if (!activeKeyObj || activeKeyObj.isRateLimited) {
                const firstAvailableKey = supadataApiKeys.find(k => !k.isRateLimited && !triedKeyIds.has(k.id));
                if (firstAvailableKey) {
                    activeKeyObj = firstAvailableKey;
                    activeSupadataKeyId = firstAvailableKey.id;
                    // Update storage with the new active key
                    await chrome.storage.sync.set({ activeSupadataKeyId: activeSupadataKeyId });
                    console.log(`Switched to available Supadata key: ${activeKeyObj.name || activeKeyObj.id}`);
                } else {
                     // If all keys have been tried in this cycle or are marked rate limited
                    if (triedKeyIds.size >= supadataApiKeys.length || supadataApiKeys.every(k => k.isRateLimited)) {
                        console.error("All Supadata API keys are currently rate-limited or have been tried unsuccessfully in this cycle.");
                        return reject(new Error("All Supadata API keys are currently rate-limited. Please try again later or check your keys in options."));
                    }
                    // This case should ideally be caught by the loop below if no key is initially active/valid
                }
            }
            
            if (!activeKeyObj) { // Should not happen if there are keys, but as a safeguard
                 console.error("Could not determine an active Supadata API key.");
                 return reject(new Error(API_KEYS_MISSING_ERROR));
            }

            // Add current key to tried set for this user action cycle
            triedKeyIds.add(activeKeyObj.id);

            console.log(`Attempting Supadata API call with key: ${activeKeyObj.name || activeKeyObj.id} (Attempt: ${attemptCycle + 1})`);
            const transcriptUrl = `${SUPADATA_API_BASE_URL}?url=${encodeURIComponent(videoUrl)}&text=true`;

            try {
                const response = await fetch(transcriptUrl, {
                    method: 'GET',
                    headers: { 'x-api-key': activeKeyObj.key, 'Accept': 'application/json' }
                });

                if (!response.ok) {
                    let errorBody = {};
                    try { errorBody = await response.json(); } catch (e) { /* Ignore */ }
                    const errorDetail = errorBody?.message || response.statusText;
                    console.error(`Supadata API Error (${response.status}) with key ${activeKeyObj.id}: ${errorDetail}`);

                    if (response.status === 429 || response.status === 401 || response.status === 403) { // Rate limit or invalid key
                        // Mark current key as rate-limited
                        const keyIndex = supadataApiKeys.findIndex(k => k.id === activeKeyObj.id);
                        if (keyIndex !== -1) {
                            supadataApiKeys[keyIndex].isRateLimited = true;
                        }
                        
                        // Find next available key that hasn't been tried in this cycle
                        let nextKeyToTry = null;
                        let nextKeyId = null;
                        for (let i = 0; i < supadataApiKeys.length; i++) {
                            const potentialNextKey = supadataApiKeys[(keyIndex + 1 + i) % supadataApiKeys.length];
                            if (!potentialNextKey.isRateLimited && !triedKeyIds.has(potentialNextKey.id)) {
                                nextKeyToTry = potentialNextKey;
                                break;
                            }
                        }

                        await chrome.storage.sync.set({ supadataApiKeys: [...supadataApiKeys], activeSupadataKeyId: nextKeyToTry ? nextKeyToTry.id : activeSupadataKeyId });


                        if (nextKeyToTry && attemptCycle < supadataApiKeys.length -1) { // Check attemptCycle against total keys
                            console.log(`Key ${activeKeyObj.id} failed. Trying next available key: ${nextKeyToTry.id}`);
                            // Recursive call with incremented attemptCycle and updated triedKeyIds
                            tryGetTranscriptRecursive(videoUrl, attemptCycle + 1, triedKeyIds)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            console.error("All Supadata API keys have been tried or are rate-limited in this cycle.");
                            reject(new Error("All Supadata API keys are currently rate-limited or invalid. Please check your keys in options or try again later."));
                        }
                    } else { // Other non-retryable Supadata errors
                        throw new Error(`Supadata API request failed (${response.status}): ${errorDetail}`);
                    }
                    return; // Important: stop processing for this attempt
                }

                const data = await response.json();
                if (data && typeof data.content === 'string') {
                    console.log(`Transcript fetched successfully with key: ${activeKeyObj.id}`);
                    // If successful, reset its rate-limited status (optimistic)
                    const keyIndex = supadataApiKeys.findIndex(k => k.id === activeKeyObj.id);
                    if (keyIndex !== -1 && supadataApiKeys[keyIndex].isRateLimited) {
                        supadataApiKeys[keyIndex].isRateLimited = false;
                        await chrome.storage.sync.set({ supadataApiKeys: [...supadataApiKeys] });
                    }
                    resolve(data.content);
                } else {
                    throw new Error("Could not extract transcript content from Supadata API response.");
                }

            } catch (error) {
                console.error('Error during fetch to Supadata API:', error);
                // If it's a network error or similar, and we haven't exhausted keys, we might still want to try another key.
                // For simplicity now, any catch here that isn't a handled API error might just reject.
                // Consider if more sophisticated retry for network errors is needed.
                // For now, let's assume this error means this key attempt failed, try to cycle if possible.
                
                // Mark current key as potentially problematic (similar to rate limit for cycling)
                const keyIndex = supadataApiKeys.findIndex(k => k.id === activeKeyObj.id);
                 if (keyIndex !== -1 && !supadataApiKeys[keyIndex].isRateLimited) { // Avoid overwriting if already marked by API error
                    supadataApiKeys[keyIndex].isRateLimited = true; // Or a different flag like 'genericError'
                }

                let nextKeyToTry = null;
                for (let i = 0; i < supadataApiKeys.length; i++) {
                    const potentialNextKey = supadataApiKeys[(keyIndex + 1 + i) % supadataApiKeys.length];
                    if (!potentialNextKey.isRateLimited && !triedKeyIds.has(potentialNextKey.id)) {
                        nextKeyToTry = potentialNextKey;
                        break;
                    }
                }
                
                await chrome.storage.sync.set({ supadataApiKeys: [...supadataApiKeys], activeSupadataKeyId: nextKeyToTry ? nextKeyToTry.id : activeSupadataKeyId });

                if (nextKeyToTry && attemptCycle < supadataApiKeys.length -1) {
                     console.warn(`Fetch error with key ${activeKeyObj.id}. Trying next. Error: ${error.message}`);
                     tryGetTranscriptRecursive(videoUrl, attemptCycle + 1, triedKeyIds)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new Error(`Supadata API Error: ${error.message} (after trying available keys)`));
                }
            }
        });
    });
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
        const MAX_INPUT_LENGTH = 300000;
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


// Function to ask a question about the transcript using Gemini API
async function callGeminiForQuestion(transcriptText, question, geminiApiKey) {
    console.log(`Calling Gemini API to answer question: "${question}"`);

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    // Limit transcript size if necessary (apply same limit as summarization)
    const MAX_INPUT_LENGTH = 300000;
    if (transcriptText.length > MAX_INPUT_LENGTH) {
        console.warn(`Transcript length (${transcriptText.length}) exceeds limit (${MAX_INPUT_LENGTH}) for Q&A. Truncating.`);
        transcriptText = transcriptText.substring(0, MAX_INPUT_LENGTH);
    }

    // Construct the prompt for Q&A
    const prompt = `Based **only** on the following video transcript, answer the user's question. If the answer cannot be found in the transcript, say so.
Do not use any external knowledge.

Transcript:
---
${transcriptText}
---

User Question: ${question}

Answer:`;

    console.log("Generated Gemini Q&A Prompt:", prompt);

    try {
        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "contents": [{
                    "parts": [{
                        "text": prompt
                    }]
                }],
                 "generationConfig": {
                     "temperature": 0.5, // Lower temperature for more factual Q&A
                     "maxOutputTokens": 2048, // Adjust as needed
                 },
                 // Consider stricter safety settings for Q&A if needed
                 // "safetySettings": [ ... ]
            })
        });

        if (!response.ok) {
            let errorBody = {};
            try { errorBody = await response.json(); } catch (e) { /* Ignore */ }
            console.error("Gemini API Q&A Error Response:", response.status, response.statusText, errorBody);
            let detail = errorBody?.error?.message || '';
             if (response.status === 400 && detail.includes("API key not valid")) { detail = "Invalid Gemini API Key."; }
             else if (response.status === 429) { detail = "Gemini API rate limit exceeded or quota finished."; }
             else if (response.status >= 500) { detail = "Gemini server error."; }
            throw new Error(`Gemini API Q&A request failed (${response.status}): ${detail || response.statusText}`);
        }

        const data = await response.json();
        console.log("Gemini API Q&A Raw Response:", data);

        // Extract the answer text
        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0)
        {
            // Check for safety ratings / finish reason if needed
            // if (data.candidates[0].finishReason !== 'STOP') { ... }
            return data.candidates[0].content.parts[0].text;
        } else if (data.error) {
             throw new Error(`Gemini API Q&A Error: ${data.error.message}`);
        } else {
             console.error("Unexpected Gemini API Q&A response structure:", data);
            throw new Error("Could not extract answer text from Gemini API response.");
        }

    } catch (error) {
        console.error('Error during fetch to Gemini API for Q&A:', error);
        throw new Error(`Gemini API Q&A Error: ${error.message}`);
    }
}
