// IMPORTANT: Replace with your actual Gemini API Key
// **NEVER** commit or share this key publicly.
// Consider using chrome.storage or an options page for users to enter their key.
const GEMINI_API_KEY = "AIzaSyBePCsxeJ2JaUvKf41fgxmY1ezgtJe9ZGQ"; // <<<--- PASTE YOUR KEY HERE

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
// Using gemini-1.5-flash - it's faster and cheaper, often sufficient for summarization.
// You could use "gemini-pro" instead:
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;


// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script received ");
    if (request.action === "getSummary") {
        console.log("Background script received request for URL:", request.url);

        if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
             console.error("API Key not set in background.js");
             sendResponse({ error: "API Key is missing. Please configure it in the extension's background script." });
             return true; // Keep the message channel open for asynchronous response
        }

        // Call the Gemini API asynchronously
        callGeminiAPI(request.url)
            .then(summary => {
                console.log("Sending summary back to content script.");
                sendResponse({ summary: summary });
            })
            .catch(error => {
                console.error("Error calling Gemini API:", error);
                sendResponse({ error: error.message || "Failed to fetch summary from Gemini API." });
            });

        return true; // Indicates that the response will be sent asynchronously
    }
    // Handle other potential actions if needed
    // return false; // Use if response is sent synchronously or not at all
});

async function callGeminiAPI(videoUrl) {
    console.log("Calling Gemini API for URL:", videoUrl);
    // TODO:  solve problem with the URL later
    const prompt = `Please provide a detailed summary of the YouTube video found at this URL: ${videoUrl}. Focus on the key topics, main points, and any significant conclusions or information presented.`;
    
    // var prompt = `give me list of 5 big cities in japan`;
    try {
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
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}. ${errorBody?.error?.message || ''}`);
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
        // Re-throw the error so the calling function (in the message listener) can catch it
        throw error;
    }
}

console.log("Background service worker started.");