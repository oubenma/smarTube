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
            console.log("Response from background received");
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