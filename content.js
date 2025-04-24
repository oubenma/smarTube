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
        // Styles moved to styles.css

        // Apply theme class based on storage (needed if button styles depend on theme class on parent)
        // Although current CSS targets button directly, this is good practice if needed later
        chrome.storage.sync.get(['theme'], (result) => {
            applyTheme(result.theme || 'light'); // Apply theme to container which might affect button via CSS
        });


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
            // Most styles moved to styles.css
            summaryDiv.style.display = 'none'; // Initially hidden

            // Set inner HTML (styles are now primarily in styles.css)
            summaryDiv.innerHTML = `
                <button id="close-summary-x-btn" title="Close Summary">&times;</button>
                <strong>Video Summary</strong>
                <div id="summary-content-ext"></div>
            `;

            // Insert the summary div at the top of the secondary column
            secondaryColumn.insertBefore(summaryDiv, secondaryColumn.firstChild);

            // Apply the theme based on storage AFTER the div is in the DOM
            chrome.storage.sync.get(['theme'], (result) => {
                applyTheme(result.theme || 'light');
            });
            console.log("Summary div container injected.");

            // Add event listener for the NEW close button
            document.getElementById('close-summary-x-btn').addEventListener('click', () => {
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
                // Pass the raw Markdown summary to displaySummary
                displaySummary(response.summary, false); // false indicates it's not an error
            } else if (response.error) {
                console.error("Error from background:", response.error);
                // Pass the error message to displaySummary, marking it as an error
                displaySummary(response.error, true); // true indicates it's an error
            } else {
                 displaySummary("Received an unexpected response from the background script.", true);
            }
        } else {
            displaySummary("Received no response from the background script. Check background logs.", true);
        }
    });
}

// Function to apply the theme class
function applyTheme(theme) {
    if (summaryDiv) {
        if (theme === 'dark') {
            summaryDiv.classList.add('dark-theme');
            // Also apply to button if its styling depends on parent class
            const button = document.getElementById('summarize-button-ext');
            if (button) button.classList.add('dark-theme'); // Example if needed
        } else {
            summaryDiv.classList.remove('dark-theme');
            const button = document.getElementById('summarize-button-ext');
            if (button) button.classList.remove('dark-theme'); // Example if needed
        }
        // Update scrollbar variables if needed (though CSS handles this now)
        // summaryDiv.style.setProperty('--scrollbar-thumb-color', theme === 'dark' ? '#555' : '#c1c1c1');
        // summaryDiv.style.setProperty('--scrollbar-track-color', theme === 'dark' ? '#333' : '#f1f1f1');
    }
} // <-- Added missing closing brace here

// Function to display the summary (as HTML) or an error message
function displaySummary(content, isError = false) {
    if (summaryDiv) {
        const contentArea = summaryDiv.querySelector('#summary-content-ext');
        let htmlContent = '';

        if (isError) {
            // Display error messages directly, maybe wrap in strong tags
            htmlContent = `<strong>Error:</strong> ${content}`;
        } else {
            // Use Showdown to convert Markdown summary to HTML
            // Ensure Showdown library is loaded (should be via manifest.json)
            if (typeof showdown !== 'undefined') {
                const converter = new showdown.Converter({
                    // Optional: Configure Showdown options here if needed
                    // e.g., tables: true, strikethrough: true
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
        summaryDiv.style.display = 'block'; // Ensure it's visible
    } else {
        console.error("Summary div not available to display content.");
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
