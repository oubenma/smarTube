// Function to save options to chrome.storage
function saveOptions() {
    const geminiKey = document.getElementById('geminiApiKey').value;
    const supadataKey = document.getElementById('supadataApiKey').value;
    const status = document.getElementById('statusMessage');

    chrome.storage.sync.set({
        geminiApiKey: geminiKey,
        supadataApiKey: supadataKey
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
        supadataApiKey: ''
    }, (items) => {
        document.getElementById('geminiApiKey').value = items.geminiApiKey;
        document.getElementById('supadataApiKey').value = items.supadataApiKey;
    });
}

// Add event listeners once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveButton').addEventListener('click', saveOptions);

console.log("Options script loaded.");
