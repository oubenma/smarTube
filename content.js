console.log("SmarTube content script loaded.");

let summaryDiv = null; // Keep track of the summary div
let currentVideoUrl = '';
let currentVideoId = '';

// Function to create the container for the summary display
function injectSummaryDivContainer() {
    if (!document.getElementById('youtube-summary-container-ext')) {
        const secondaryColumn = document.getElementById('secondary'); // The column with related videos etc.
        if (secondaryColumn) {
            summaryDiv = document.createElement('div');
            summaryDiv.id = 'youtube-summary-container-ext';
            // Styles primarily in styles.css - container is visible by default

            // Set initial inner HTML with header and body structure
            summaryDiv.innerHTML = `
                <div id="summary-header-ext">
                    <span>SmarTube</span>
                    <div id="summary-header-buttons">
                        <button id="settings-summary-btn" title="Settings">⚙️</button>
                    </div>
                </div>
                <div id="summary-body-ext">
                    <button id="show-summary-btn-ext">✨ Show Summary</button>
                </div>
                <div id="summary-footer-ext">
                    <textarea id="qa-input-ext" rows="1" placeholder="Ask anything about this video..."></textarea>
                    <button id="qa-send-btn-ext" title="Send">➤</button>
                </div>
            `;

            // Insert the summary div at the top of the secondary column
            secondaryColumn.insertBefore(summaryDiv, secondaryColumn.firstChild);

            // Apply the theme and check initial collapse state
            chrome.storage.sync.get(['theme', 'initialCollapsed', 'fontSize'], (result) => {
                applyTheme(result.theme || 'auto'); // Default to 'auto' theme
                if (result.initialCollapsed) {
                    summaryDiv.classList.add('collapsed');
                }
                // Apply saved font size or default to 14
                const fontSize = result.fontSize || 14;
                document.documentElement.style.setProperty('--summary-font-size', `${fontSize}px`);
            });
            console.log("Summary div container injected.");

            // --- Add Event Listeners ---

            // Function to toggle collapse state
            const toggleCollapse = () => {
                summaryDiv.classList.toggle('collapsed');
            };

            // Settings button
            summaryDiv.querySelector('#settings-summary-btn').addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent header click listener from firing
                console.log("Settings button clicked - sending message to open options page.");
                chrome.runtime.sendMessage({ action: "openOptionsPage" });
            });

            // Header click (for collapse)
            summaryDiv.querySelector('#summary-header-ext').addEventListener('click', (event) => {
                if (!event.target.closest('#summary-header-buttons')) {
                     toggleCollapse();
                }
            });

            // Initial "Show Summary" button
            const showSummaryButton = summaryDiv.querySelector('#show-summary-btn-ext');
            if (showSummaryButton) {
                showSummaryButton.addEventListener('click', handleShowSummaryClick);
            }

            // Q&A Textarea (Enter/Shift+Enter)
            const qaInput = summaryDiv.querySelector('#qa-input-ext');
            qaInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    if (!event.shiftKey) { // Enter only (no shift)
                        event.preventDefault(); // Prevent newline
                        handleQuestionSubmit();
                    }
                    // If Shift+Enter, default behavior (newline) is allowed
                }
            });

            // Q&A Send Button
            summaryDiv.querySelector('#qa-send-btn-ext').addEventListener('click', handleQuestionSubmit);

        } else {
            console.warn("Secondary column not found for summary div injection.");
        }
    }
}

// Function to extract video ID from URL
function getVideoIdFromUrl(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v');
}

// Function to clear the existing summary container
function clearSummaryContainer() {
    const existingContainer = document.getElementById('youtube-summary-container-ext');
    if (existingContainer) {
        existingContainer.remove();
    }
    summaryDiv = null;
}

// Function to check if URL has changed and reinitialize if needed
function handleUrlChange() {
    const newUrl = window.location.href;
    const newVideoId = getVideoIdFromUrl(newUrl);
    
    // Only proceed if we're on a watch page and the video ID has changed
    if (newUrl.includes('youtube.com/watch') && newVideoId && newVideoId !== currentVideoId) {
        currentVideoUrl = newUrl;
        currentVideoId = newVideoId;
        clearSummaryContainer();
        // Small delay to ensure YouTube's DOM has updated
        setTimeout(() => {
            injectSummaryDivContainer();
        }, 100);
    }
}

// Function to append a message to the summary body (chat style)
function appendMessage(htmlContent, role, id = null) {
    if (!summaryDiv) return;
    const summaryBody = summaryDiv.querySelector('#summary-body-ext');
    if (!summaryBody) return;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.innerHTML = htmlContent; // Use innerHTML to allow basic formatting
    if (id) {
        messageDiv.id = id;
    }

    summaryBody.appendChild(messageDiv);

    // Scroll to bottom
    summaryBody.scrollTop = summaryBody.scrollHeight;
}

// Handle the "Show Summary" button click - Modified for chat flow
function handleShowSummaryClick() {
    const videoUrl = window.location.href;
    console.log("Show Summary button clicked for URL:", videoUrl);

    if (summaryDiv) {
        const summaryBody = summaryDiv.querySelector('#summary-body-ext');
        // Remove the "Show Summary" button
        const showSummaryButton = summaryBody.querySelector('#show-summary-btn-ext');
        if (showSummaryButton) {
            showSummaryButton.remove();
        }
        // Append loading message
        appendMessage("<i>Generating summary... Please wait.</i> ✨", 'assistant', 'summary-placeholder');
        // summaryDiv.scrollTop = 0; // Scroll container to top - appendMessage handles scrolling
    } else {
        console.error("Summary div not found!");
        alert("Error: Could not find the summary display area.");
        return;
    }

    // Send message to background script to perform the API call
    chrome.runtime.sendMessage({ action: "getSummary", url: videoUrl }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
            displaySummary("Error communicating with background script: " + chrome.runtime.lastError.message, true);
            return;
        }

        if (response) {
            console.log("Response from background received");
            if (response.summary) {
                // Pass the raw Markdown summary to displaySummary
                displaySummary(response.summary, false); // false indicates it's not an error
            } else if (response.error) {
                console.error("Error from background:", response.error);
                // Check for the specific API key error
                if (response.error === "API_KEYS_MISSING") {
                    // Provide a specific message with instructions
                    const optionsMessage = `API Keys are missing. Please configure them in the extension options.<br>(Right-click the extension icon > Options)`;
                    displaySummary(optionsMessage, true); // Display as an error
                } else {
                    // Pass other errors to displaySummary
                    displaySummary(response.error, true); // true indicates it's an error
                }
            } else {
                 displaySummary("Received an unexpected response from the background script.", true);
            }
        } else {
            displaySummary("Received no response from the background script. Check background logs.", true);
        }
    });
}

// Function to apply the theme class based on the setting ('auto', 'light', 'dark')
function applyTheme(themeSetting) {
    if (!summaryDiv) return; // Exit if summaryDiv doesn't exist yet

    let applyDarkTheme = false;

    if (themeSetting === 'auto') {
        // Detect YouTube's theme by checking the 'dark' attribute on the <html> element
        applyDarkTheme = document.documentElement.hasAttribute('dark');
        console.log(`Auto theme detection: YouTube is ${applyDarkTheme ? 'dark' : 'light'}`);
    } else {
        // Use the explicit setting
        applyDarkTheme = themeSetting === 'dark';
    }

    // Apply theme class to the main container
    if (applyDarkTheme) {
        summaryDiv.classList.add('dark-theme');
    } else {
        summaryDiv.classList.remove('dark-theme');
    }
    console.log(`Applied theme: ${applyDarkTheme ? 'dark' : 'light'} (Setting: ${themeSetting})`);
}

// Function to display the summary (as HTML) or an error message - Modified for chat flow
function displaySummary(content, isError = false) {
    if (!summaryDiv) {
        console.error("Summary div not available to display content.");
        return;
    }
    // Find the placeholder message
    const placeholder = summaryDiv.querySelector('#summary-placeholder');
    if (!placeholder) {
        console.error("Summary placeholder not found. Cannot display summary.");
        // As a fallback, maybe append?
        // appendMessage(isError ? `<strong>Error:</strong> ${content}` : content, 'assistant');
        return;
    }

    let htmlContent = '';
    if (isError) {
        htmlContent = `<strong>Error:</strong> ${content}`;
    } else {
        // Use Showdown to convert Markdown summary to HTML
        if (typeof showdown !== 'undefined') {
            const converter = new showdown.Converter({
                simplifiedAutoLink: true,
                strikethrough: true,
                tables: true,
                tasklists: true
            });
            htmlContent = converter.makeHtml(content);
        } else {
            console.error("Showdown library not loaded!");
            htmlContent = content.replace(/\n/g, '<br>'); // Fallback
        }
    }

    // Update the placeholder content and remove the ID
    placeholder.innerHTML = htmlContent;
    placeholder.id = ''; // Remove ID so it's not targeted again

    // Ensure scroll is at bottom after content update
    const summaryBody = summaryDiv.querySelector('#summary-body-ext');
     if (summaryBody) {
        summaryBody.scrollTop = summaryBody.scrollHeight;
     }
}

// Handle submission of a question from the input footer
function handleQuestionSubmit() {
    if (!summaryDiv) return;
    const qaInput = summaryDiv.querySelector('#qa-input-ext');
    const questionText = qaInput.value.trim();

    if (questionText) {
        console.log("Submitting question:", questionText);
        // Clear input
        qaInput.value = '';
        // Append user message
        // Basic escaping for display - consider a more robust sanitizer if needed
        const escapedQuestion = questionText.replace(/</g, "<").replace(/>/g, ">");
        appendMessage(escapedQuestion, 'user');
        // Append thinking placeholder
        appendMessage("<i>Thinking...</i>", 'assistant', 'thinking-placeholder');

        // Send to background
        const videoUrl = window.location.href;
        chrome.runtime.sendMessage({ action: "askQuestion", question: questionText, url: videoUrl }, (response) => {
             if (chrome.runtime.lastError) {
                console.error("Error sending question message:", chrome.runtime.lastError.message);
                displayAnswer("Error communicating with background script: " + chrome.runtime.lastError.message, true);
                return;
            }
            // Response handling is done via the 'answerResponse' listener now
            if (response && response.status) {
                 console.log("Background acknowledged question:", response.status);
            }
        });
    }
}

// Function to display the answer received from the background script
function displayAnswer(content, isError = false) {
     if (!summaryDiv) {
        console.error("Summary div not available to display answer.");
        return;
    }
    // Find the placeholder message
    const placeholder = summaryDiv.querySelector('#thinking-placeholder');
    if (!placeholder) {
        console.error("Thinking placeholder not found. Cannot display answer.");
        // Fallback: append directly
        appendMessage(isError ? `<strong>Error:</strong> ${content}` : content, 'assistant');
        return;
    }

    let htmlContent = '';
    if (isError) {
        htmlContent = `<strong>Error:</strong> ${content}`;
    } else {
         // Use Showdown for answers as well, assuming they might contain Markdown
         if (typeof showdown !== 'undefined') {
            const converter = new showdown.Converter({
                simplifiedAutoLink: true,
                strikethrough: true,
                tables: true,
                tasklists: true
            });
            htmlContent = converter.makeHtml(content);
        } else {
            console.error("Showdown library not loaded!");
            htmlContent = content.replace(/\n/g, '<br>'); // Fallback
        }
    }

    // Update the placeholder content and remove the ID
    placeholder.innerHTML = htmlContent;
    placeholder.id = ''; // Remove ID

    // Ensure scroll is at bottom
    const summaryBody = summaryDiv.querySelector('#summary-body-ext');
     if (summaryBody) {
        summaryBody.scrollTop = summaryBody.scrollHeight;
     }
}

// --- Initialization and Handling YouTube's Dynamic Loading ---

// YouTube uses dynamic navigation (SPA). We need to watch for the appearance
// of the secondary column and URL changes
const observer = new MutationObserver(mutations => {
    // Check if we're on a watch page
    if (window.location.href.includes('youtube.com/watch')) {
        // Handle URL changes
        handleUrlChange();
        
        // Check if the secondary column exists and our container isn't already there
        const secondaryColumn = document.getElementById('secondary');
        const existingContainer = document.getElementById('youtube-summary-container-ext');
        
        if (secondaryColumn && !existingContainer) {
            injectSummaryDivContainer();
        }
    }
});

// Start observing the document body for changes
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
});

// Watch for URL changes using the History API
const pushState = history.pushState;
history.pushState = function() {
    pushState.apply(history, arguments);
    handleUrlChange();
};

window.addEventListener('popstate', handleUrlChange);

// Initial setup when the script first loads
if (window.location.href.includes('youtube.com/watch')) {
    currentVideoUrl = window.location.href;
    currentVideoId = getVideoIdFromUrl(currentVideoUrl);
    
    const initialCheckInterval = setInterval(() => {
        const secondaryColumn = document.getElementById('secondary');
        if (secondaryColumn) {
            clearInterval(initialCheckInterval);
            injectSummaryDivContainer();
        }
    }, 500);
}

// Listen for messages from background script or options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateTheme") {
        console.log("Theme update message received:", request.theme);
        applyTheme(request.theme);
        sendResponse({ status: "Theme updated" });
        return false; // Synchronous response
    } else if (request.action === "answerResponse") {
        console.log("Answer response received from background:", request);
        if (request.answer) {
            displayAnswer(request.answer, false);
        } else if (request.error) {
            displayAnswer(request.error, true);
        }
        // No response needed back to background for this
        return false; // Synchronous handling
    }
    // Return true only if we expect to sendResponse asynchronously (e.g., for getSummary)
    // For other messages handled synchronously or not needing a response, return false or nothing.
});
