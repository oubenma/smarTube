# Tech Context: SmarTube Chrome Extension

## Technologies Used

### Core Languages
- **JavaScript:** Primary language for extension logic (`background.js`, `content.js`, `options.js`).
- **HTML:** Structure for the options page (`options.html`).
- **CSS:** Styling for both the injected UI (`styles.css`) and the options page (`options.css`).
- **JSON:** Used for `manifest.json` and data structures (e.g., Supadata API keys in `chrome.storage.sync`).

### Chrome Extension APIs (Manifest V3)
- **Service Workers:** `background.js` operates as the extension's service worker, handling events and background tasks.
- **Content Scripts:** `content.js` is injected into YouTube pages to interact with the DOM.
- **Options UI:** `options.html` is declared as the options page using `options_ui`.
- **Messaging:** `chrome.runtime.sendMessage` and `chrome.runtime.onMessage` for inter-script communication.
- **Storage:** `chrome.storage.sync` for persistent, synchronized storage of user settings and API keys.
- **Tabs:** `chrome.tabs.query` and `chrome.tabs.sendMessage` for communicating with specific tabs (e.g., sending theme updates).
- **Permissions:** `activeTab`, `scripting`, `storage`, and host permissions for external APIs (`https://generativelanguage.googleapis.com/`).

### Web APIs
- **Fetch API:** For making HTTP requests to external APIs (Gemini, Supadata).
- **MutationObserver:** Used in `content.js` to detect changes in the YouTube DOM, crucial for handling dynamic navigation and ensuring the summary container is correctly managed.
- **History API:** `pushState` and `popstate` events are listened to in `content.js` to detect URL changes for video navigation.
- **DOM Manipulation:** Standard JavaScript methods (`document.querySelector`, `createElement`, `appendChild`, `insertBefore`, `remove`, event listeners) for building and managing the injected UI.
- **CSS Variables:** Extensively used in `styles.css` and `options.css` for a flexible and maintainable theming system.
- **`element.classList`:** For dynamically adding/removing CSS classes (e.g., `.dark-theme`, `.collapsed`).
- **`window.matchMedia`:** Used in `options.js` to detect system dark/light mode preference for the "Auto" theme setting.

### External APIs
- **Google Gemini API:** Accessed via `https://generativelanguage.googleapis.com/` for video summarization and Q&A.
- **Supadata Transcript API:** Accessed via `https://api.supadata.ai` for fetching YouTube video transcripts.

### Third-Party Libraries
- **Showdown.js:** `libs/showdown.min.js` is used in `content.js` to convert Markdown text (received from Gemini API) into HTML for display.

### Development Setup
- The project can be opened in VS Code using `yt-sumrizer.bat`.
- No complex build tools are explicitly mentioned for the core extension, implying a direct loading approach for development.

### Technical Constraints
- **Manifest V3:** Adheres to the latest Chrome Extension Manifest version, which impacts background script behavior (service workers) and content script injection.
- **API Rate Limits:** The extension is designed to handle Supadata API rate limits by cycling through multiple user-provided keys.
- **YouTube DOM Structure:** Relies on specific YouTube DOM elements (e.g., secondary column) for UI injection, which could be subject to changes by YouTube. The `MutationObserver` helps mitigate this by adapting to dynamic loading.
- **Security:** API keys are stored in `chrome.storage.sync` and not hardcoded, addressing security concerns.

### Dependencies
- **Runtime:** Chrome browser environment.
- **External Services:** Google Gemini API, Supadata Transcript API.
- **Bundled Library:** Showdown.js.
- **Python Backend (Not Used by Extension):** The `api/` directory contains a Python FastAPI backend (`main.py`, `requirements.txt`) for fetching subtitles using `youtube-transcript-api`. This backend is *not* currently integrated into the extension's core summarization flow, which directly uses the Supadata API.