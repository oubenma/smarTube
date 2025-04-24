const themeRadios = document.querySelectorAll('input[name="theme"]');

// Function to send theme update message to content script
function sendThemeUpdate(themeValue) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "updateTheme", theme: themeValue }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("Could not send theme update message to content script:", chrome.runtime.lastError.message);
                } else {
                    console.log("Theme update message sent to content script:", themeValue);
                }
            });
        } else {
            console.warn("Could not find active tab to send theme update message.");
        }
    });
}

// Load the current theme setting and update the radio buttons
chrome.storage.sync.get(['theme'], (result) => {
    // Default to 'auto' if no theme is stored yet
    const currentTheme = result.theme || 'auto';
    const radioToCheck = document.getElementById(`theme${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}`); // e.g., themeAuto, themeLight
    if (radioToCheck) {
        radioToCheck.checked = true;
    } else {
        // Fallback if ID construction fails (shouldn't happen with current IDs)
        document.getElementById('themeAuto').checked = true;
    }
    console.log('Loaded theme:', currentTheme);
});

// Listen for changes on any radio button
themeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            const newTheme = radio.value; // 'auto', 'light', or 'dark'

            // Save the new theme setting
            chrome.storage.sync.set({ theme: newTheme }, () => {
                console.log('Theme saved:', newTheme);
                // Send update message to content script
                sendThemeUpdate(newTheme);
            });
        }
    });
});
