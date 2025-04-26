// Function to save options to chrome.storage
function saveOptions() {
    const geminiKey = document.getElementById('geminiApiKey').value;
    const supadataKey = document.getElementById('supadataApiKey').value;
    const language = document.getElementById('summaryLanguage').value; // Get selected language
    const status = document.getElementById('statusMessage');

    chrome.storage.sync.set({
        geminiApiKey: geminiKey,
        supadataApiKey: supadataKey,
        summaryLanguage: language // Save language preference
    }, () => {
        // Update status to let user know options were saved.
        status.textContent = 'Options saved.';
        status.style.color = 'green';
        setTimeout(() => {
            status.textContent = '';
        }, 1500); // Clear status after 1.5 seconds
    });
}

// Function to restore options from chrome.storage
function restoreOptions() {
    // Use default values if keys aren't set
    chrome.storage.sync.get({
        geminiApiKey: '',
        supadataApiKey: '',
        summaryLanguage: 'auto' // Default language to 'auto'
    }, (items) => {
        document.getElementById('geminiApiKey').value = items.geminiApiKey;
        document.getElementById('supadataApiKey').value = items.supadataApiKey;
        document.getElementById('summaryLanguage').value = items.summaryLanguage; // Set dropdown value
    });
}

// Add event listeners once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveButton').addEventListener('click', saveOptions);

console.log("Options script loaded.");
