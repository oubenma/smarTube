// Function to save options to chrome.storage
function saveOptions() {
    const geminiKey = document.getElementById('geminiApiKey').value;
    const supadataKey = document.getElementById('supadataApiKey').value;
    const language = document.getElementById('summaryLanguage').value;
    const theme = document.querySelector('input[name="theme"]:checked').value;
    const initialCollapsed = document.getElementById('initialCollapsed').checked;
    const fontSize = parseInt(document.getElementById('current-font-size').textContent);
    const status = document.getElementById('statusMessage');

    chrome.storage.sync.set({
        geminiApiKey: geminiKey,
        supadataApiKey: supadataKey,
        summaryLanguage: language,
        theme: theme,
        initialCollapsed: initialCollapsed,
        fontSize: fontSize
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
        initialCollapsed: false,
        fontSize: 14
    }, (items) => {
        document.getElementById('geminiApiKey').value = items.geminiApiKey;
        document.getElementById('supadataApiKey').value = items.supadataApiKey;
        document.getElementById('summaryLanguage').value = items.summaryLanguage;
        document.getElementById('initialCollapsed').checked = items.initialCollapsed;
        
        // Set theme radio button
        document.getElementById(`theme${items.theme.charAt(0).toUpperCase() + items.theme.slice(1)}`).checked = true;
        
        // Apply the theme
        applyTheme(items.theme);

        // Set font size
        updateFontSize(items.fontSize);
    });
}

// Function to apply theme to the options page
function applyTheme(theme) {
    if (theme === 'auto') {
        // Check system dark mode preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

// Function to update font size display and preview
function updateFontSize(size) {
    const currentSize = document.getElementById('current-font-size');
    currentSize.textContent = `${size}px`;
    document.documentElement.style.setProperty('--preview-font-size', `${size}px`);
}

// Function to handle font size changes
function changeFontSize(increment) {
    const currentSize = parseInt(document.getElementById('current-font-size').textContent);
    const newSize = Math.max(10, Math.min(24, currentSize + increment));
    updateFontSize(newSize);
}

// Watch for system theme changes when in auto mode
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        chrome.storage.sync.get('theme', (items) => {
            if (items.theme === 'auto') {
                applyTheme('auto');
            }
        });
    });
}

// Add event listeners once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    
    // Font size control listeners
    document.getElementById('increase-font-btn').addEventListener('click', () => changeFontSize(2));
    document.getElementById('decrease-font-btn').addEventListener('click', () => changeFontSize(-2));
    
    // Add theme change listener
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
    });
    
    document.getElementById('saveButton').addEventListener('click', saveOptions);
});
