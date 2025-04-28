# Project Context: YouTube Summarizer (Gemini) Chrome Extension

This project is a Chrome browser extension designed to summarize YouTube videos using Google's Gemini AI.

## Core Functionality

The extension injects a summary container (`#youtube-summary-container-ext`) into the YouTube video watch page's secondary column (`youtube.com/watch*`). This container is always visible upon injection.

1.  The container initially displays a header with the title "Video Summary", a minimize (-) button, and a settings (⚙️) button. Below the header, a "✨ Show Summary" button is shown.
2.  Clicking the header area (but not the buttons) or the minimize (-) button toggles the visibility of the container's body (collapsing/expanding it).
3.  Clicking the settings (⚙️) button opens the extension's options page.
4.  Clicking the "✨ Show Summary" button:
    *   Replaces the button with a loading message.
    *   `content.js` sends the video's URL to `background.js`.
    *   `background.js` retrieves API keys and theme settings from `chrome.storage.sync`.
    *   If keys are valid, `background.js` fetches the transcript (Supadata API) and then generates the summary (Gemini API).
    *   `background.js` sends the Markdown summary (or an error) back to `content.js`.
    *   `content.js` converts the Markdown to HTML (using Showdown.js) and displays it in the container's body, replacing the loading message.
    *   If API keys are missing, an error message with instructions to configure them is displayed instead.

The extension includes theme selection (Auto/Light/Dark). The "Auto" setting matches YouTube's current theme, while "Light" and "Dark" force a specific theme. The chosen theme ('auto', 'light', or 'dark') is saved and applied to the summary container. API keys and theme settings are managed via a dedicated options page. Clicking the extension icon now directly opens the options page.

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
    *   Retrieves Supadata and Gemini API keys, and theme settings from `chrome.storage.sync`.
    *   If keys are present, calls the Supadata Transcript API (using the Supadata key) and then the Gemini API (using the Gemini key and the transcript).
    *   Handles API responses, extracts the Markdown summary text from Gemini, and manages potential errors from storage access and both API calls.
    *   Sends the Markdown summary or an error message (including a specific `API_KEYS_MISSING` error if keys aren't configured) back to `content.js`.
    *   Listens for `openOptionsPage` messages from `content.js` and opens the extension's options page.
*   **`content.js`**:
    *   Responsible for interacting with the YouTube page's DOM.
    *   Injects a `div` container (`#youtube-summary-container-ext`) into the secondary column. This container is visible by default.
    *   The container has a sticky header (`#summary-header-ext`) with a title, minimize button (`#minimize-summary-btn`), and settings button (`#settings-summary-btn`).
    *   The container has a body (`#summary-body-ext`) which initially contains a "Show Summary" button (`#show-summary-btn-ext`).
    *   Handles clicks on the header (toggles collapse), minimize button (toggles collapse), and settings button (sends `openOptionsPage` message to `background.js`).
    *   Handles clicks on the "Show Summary" button: displays loading state, sends video URL to `background.js`, and replaces the button with the content area (`#summary-content-ext`).
    *   Receives the Markdown summary (or error message) from `background.js`.
    *   If an `API_KEYS_MISSING` error is received, displays a message prompting the user to configure keys.
    *   Otherwise, uses the bundled Showdown library (`libs/showdown.min.js`) to convert the received Markdown summary into HTML.
    *   Displays the generated HTML (or error message) in the `#summary-content-ext` div.
    *   Uses a `MutationObserver` to handle YouTube's dynamic loading, ensuring the container is injected when the secondary column appears.
    *   Reads the theme preference ('auto', 'light', or 'dark') from `chrome.storage.sync` on load and applies the corresponding theme class (`.dark-theme`) to the container.
    *   Listens for `updateTheme` messages from `options.js` to dynamically change the theme.
*   **`styles.css`**:
    *   Contains all the styling for the injected elements (summary container, header, body, buttons, scrollbars).
    *   Defines base styles (light theme) and overrides for the dark theme using a `.dark-theme` class selector.
*   **`options.html`**:
    *   The HTML structure for the extension's options page.
    *   Provides input fields for Gemini and Supadata API keys, links to get the keys, a language selection dropdown, and theme selection radio buttons.
    *   Links to `options.css` and `options.js`.
*   **`options.js`**:
    *   Handles the logic for the options page.
    *   Loads saved keys and theme setting from `chrome.storage.sync` on page load.
    *   Saves entered keys, language preference, and theme setting to `chrome.storage.sync` when the save button is clicked.
    *   Sends a message (`updateTheme`) with the selected theme to the active tab's `content.js` to apply the theme change immediately.
*   **`options.css`**:
    *   Provides basic styling for the `options.html` page.
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

*   Better UI/UX for container controls (Implemented: Sticky header with minimize/settings buttons).
*   Enhanced theme support (Implemented: Auto/Light/Dark options added, with "Auto" matching YouTube's theme).
*   Proper Markdown rendering for summaries (Implemented: Using Showdown.js).
*   Secure API key handling (Implemented: Via options page and `chrome.storage.sync`).
*   Initial state shows container with button (Implemented).
