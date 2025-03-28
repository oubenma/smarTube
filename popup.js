const themeToggle = document.getElementById('themeToggle');

// Load the current theme setting and update the toggle
chrome.storage.sync.get(['theme'], (result) => {
    const currentTheme = result.theme || 'light'; // Default to light theme
    themeToggle.checked = currentTheme === 'dark';
});

// Listen for changes on the toggle
themeToggle.addEventListener('change', () => {
    const newTheme = themeToggle.checked ? 'dark' : 'light';

    // Save the new theme setting
    chrome.storage.sync.set({ theme: newTheme }, () => {
        console.log('Theme set to ' + newTheme);

        // Send a message to the active content script(s) to update the theme
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "updateTheme", theme: newTheme }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Handle potential errors (e.g., content script not ready or page not supported)
                        console.warn("Could not send theme update message to content script:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Theme update message sent to content script.");
                    }
                });
            } else {
                console.warn("Could not find active tab to send theme update message.");
            }
        });
    });
});
