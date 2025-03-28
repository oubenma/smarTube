Okay, let's create this YouTube Summarizer Chrome Extension using the Gemini API.

**Important Security Note:** Handling API keys directly in client-side code (like a Chrome extension's content or background script) is risky. For a production-level extension, you'd ideally use `chrome.storage.sync` to let the user input their key via an options page, or proxy the request through your own secure backend server. For this example, we'll put the API key in the background script with a strong warning. **Do not publish an extension with your API key hardcoded.**

**Here are the files you'll need:**

1.  `manifest.json` (Configures the extension)
2.  `content.js` (Interacts with the YouTube page)
3.  `background.js` (Handles the API call)
4.  `icon16.png`, `icon48.png`, `icon128.png` (Extension icons - create simple ones)

---

**1. `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "YouTube Summarizer (Gemini)",
  "version": "1.0",
  "description": "Adds a button to YouTube videos to generate a summary using Gemini.",
  "permissions": [
    "activeTab", // Needed to get the URL
    "scripting"  // Needed to inject content script (though we use content_scripts here)
    // "storage" // Add this if you implement storing the API key securely
  ],
  "host_permissions": [
    "https://generativelanguage.googleapis.com/" // Allow requests to Gemini API
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/watch*"], // Run only on video watch pages
      "js": ["content.js"],
      "css": ["styles.css"] // Optional: for styling
    }
  ],
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "YouTube Summarizer Settings (Not Implemented)"
    // You could add a popup later for settings like API key input
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

*   **`manifest_version`**: Use 3 (current standard).
*   **`permissions`**: `activeTab` is generally needed, `scripting` allows programmatic injection (though `content_scripts` handles our main injection). `storage` would be for user-set API keys.
*   **`host_permissions`**: Crucial to allow `fetch` requests to the Gemini API endpoint from the background script.
*   **`background`**: Specifies the service worker for background tasks (API calls).
*   **`content_scripts`**: Defines which scripts (`content.js`) and stylesheets (`styles.css`) run on which pages (`youtube.com/watch*`).
*   **`action` / `icons`**: Standard extension icons and toolbar button setup.

---

**2. `content.js`**

```javascript
console.log("YouTube Summarizer content script loaded.");

let summaryDiv = null; // Keep track of the summary div

// Function to create and inject the summarize button
function injectSummarizeButton() {
    // Target the area where like/dislike buttons are. Selector might need updates if YouTube changes layout.
    // Trying a selector that's usually stable near the like/dislike/share buttons.
    const targetElement = document.querySelector("#menu-container #top-level-buttons-computed, #actions #menu #top-level-buttons-computed");

    if (targetElement && !document.getElementById('summarize-button-ext')) {
        console.log("Target element found:", targetElement);

        const summarizeButton = document.createElement('button');
        summarizeButton.id = 'summarize-button-ext';
        summarizeButton.textContent = '✨ Summarize';
        summarizeButton.style.marginLeft = '8px';
        summarizeButton.style.padding = '8px 12px';
        summarizeButton.style.cursor = 'pointer';
        summarizeButton.style.backgroundColor = '#f1f1f1';
        summarizeButton.style.border = '1px solid #ccc';
        summarizeButton.style.borderRadius = '18px'; // Match YouTube's style
        summarizeButton.style.fontSize = '14px';
        summarizeButton.style.fontWeight = '500'; // Match YouTube's style
        summarizeButton.style.lineHeight = '20px'; // Match YouTube's style

        // Hover effect
        summarizeButton.onmouseover = () => summarizeButton.style.backgroundColor = '#e0e0e0';
        summarizeButton.onmouseout = () => summarizeButton.style.backgroundColor = '#f1f1f1';


        summarizeButton.addEventListener('click', handleSummarizeClick);

        // Insert the button - append it within the target container
        targetElement.appendChild(summarizeButton);
        console.log("Summarize button injected.");

        // Also ensure the summary div container exists
        injectSummaryDivContainer();

    } else if (!targetElement) {
        // console.warn("Target element for button injection not found yet.");
    } else {
        // console.log("Summarize button already exists.");
    }
}

// Function to create the container for the summary display
function injectSummaryDivContainer() {
    if (!document.getElementById('youtube-summary-container-ext')) {
        const secondaryColumn = document.getElementById('secondary'); // The column with related videos etc.
        if (secondaryColumn) {
            summaryDiv = document.createElement('div');
            summaryDiv.id = 'youtube-summary-container-ext';
            summaryDiv.style.backgroundColor = '#f9f9f9';
            summaryDiv.style.border = '1px solid #ddd';
            summaryDiv.style.padding = '15px';
            summaryDiv.style.marginTop = '15px';
            summaryDiv.style.borderRadius = '12px';
            summaryDiv.style.maxHeight = '400px'; // Set a max height
            summaryDiv.style.overflowY = 'auto'; // Enable scrolling
            summaryDiv.style.fontSize = '14px';
            summaryDiv.style.lineHeight = '1.6';
            summaryDiv.style.display = 'none'; // Initially hidden

            // Style the scrollbar (optional, webkit browsers)
            summaryDiv.style.setProperty('--scrollbar-thumb-color', '#c1c1c1');
            summaryDiv.style.setProperty('--scrollbar-track-color', '#f1f1f1');
            summaryDiv.innerHTML = `
                <style>
                    #youtube-summary-container-ext::-webkit-scrollbar {
                        width: 8px;
                    }
                    #youtube-summary-container-ext::-webkit-scrollbar-track {
                        background: var(--scrollbar-track-color, #f1f1f1);
                        border-radius: 10px;
                    }
                    #youtube-summary-container-ext::-webkit-scrollbar-thumb {
                        background: var(--scrollbar-thumb-color, #888);
                        border-radius: 10px;
                    }
                    #youtube-summary-container-ext::-webkit-scrollbar-thumb:hover {
                        background: #555;
                    }
                    #youtube-summary-container-ext strong {
                         display: block;
                         margin-bottom: 10px;
                         font-size: 16px;
                         color: #333;
                    }
                    #youtube-summary-container-ext p { margin-bottom: 10px; }
                    #youtube-summary-container-ext ul { margin-left: 20px; margin-bottom: 10px;}
                </style>
                <strong>Video Summary</strong>
                <div id="summary-content-ext"></div>
                <button id="close-summary-btn" style="margin-top: 10px; padding: 5px 10px; cursor: pointer;">Close</button>
            `;

            // Insert the summary div at the top of the secondary column
            secondaryColumn.insertBefore(summaryDiv, secondaryColumn.firstChild);
            console.log("Summary div container injected.");

            // Add event listener for the close button
            document.getElementById('close-summary-btn').addEventListener('click', () => {
                summaryDiv.style.display = 'none';
            });

        } else {
            console.warn("Secondary column not found for summary div injection.");
        }
    }
}


// Handle the button click
function handleSummarizeClick() {
    const videoUrl = window.location.href;
    console.log("Summarize button clicked for URL:", videoUrl);

    if (summaryDiv) {
        const contentArea = summaryDiv.querySelector('#summary-content-ext');
        contentArea.innerHTML = "<i>Generating summary... Please wait.</i> ✨";
        summaryDiv.style.display = 'block'; // Show the container
        summaryDiv.scrollTop = 0; // Scroll to top
    } else {
        console.error("Summary div not found!");
        alert("Error: Could not find the summary display area.");
        return;
    }

    // Send message to background script to perform the API call
    chrome.runtime.sendMessage({ action: "getSummary", url: videoUrl }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
            displaySummary("Error communicating with background script: " + chrome.runtime.lastError.message);
            return;
        }

        if (response) {
            if (response.summary) {
                displaySummary(response.summary);
            } else if (response.error) {
                console.error("Error from background:", response.error);
                displaySummary(`<strong>Error:</strong> ${response.error}`);
            } else {
                 displaySummary("Received an unexpected response from the background script.");
            }
        } else {
            displaySummary("Received no response from the background script. Check background logs.");
        }
    });
}

// Function to display the summary or an error message
function displaySummary(text) {
    if (summaryDiv) {
        const contentArea = summaryDiv.querySelector('#summary-content-ext');
        // Basic sanitation to prevent raw HTML injection from API (though Gemini usually returns Markdown/text)
        // For more robust XSS protection, use a sanitizer library if needed.
        // Convert basic markdown-like newlines to <br> and handle potential lists
        let formattedText = text.replace(/\n/g, '<br>');
        // Consider adding more markdown parsing here if Gemini returns complex markdown

        contentArea.innerHTML = formattedText; // Display the text
        summaryDiv.style.display = 'block'; // Ensure it's visible
    } else {
        console.error("Summary div not available to display text.");
    }
}


// --- Initialization and Handling YouTube's Dynamic Loading ---

// YouTube uses dynamic navigation (SPA). We need to re-run injection logic
// when the user navigates to a new video without a full page reload.
// A MutationObserver is a good way to watch for changes.

let currentHref = document.location.href;

const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        // Check if the URL has changed or if nodes relevant to our injection points are added/removed
        if (currentHref !== document.location.href) {
            currentHref = document.location.href;
            console.log("URL changed to:", currentHref);
            // Wait a short moment for the new page elements to likely render
            setTimeout(injectSummarizeButton, 1000); // Delay helps ensure elements exist
        }
        // More robust: check if specific nodes were added/removed near #content or #secondary
        // This is complex, so starting with URL change detection.
    });
});

// Start observing the body for attribute changes and child list changes
// Adjust target node and options if necessary based on YouTube's structure
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial injection attempt when the script first loads
// Use an interval to wait for the target element to appear, as it might not be ready immediately
const initialCheckInterval = setInterval(() => {
    const targetElement = document.querySelector("#menu-container #top-level-buttons-computed, #actions #menu #top-level-buttons-computed");
    const secondaryColumn = document.getElementById('secondary');
    if (targetElement && secondaryColumn) {
        clearInterval(initialCheckInterval); // Stop checking
        injectSummarizeButton();
        injectSummaryDivContainer(); // Ensure div container is ready even if button was already there
    }
}, 500); // Check every 500ms


// Listen for messages from background (e.g., if background needs to update something later)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displayUpdate") { // Example action
     console.log("Received message from background:", request.message);
     // Update UI if needed
     // sendResponse({ status: "Received update" }); // Optional: acknowledge receipt
  }
  return true; // Indicates response may be sent asynchronously (important!)
});

```

*   **`injectSummarizeButton`**: Finds the button container near Like/Dislike (the selector might need adjustment if YouTube changes its structure) and adds the "Summarize" button. Includes basic styling. It checks if the button already exists.
*   **`injectSummaryDivContainer`**: Creates the `div` on the right (in the `#secondary` column), styles it for scrolling and appearance, hides it initially, and adds a close button.
*   **`handleSummarizeClick`**: Gets the current URL, displays a loading message in the summary div, and sends a message to `background.js` with the URL.
*   **`displaySummary`**: Updates the summary div's content with the text received from the background script. Includes basic newline-to-`<br>` conversion.
*   **Initialization & SPA Handling**:
    *   Uses `setInterval` on initial load to wait for YouTube's elements to render before injecting.
    *   Uses a `MutationObserver` to detect URL changes (when you navigate between videos without a full page reload) and re-trigger the button injection. This is crucial for YouTube's single-page app behavior.
*   **Message Listener**: Includes a basic listener for potential future messages *from* the background script.

---

**3. `background.js`**

```javascript
// IMPORTANT: Replace with your actual Gemini API Key
// **NEVER** commit or share this key publicly.
// Consider using chrome.storage or an options page for users to enter their key.
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // <<<--- PASTE YOUR KEY HERE

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
// Using gemini-1.5-flash - it's faster and cheaper, often sufficient for summarization.
// You could use "gemini-pro" instead:
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;


// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    const prompt = `Please provide a detailed summary of the YouTube video found at this URL: ${videoUrl}. Focus on the key topics, main points, and any significant conclusions or information presented.`;

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
```

*   **`GEMINI_API_KEY`**: **Replace `"YOUR_GEMINI_API_KEY"` with your actual key.** Remember the security warning.
*   **`GEMINI_API_URL`**: The endpoint for the Gemini API. We use `gemini-1.5-flash-latest` here which is efficient. Make sure the key is appended correctly.
*   **`chrome.runtime.onMessage.addListener`**: Listens for the `getSummary` message from `content.js`.
*   **API Key Check**: Adds a basic check if the API key placeholder is still present.
*   **`callGeminiAPI`**:
    *   Constructs the prompt including the video URL.
    *   Uses `fetch` to make a POST request to the Gemini API.
    *   Sets the `Content-Type` header.
    *   Stringifies the request body according to the Gemini API specification (`contents`, `parts`, `text`). Includes optional `generationConfig`.
    *   Handles potential network errors and non-OK HTTP responses. Tries to parse error messages from the API response body.
    *   Parses the successful JSON response and extracts the generated text (summary). **Crucially, the path `data.candidates[0].content.parts[0].text` might need adjustment based on the exact model and API version.** Check the actual response structure you get from Gemini.
    *   Uses `async/await` for cleaner asynchronous code.
*   **`return true;`**: This is essential in the message listener to signal that `sendResponse` will be called *asynchronously* after the `fetch` call completes.

---

**4. `styles.css` (Optional, put in the same folder as `manifest.json`)**

```css
/* Basic styles - can be expanded */

#summarize-button-ext:hover {
    /* Add specific hover styles if needed, supplementing inline styles */
    /* background-color: #d0d0d0 !important; */
     /* Using !important might be needed to override YouTube's default styles */
}

#youtube-summary-container-ext {
   /* Styles are mostly handled inline in content.js for simplicity,
      but you could move them here */
   /* Example: define scrollbar colors using variables set in JS */
    scrollbar-width: thin; /* For Firefox */
    scrollbar-color: var(--scrollbar-thumb-color, #888) var(--scrollbar-track-color, #f1f1f1); /* For Firefox */
}

/* Webkit scrollbar styles moved inline for direct injection */

```

*   You can add more specific styles here if needed, overriding YouTube's defaults. Inline styles in `content.js` are often easier for dynamically created elements.

---

**5. Icons**

*   Create a folder named `icons`.
*   Create three simple square PNG images (e.g., using an online generator or image editor) and save them as `icon16.png` (16x16 pixels), `icon48.png` (48x48 pixels), and `icon128.png` (128x128 pixels) inside the `icons` folder.

---

**How to Install and Run:**

1.  **Get a Gemini API Key:** Go to Google AI Studio ([https://aistudio.google.com/](https://aistudio.google.com/)) and create an API key.
2.  **Save Files:** Create a folder (e.g., `youtube-summarizer`) and save the four files (`manifest.json`, `content.js`, `background.js`, `styles.css`) and the `icons` folder inside it.
3.  **Add API Key:** Open `background.js` and replace `"YOUR_GEMINI_API_KEY"` with the key you obtained. **SAVE THE FILE.**
4.  **Open Chrome Extensions:** Open Chrome, go to `chrome://extensions/`.
5.  **Enable Developer Mode:** Toggle the "Developer mode" switch (usually in the top right corner).
6.  **Load Unpacked:** Click the "Load unpacked" button.
7.  **Select Folder:** Navigate to and select the folder where you saved the extension files (e.g., `youtube-summarizer`).
8.  **Verify:** The "YouTube Summarizer (Gemini)" extension should appear in your list. Make sure there are no red error messages. If there are, check the file contents and `manifest.json` structure carefully. Errors often appear if JSON is invalid or permissions are missing.
9.  **Test:** Go to a YouTube video page (`youtube.com/watch?...`). Refresh the page. You should see a "✨ Summarize" button appear near the Like/Dislike buttons. Click it. The summary area should appear on the right, show "Generating summary...", and then display the result from Gemini.

This provides a functional extension based on your requirements. Remember the API key security considerations for any real-world deployment.