// Function to save options to chrome.storage
function saveOptions() {
    const geminiKey = document.getElementById('geminiApiKey').value;
    const supadataKey = document.getElementById('supadataApiKey').value;
    const language = document.getElementById('summaryLanguage').value;
    const theme = document.querySelector('input[name="theme"]:checked').value;
    const initialCollapsed = document.getElementById('initialCollapsed').checked;
    const status = document.getElementById('statusMessage');

    chrome.storage.sync.set({
        geminiApiKey: geminiKey,
        supadataApiKey: supadataKey,
        summaryLanguage: language,
        theme: theme,
        initialCollapsed: initialCollapsed
    }, () => {
        // Update status to let user know options were saved.
        status.textContent = 'Options saved.';
        status.style.color = 'green';
        
        // Send theme update to content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'updateTheme',
                    theme: theme
                });
            }
        });

        setTimeout(() => {
            status.textContent = '';
        }, 1500);
    });
}

// Function to restore options from chrome.storage
function restoreOptions() {
    // Use default values if keys aren't set
    chrome.storage.sync.get({
        geminiApiKey: '',
        supadataApiKey: '',
        summaryLanguage: 'auto',
        theme: 'auto',
        initialCollapsed: false
    }, (items) => {
        document.getElementById('geminiApiKey').value = items.geminiApiKey;
        document.getElementById('supadataApiKey').value = items.supadataApiKey;
        document.getElementById('summaryLanguage').value = items.summaryLanguage;
        document.getElementById('initialCollapsed').checked = items.initialCollapsed;
        
        // Set theme radio button
        document.getElementById(`theme${items.theme.charAt(0).toUpperCase() + items.theme.slice(1)}`).checked = true;
    });
}

// Add event listeners once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveButton').addEventListener('click', saveOptions);
