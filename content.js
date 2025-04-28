console.log("YouTube Summarizer content script loaded.");

let summaryDiv = null; // Keep track of the summary div

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
                    <span>Video Summary</span>
                    <div id="summary-header-buttons">
                        <button id="minimize-summary-btn" title="Minimize/Expand">-</button>
                        <button id="settings-summary-btn" title="Settings">⚙️</button>
                    </div>
                </div>
                <div id="summary-body-ext">
                    <button id="show-summary-btn-ext">✨ Show Summary</button>
                </div>
            `;

            // Insert the summary div at the top of the secondary column
            secondaryColumn.insertBefore(summaryDiv, secondaryColumn.firstChild);

            // Apply the theme based on storage AFTER the div is in the DOM
            chrome.storage.sync.get(['theme'], (result) => {
                applyTheme(result.theme || 'auto'); // Default to 'auto' theme
            });
            console.log("Summary div container injected.");

            // Function to toggle collapse state
            const toggleCollapse = () => {
                summaryDiv.classList.toggle('collapsed');
            };

            // Add event listener for the minimize button
            summaryDiv.querySelector('#minimize-summary-btn').addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent header click listener from firing
                toggleCollapse();
            });

            // Add event listener for the settings button
            summaryDiv.querySelector('#settings-summary-btn').addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent header click listener from firing
                console.log("Settings button clicked - sending message to open options page.");
                chrome.runtime.sendMessage({ action: "openOptionsPage" });
            });

            // Add event listener for the header (toggles body visibility)
            summaryDiv.querySelector('#summary-header-ext').addEventListener('click', (event) => {
                // Only toggle if the click wasn't on the buttons inside the header
                if (!event.target.closest('#summary-header-buttons')) {
                     toggleCollapse();
                }
            });

            // Add event listener for the "Show Summary" button (if it exists)
            const showSummaryButton = summaryDiv.querySelector('#show-summary-btn-ext');
            if (showSummaryButton) {
                showSummaryButton.addEventListener('click', handleShowSummaryClick);
            }

        } else {
            console.warn("Secondary column not found for summary div injection.");
        }
    }
}

// Handle the "Show Summary" button click
function handleShowSummaryClick() {
    const videoUrl = window.location.href;
    console.log("Show Summary button clicked for URL:", videoUrl);

    if (summaryDiv) {
        const summaryBody = summaryDiv.querySelector('#summary-body-ext');
        // Replace button with loading message and content area
        summaryBody.innerHTML = `
            <strong>Video Summary</strong>
            <div id="summary-content-ext"><i>Generating summary... Please wait.</i> ✨</div>
        `;
        summaryDiv.scrollTop = 0; // Scroll container to top
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

// Function to display the summary (as HTML) or an error message
function displaySummary(content, isError = false) {
    // Ensure summaryDiv and the dynamically added content area exist
    if (summaryDiv && summaryDiv.querySelector('#summary-content-ext')) {
        const contentArea = summaryDiv.querySelector('#summary-content-ext');
        let htmlContent = '';

        if (isError) {
            // Display error messages directly, maybe wrap in strong tags
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
                // Fallback: display raw text with basic formatting
                htmlContent = content.replace(/\n/g, '<br>');
            }
        }

        contentArea.innerHTML = htmlContent; // Display the generated HTML or error
        // No longer need to set display: block here, container is always visible
    } else {
        console.error("Summary div or content area not available to display content.");
    }
}


// --- Initialization and Handling YouTube's Dynamic Loading ---

// YouTube uses dynamic navigation (SPA). We need to watch for the appearance
// of the secondary column to inject our container.

const observer = new MutationObserver(mutations => {
    // Check if the secondary column exists and our container isn't already there
    if (document.getElementById('secondary') && !document.getElementById('youtube-summary-container-ext')) {
        injectSummaryDivContainer();
    }
    // Optional: More robust check if needed, e.g., observing specific elements added/removed
});

// Start observing the document body for changes that might add the secondary column
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
});

// Initial injection attempt when the script first loads
// Use an interval to wait for the secondary column to appear
const initialCheckInterval = setInterval(() => {
    const secondaryColumn = document.getElementById('secondary');
    if (secondaryColumn) {
        clearInterval(initialCheckInterval); // Stop checking
        injectSummaryDivContainer(); // Inject the container if the column is found
    }
}, 500); // Check every 500ms


// Listen for messages from background or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateTheme") {
        console.log("Theme update message received:", request.theme);
        applyTheme(request.theme);
        sendResponse({ status: "Theme updated" }); // Acknowledge receipt
    } else if (request.action === "displayUpdate") { // Example action from original code
        console.log("Received message from background:", request.message);
        // Update UI if needed
        // sendResponse({ status: "Received update" });
    }
    // Return true if you might send a response asynchronously.
    // For theme update, response is synchronous, but returning true is safer practice.
    return true;
});
