// Function to save general options to chrome.storage
function saveOptions() {
    const geminiKey = document.getElementById('geminiApiKey').value;
    // Supadata keys are saved separately by their specific handlers
    const language = document.getElementById('summaryLanguage').value;
    const theme = document.querySelector('input[name="theme"]:checked').value;
    const initialCollapsed = document.getElementById('initialCollapsed').checked;
    const fontSize = parseInt(document.getElementById('current-font-size').textContent);
    const status = document.getElementById('statusMessage');

    chrome.storage.sync.set({
        geminiApiKey: geminiKey,
        // supadataApiKey is no longer saved here
        summaryLanguage: language,
        theme: theme,
        initialCollapsed: initialCollapsed,
        fontSize: fontSize
    }, () => {
        // Update status to let user know options were saved.
        status.textContent = 'General settings saved.'; // Clarified message
        status.style.color = 'green';
        
        // Send theme update to content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].id) { // Check if tabs[0].id exists
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

// --- Supadata API Key Management ---

function renderSupadataKeysList(keysArray = [], activeKeyId = null) {
    const listElement = document.getElementById('supadataKeysList');
    listElement.innerHTML = ''; // Clear current list

    if (keysArray.length === 0) {
        listElement.textContent = 'No Supadata API keys added yet.';
        return;
    }

    const ul = document.createElement('ul');
    ul.style.listStyleType = 'none';
    ul.style.paddingLeft = '0';

    keysArray.forEach(keyObj => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.marginBottom = '8px';
        li.style.padding = '5px';
        li.style.border = '1px solid #eee';
        li.style.borderRadius = '4px';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'activeSupadataKey';
        radio.value = keyObj.id;
        radio.checked = keyObj.id === activeKeyId;
        radio.style.marginRight = '10px';
        radio.addEventListener('change', () => handleActivateSupadataKey(keyObj.id));

        const nameSpan = document.createElement('span');
        nameSpan.textContent = keyObj.name ? `${keyObj.name} (${maskApiKey(keyObj.key)})` : maskApiKey(keyObj.key);
        nameSpan.style.flexGrow = '1';
        if (keyObj.isRateLimited) {
            nameSpan.textContent += ' (Rate-Limited)';
            nameSpan.style.color = 'orange';
        }


        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.style.marginLeft = '10px';
        deleteButton.style.padding = '3px 8px';
        deleteButton.addEventListener('click', () => handleDeleteSupadataKey(keyObj.id));

        li.appendChild(radio);
        li.appendChild(nameSpan);
        li.appendChild(deleteButton);
        ul.appendChild(li);
    });
    listElement.appendChild(ul);
}

function maskApiKey(apiKey) {
    if (apiKey.length > 8) {
        return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    }
    return apiKey;
}

async function handleAddSupadataKey() {
    const keyNameInput = document.getElementById('newSupadataKeyName');
    const keyValueInput = document.getElementById('newSupadataKey');
    const name = keyNameInput.value.trim();
    const value = keyValueInput.value.trim();

    if (!value) {
        alert('API Key Value cannot be empty.');
        return;
    }

    const newKey = {
        id: Date.now().toString(),
        key: value,
        name: name || '',
        isRateLimited: false
    };

    chrome.storage.sync.get({ supadataApiKeys: [], activeSupadataKeyId: null }, (data) => {
        const updatedKeys = [...data.supadataApiKeys, newKey];
        let newActiveKeyId = data.activeSupadataKeyId;

        if (!newActiveKeyId && updatedKeys.length > 0) { // If no key was active, make the new one active
            newActiveKeyId = newKey.id;
        } else if (updatedKeys.length === 1) { // If this is the only key, make it active
             newActiveKeyId = newKey.id;
        }


        chrome.storage.sync.set({ supadataApiKeys: updatedKeys, activeSupadataKeyId: newActiveKeyId }, () => {
            keyNameInput.value = '';
            keyValueInput.value = '';
            renderSupadataKeysList(updatedKeys, newActiveKeyId);
            const status = document.getElementById('statusMessage');
            status.textContent = 'Supadata API Key added.';
            status.style.color = 'green';
            setTimeout(() => status.textContent = '', 1500);
        });
    });
}

async function handleDeleteSupadataKey(keyIdToDelete) {
    chrome.storage.sync.get({ supadataApiKeys: [], activeSupadataKeyId: null }, (data) => {
        const filteredKeys = data.supadataApiKeys.filter(key => key.id !== keyIdToDelete);
        let newActiveKeyId = data.activeSupadataKeyId;

        if (data.activeSupadataKeyId === keyIdToDelete) { // If the deleted key was active
            if (filteredKeys.length > 0) {
                newActiveKeyId = filteredKeys[0].id; // Make the first remaining key active
            } else {
                newActiveKeyId = null; // No keys left
            }
        }

        chrome.storage.sync.set({ supadataApiKeys: filteredKeys, activeSupadataKeyId: newActiveKeyId }, () => {
            renderSupadataKeysList(filteredKeys, newActiveKeyId);
            const status = document.getElementById('statusMessage');
            status.textContent = 'Supadata API Key deleted.';
            status.style.color = 'green';
            setTimeout(() => status.textContent = '', 1500);
        });
    });
}

async function handleActivateSupadataKey(keyIdToActivate) {
    chrome.storage.sync.get({ supadataApiKeys: [] }, (data) => {
        // Mark the newly activated key as not rate-limited, as the user is explicitly choosing it.
        const updatedKeys = data.supadataApiKeys.map(k => 
            k.id === keyIdToActivate ? { ...k, isRateLimited: false } : k
        );

        chrome.storage.sync.set({ supadataApiKeys: updatedKeys, activeSupadataKeyId: keyIdToActivate }, () => {
            renderSupadataKeysList(updatedKeys, keyIdToActivate);
            const status = document.getElementById('statusMessage');
            status.textContent = 'Supadata API Key activated.';
            status.style.color = 'green';
            setTimeout(() => status.textContent = '', 1500);
        });
    });
}


// Function to restore options from chrome.storage
function restoreOptions() {
    // Use default values if keys aren't set
    chrome.storage.sync.get({
        geminiApiKey: '',
        // supadataApiKey: '', // Old single key
        supadataApiKeys: [],     // New array for multiple keys
        activeSupadataKeyId: null, // ID of the active Supadata key
        summaryLanguage: 'auto',
        theme: 'auto',
        initialCollapsed: false,
        fontSize: 14
    }, (items) => {
        document.getElementById('geminiApiKey').value = items.geminiApiKey;
        // document.getElementById('supadataApiKey').value = items.supadataApiKey; // Old single key
        renderSupadataKeysList(items.supadataApiKeys, items.activeSupadataKeyId); // Render the list of Supadata keys
        document.getElementById('summaryLanguage').value = items.summaryLanguage;
        document.getElementById('initialCollapsed').checked = items.initialCollapsed;
        
        // Set theme radio button
        const themeRadio = document.getElementById(`theme${items.theme.charAt(0).toUpperCase() + items.theme.slice(1)}`);
        if (themeRadio) themeRadio.checked = true;
        
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
        const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
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
    
    // Save button for general settings
    document.getElementById('saveButton').addEventListener('click', saveOptions);

    // Add Supadata Key button listener
    document.getElementById('addSupadataKeyBtn').addEventListener('click', handleAddSupadataKey);
});
