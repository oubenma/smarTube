# Project Context: YouTube Summarizer (Gemini) Chrome Extension

This project is a Chrome browser extension designed to summarize YouTube videos using Google's Gemini AI.

## Core Functionality

The extension injects a "✨ Summarize" button onto YouTube video watch pages (`youtube.com/watch*`). When clicked:
1.  `content.js` sends the video's URL to `background.js`.
2.  `background.js` retrieves the user's Supadata and Gemini API keys from `chrome.storage.sync`.
3.  If keys are found, `background.js` calls the Supadata Transcript API (`https://api.supadata.ai/v1/youtube/transcript`) using the Supadata key to fetch the video's transcript.
4.  If transcript fetch is successful, `background.js` sends the fetched transcript text to the Google Gemini API (`gemini-1.5-flash-latest` by default) using the Gemini key, with a prompt asking for a detailed summary of the transcript.
5.  The Gemini API returns the summary in Markdown format.
6.  `background.js` sends this Markdown summary back to `content.js`.
7.  `content.js` uses the bundled Showdown.js library to convert the Markdown summary into HTML.
8.  The resulting HTML summary is displayed in a dedicated container injected into the YouTube page's secondary column.
9.  If API keys are missing in storage, `background.js` sends an error to `content.js`, which then displays a message prompting the user to configure keys in the extension's options page.

The summary container features an "X" close button in the top-right corner. The extension includes theme selection (Auto/Light/Dark) accessible via a popup window. The "Auto" setting matches YouTube's current theme, while "Light" and "Dark" force a specific theme. The chosen theme ('auto', 'light', or 'dark') is saved and applied to the button and summary container. API keys are managed via a dedicated options page.

## File Structure & Purpose

*   **`manifest.json`**:
    *   Defines the extension's metadata (name, version, description).
    *   Specifies necessary permissions (`activeTab`, `scripting`, `storage`) and host permissions (`https://generativelanguage.googleapis.com/` for Gemini API calls).
    *   Declares `background.js` as the service worker.
    *   Registers `libs/showdown.min.js`, `content.js`, and `styles.css` to be injected into YouTube watch pages.
    *   Defines icons and the browser action (popup).
    *   Declares `options.html` as the options page using `options_ui`, set to open in a new tab.
*   **`background.js`**:
    *   Handles the core API interaction logic.
    *   Listens for `getSummary` messages from `content.js`.
    *   Retrieves Supadata and Gemini API keys from `chrome.storage.sync`.
    *   If keys are present, calls the Supadata Transcript API (using the Supadata key) and then the Gemini API (using the Gemini key and the transcript).
    *   Handles API responses, extracts the Markdown summary text from Gemini, and manages potential errors from storage access and both API calls.
    *   Sends the Markdown summary or an error message (including a specific `API_KEYS_MISSING` error if keys aren't configured) back to `content.js`.
*   **`content.js`**:
    *   Responsible for interacting with the YouTube page's DOM.
    *   Injects the "✨ Summarize" button near the like/dislike buttons.
    *   Injects a `div` container (`#youtube-summary-container-ext`) into the secondary column to display the summary. This container is initially hidden and includes an "X" close button in the top-right corner.
    *   Handles clicks on the "Summarize" button, displays a loading state, and sends the video URL to `background.js`.
    *   Receives the Markdown summary (or error message) from `background.js`.
    *   If an `API_KEYS_MISSING` error is received, displays a message prompting the user to configure keys in the options page.
    *   Otherwise, uses the bundled Showdown library (`libs/showdown.min.js`) to convert the received Markdown summary into HTML.
    *   Displays the generated HTML (or error message) in the summary container.
    *   Uses a `MutationObserver` to handle YouTube's single-page application nature, ensuring the button is re-injected when navigating between videos.
    *   Reads the theme preference ('auto', 'light', or 'dark', defaulting to 'auto') from `chrome.storage.sync` on load. If set to 'auto', it detects YouTube's theme (via `document.documentElement.hasAttribute('dark')`) and applies the corresponding style (`.dark-theme` or base style). Otherwise, it applies the explicitly chosen theme.
    *   Listens for `updateTheme` messages from `popup.js` (containing 'auto', 'light', or 'dark') to dynamically change the theme.
*   **`styles.css`**:
    *   Contains all the styling for the injected elements (button, summary container, close button, scrollbars).
    *   Defines base styles (light theme) and overrides for the dark theme using a `.dark-theme` class selector.
*   **`popup.html`**:
    *   Provides the HTML structure for the popup window accessed via the extension's toolbar icon.
    *   Includes radio buttons for selecting the theme ("Auto", "Light", "Dark").
    *   Links to `popup.js`.
*   **`popup.js`**:
    *   Handles the logic for the theme radio buttons in the popup.
    *   Reads the current theme setting ('auto', 'light', or 'dark', defaulting to 'auto') from `chrome.storage.sync` on load and updates the radio buttons.
    *   Saves the selected theme preference ('auto', 'light', or 'dark') to `chrome.storage.sync` when a radio button is selected.
    *   Sends a message (`updateTheme`) with the selected theme to the active tab's `content.js` to apply the theme change immediately.
*   **`options.html`**:
    *   The HTML structure for the extension's options page.
    *   Provides input fields for Gemini and Supadata API keys, links to get the keys, a save button, and a status message area.
    *   Links to `options.css` and `options.js`.
*   **`options.js`**:
    *   Handles the logic for the options page.
    *   Loads saved keys from `chrome.storage.sync` on page load.
    *   Saves entered keys to `chrome.storage.sync` when the save button is clicked.
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
    *   A markdown file listing potential future enhancements:
        *   Adding a more prominent "X" close button to the summary div.
        *   Implementing a dark theme.
        *   Improving the rendering of Markdown returned by the Gemini API.
*   **`temp.md`**:
    *   Appears to be a detailed tutorial or guide explaining how to create this specific extension from scratch. It includes code snippets for all major files and setup instructions.
*   **`yt-sumrizer.bat`**:
    *   A simple Windows batch script to open the project directory in VS Code (`code .`).

## Key Technologies & Concepts

*   **Chrome Extension APIs:** Manifest V3, Service Workers (`background.js`), Content Scripts (`content.js`), Popups (`action.default_popup`), Options UI (`options_ui`), `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, `chrome.storage.sync` (used for theme and API keys), `chrome.tabs.query`, `chrome.tabs.sendMessage`, DOM manipulation.
*   **Web APIs:** `fetch`, `MutationObserver`, DOM manipulation (`document.querySelector`, `createElement`, `appendChild`, `insertBefore`, event listeners), CSS Variables, `element.classList`.
*   **External APIs:**
    *   Google Gemini API (`generativelanguage.googleapis.com`)
    *   Supadata Transcript API (`api.supadata.ai`)
*   **Libraries:** Showdown.js (for Markdown rendering).
*   **Languages:** JavaScript, HTML, CSS, JSON.
*   **Security:** API keys are now managed by the user via the options page and stored securely using `chrome.storage.sync`, resolving the previous hardcoding risk.

## Potential Improvements (from `ideas.md`)

*   Better UI/UX for the close button (Implemented: "X" button added).
*   Enhanced theme support (Implemented: Auto/Light/Dark options added, with "Auto" matching YouTube's theme).
*   Proper Markdown rendering for summaries (Implemented: Using Showdown.js).
*   Secure API key handling (Implemented: Via options page and `chrome.storage.sync`).
