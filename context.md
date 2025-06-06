# Project Context: SmarTube Chrome Extension

This project is a Chrome browser extension designed to summarize YouTube videos and answer questions about them using Google's Gemini AI.

## Core Functionality

The extension injects a summary container (`#youtube-summary-container-ext`) into the YouTube video watch page's secondary column (`youtube.com/watch*`). This container is always visible upon injection and provides both video summarization and a Q&A interface based on the transcript.

1.  The container displays a sticky header with the title "Video Summary" and a settings (⚙️) button.
2.  Clicking the header area (but not the settings button) toggles the visibility of the container's body and footer (collapsing/expanding the content area below the header).
3.  Clicking the settings (⚙️) button opens the extension's options page.
4.  The container body initially contains a "✨ Show Summary" button. Clicking this button triggers the summary generation:
    *   The button is replaced with a loading message in the body.
    *   `content.js` sends the video's URL to `background.js`.
    *   `background.js` retrieves API keys and theme settings from `chrome.storage.sync`.
    *   If keys are valid, `background.js` fetches the transcript (Supadata API) and then generates the summary (Gemini API).
    *   `background.js` sends the Markdown summary (or an error) back to `content.js`.
    *   `content.js` converts the Markdown to HTML (using Showdown.js) and displays it in the container's body, replacing the loading message.
    *   If API keys are missing, an error message with instructions is displayed.
5.  A sticky footer bar is present at the bottom of the container, containing a textarea input ("Ask about this video...") and a send button (➤).
6.  Typing a question in the input and pressing Enter (or clicking the send button):
    *   Clears the input field.
    *   Appends the user's question to the container body in a chat-like format.
    *   Appends a "Thinking..." message placeholder to the body.
    *   `content.js` sends the question and video URL to `background.js`.
    *   `background.js` fetches the transcript (if not already available/cached) and calls the Gemini API with a prompt to answer the question based *only* on the transcript.
    *   `background.js` sends the answer (or an error) back to `content.js`.
    *   `content.js` updates the "Thinking..." placeholder with the received answer (or error), maintaining the chat format.
7.  When navigating between videos (URL changes):
    *   The extension detects URL changes using History API listeners (`pushState` and `popstate` events)
    *   Extracts and tracks the video ID from the URL to detect actual video changes
    *   The existing summary container is properly cleared and removed using direct DOM manipulation
    *   A fresh container is injected for the new video after a small delay to ensure YouTube's DOM is ready
    *   All event listeners and state are reset for the new video context
    *   The MutationObserver also monitors URL changes to handle YouTube's dynamic navigation reliably

The extension includes theme selection (Auto/Light/Dark) and container behavior settings. The "Auto" theme setting matches YouTube's current theme, while "Light" and "Dark" force a specific theme. Users can also choose to have the container start in a collapsed state. These settings are managed via a dedicated options page and saved using `chrome.storage.sync`. The options page features full dark mode support that:
- Automatically syncs with system preferences when in "Auto" mode
- Provides a consistent dark theme across all UI elements
- Uses CSS variables for theming with smooth transitions
- Maintains proper contrast and readability in both light and dark modes
- Includes dark-themed form controls and dropdowns

Clicking the extension icon now directly opens the options page.

## File Structure & Purpose

*   **`manifest.json`**:
    *   Defines the extension's metadata (name, version, description).
    *   Specifies necessary permissions (`activeTab`, `scripting`, `storage`) and host permissions (`https://generativelanguage.googleapis.com/` for Gemini API calls).
    *   Declares `background.js` as the service worker.
    *   Registers `libs/showdown.min.js`, `content.js`, and `styles.css` to be injected into YouTube watch pages.
    *   Defines icons and the browser action, which now opens `options.html` directly.
    *   Declares `options.html` as the options page using `options_ui`, set to open in a new tab.
*   **`background.js`**:
    *   Handles the core API interaction logic.
    *   Listens for `getSummary` messages from `content.js`.
    *   Retrieves Gemini API key, Supadata API key settings (multiple keys, active key ID), and theme settings from `chrome.storage.sync`.
    *   If keys are present, calls the Supadata Transcript API (using the active Supadata key, with logic to cycle through keys on rate limit/error) and then the Gemini API (using the Gemini key and the transcript).
    *   Handles API responses, including cycling Supadata keys if rate-limited, extracts the Markdown summary text from Gemini, and manages potential errors.
    *   Sends the Markdown summary or an error message (including `API_KEYS_MISSING` or "all keys rate-limited" errors) back to `content.js`.
    *   Listens for `openOptionsPage` messages from `content.js` and opens the extension's options page.
    *   Listens for `askQuestion` messages from `content.js`, fetches the transcript (if needed), calls the Gemini API for a Q&A response, and sends the answer/error back to `content.js` via the `answerResponse` message.
*   **`content.js`**:
    *   Responsible for interacting with the YouTube page's DOM.
    *   Injects a `div` container (`#youtube-summary-container-ext`) into the secondary column. This container is visible by default.
    *   The container has a sticky header (`#summary-header-ext`) with a title, minimize button (`#minimize-summary-btn`), and settings button (`#settings-summary-btn`).
    *   The container has a body (`#summary-body-ext`) which initially contains a "Show Summary" button (`#show-summary-btn-ext`).
    *   The container has a sticky footer (`#summary-footer-ext`) with a textarea input (`#qa-input-ext`) and a send button (`#qa-send-btn-ext`).
    *   Handles clicks on the header (toggles collapse), minimize button (toggles collapse), and settings button (sends `openOptionsPage` message to `background.js`).
    *   Handles clicks on the "Show Summary" button: appends a loading message to the body, sends video URL to `background.js` for summarization.
    *   Handles input in the Q&A textarea: sends the question to `background.js` via the `askQuestion` message when Enter is pressed (without Shift), clears the input, appends the user's question and a "Thinking..." placeholder to the body.
    *   Handles clicks on the send button: triggers the same question submission logic as the Enter key.
    *   Receives the summary (via `getSummary` response) or Q&A answer/error (via `answerResponse` message) from `background.js`.
    *   Uses the `appendMessage` function to add chat-like messages (user questions, assistant responses/errors, loading states) to the body.
    *   Uses Showdown.js to convert Markdown responses to HTML.
    *   Uses a `MutationObserver` to handle YouTube's dynamic loading and navigation:
        * Tracks video IDs to detect actual video changes
        * Ensures proper cleanup and reinjection of the container when navigating between videos
        * Handles both the secondary column appearance and URL changes
    *   Reads the theme preference and applies the corresponding theme class (`.dark-theme`) to the container.
    *   Listens for `updateTheme` messages from `options.js` to dynamically change the theme.
    *   Respects user preferences for initial container state:
        * Checks `chrome.storage.sync` for `initialCollapsed` setting
        * If enabled, adds the `collapsed` class during container injection
        * Maintains collapse state across page navigation
    *   Uses multiple mechanisms to detect video changes:
        * History API listeners (`pushState` and `popstate` events)
        * Video ID tracking to prevent unnecessary reinitializations
        * MutationObserver for YouTube's dynamic navigation
        * Proper timing and cleanup to ensure smooth transitions between videos
*   **`styles.css`**:
    *   Contains all the styling for the injected elements (summary container, header, body, footer, buttons, textarea, chat messages, scrollbars).
    *   Defines base styles (light theme) and overrides for the dark theme using a `.dark-theme` class selector.
*   **`options.html`**:
    *   The HTML structure for the extension's options page.
    *   Provides input fields for:
        * Gemini API key with a link to obtain it.
        * Management of multiple Supadata API keys:
            * Adding new keys with an optional name.
            * Listing existing keys, showing their name (or masked key) and an indicator if rate-limited.
            * Activating a specific key via a radio button.
            * Deleting keys.
        * Language selection dropdown for summaries
        * Theme selection radio buttons (Auto/Light/Dark)
        * Container settings with an option to start collapsed
    *   Links to `options.css` and `options.js`.
*   **`options.js`**:
    *   Handles the logic for the options page.
    *   Loads saved settings (Gemini key, Supadata keys array, active Supadata key ID, theme, etc.) from `chrome.storage.sync` on page load.
    *   Renders the list of Supadata API keys and handles their addition, deletion, and activation.
    *   Saves user preferences to `chrome.storage.sync`, including:
        * Gemini API key.
        * Supadata API keys (stored as an array of objects, each with `id`, `key`, `name`, `isRateLimited`).
        * Active Supadata key ID.
        * Language preference
        * Theme setting
        * Initial container collapse state
    *   Manages theme switching with system preference detection
    *   Handles automatic theme updates based on system changes
    *   Sends theme update messages to active tabs
*   **`options.css`**:
    *   Provides styling for the `options.html` page.
    *   Implements a comprehensive theming system using CSS variables
    *   Supports both light and dark modes with smooth transitions
    *   Ensures proper styling of form elements in both themes
    *   Maintains accessibility and readability across themes
*   **`libs/`**: Contains third-party libraries bundled with the extension.
    *   **`showdown.min.js`**: The Showdown.js library used for converting Markdown to HTML in `content.js`. **Note:** The actual library code needs to be manually added to this file.
*   **`icons/`**:
    *   Contains the extension's icons (`icon16.png`, `icon48.png`, `icon128.png`) used in the browser toolbar and extensions page.
*   **`api/`**: Contains a Python-based backend API (Currently **not used** by the extension's core summarization flow, which now uses the Supadata API).
    *   **`main.py`**: Implements a FastAPI web server with a single endpoint (`/subtitles`). This endpoint takes a YouTube video URL, extracts the video ID, fetches the transcript using `youtube-transcript-api`, and returns the transcript data.
    *   **`requirements.txt`**: Lists the Python dependencies needed for the API (`fastapi`, `uvicorn`, `youtube-transcript-api`).
*   **`ideas.md`**:
    *   A markdown file listing potential future enhancements.
*   **`temp.md`**:
    *   Appears to be a detailed tutorial or guide explaining how to create this specific extension from scratch. It includes code snippets for all major files and setup instructions.
*   **`yt-sumrizer.bat`**:
    *   A simple Windows batch script to open the project directory in VS Code (`code .`).

## API Keys and Licensing

*   **API Keys:**
    *   Gemini API: Available for free from Google AI Studio (makersuite.google.com/app/apikey) with a generous free tier of 60 requests/minute.
    *   Supadata API: Users can add multiple free API keys obtained from supadata.ai. The extension manages these keys, using one active key at a time and automatically cycling to the next available key if the current one encounters a rate limit or error. This helps maintain functionality even if one key is temporarily restricted. Users can also manually activate a specific key from the options page.

*   **License:**
    *   The project uses MIT License with Commons Clause
    *   Free for non-commercial use
    *   Commercial use requires explicit written permission
    *   Includes restrictions on using the software for commercial advantage, product integration, or business analysis

## Key Technologies & Concepts

*   **Chrome Extension APIs:** Manifest V3, Service Workers (`background.js`), Content Scripts (`content.js`), Options UI (`options_ui`), `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, `chrome.storage.sync` (used for theme and API keys), `chrome.tabs.query`, `chrome.tabs.sendMessage`, DOM manipulation.
*   **Web APIs:** `fetch`, `MutationObserver`, DOM manipulation (`document.querySelector`, `createElement`, `appendChild`, `insertBefore`, event listeners), CSS Variables, `element.classList`.
*   **External APIs:**
    *   Google Gemini API (`generativelanguage.googleapis.com`)
    *   Supadata Transcript API (`api.supadata.ai`)
*   **Libraries:** Showdown.js (for Markdown rendering).
*   **Languages:** JavaScript, HTML, CSS, JSON.
*   **Security:** API keys are managed by the user via the options page and stored securely using `chrome.storage.sync`, resolving the previous hardcoding risk.

## Potential Improvements (from `ideas.md`)

*   Better UI/UX for container controls (Implemented: Sticky header with settings button and header click to collapse/expand body and footer).
*   Enhanced theme support (Implemented: Auto/Light/Dark options added, with "Auto" matching YouTube's theme).
*   Proper Markdown rendering for summaries and Q&A answers (Implemented: Using Showdown.js).
*   Secure API key handling (Implemented: Via options page and `chrome.storage.sync`. Enhanced for Supadata with multiple key management and cycling).
*   Initial state shows container with summary button (Implemented).
*   Added Q&A feature with fixed footer, input, send button, and chat-like display (Implemented).
*   Font size customization for answers in the container (Implemented).
*   Improved Arabic language text alignment and display (Implemented).
