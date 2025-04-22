# Project Context: YouTube Summarizer (Gemini) Chrome Extension

This project is a Chrome browser extension designed to summarize YouTube videos using Google's Gemini AI.

## Core Functionality

The extension injects a "✨ Summarize" button onto YouTube video watch pages (`youtube.com/watch*`). When clicked, it sends the video's URL to a background script, which then queries the Gemini API (specifically `gemini-1.5-flash-latest` by default) with a prompt asking for a detailed summary. The returned summary is then displayed in a dedicated container injected into the YouTube page's secondary column. This container features an "X" close button in the top-right corner. The extension also includes a theme toggle (Light/Dark) accessible via a popup window when clicking the extension's toolbar icon. The chosen theme is saved and applied to the button and summary container.

## File Structure & Purpose

*   **`manifest.json`**:
    *   Defines the extension's metadata (name, version, description).
    *   Specifies necessary permissions (`activeTab`, `scripting`, `storage`) and host permissions (`https://generativelanguage.googleapis.com/` for API calls).
    *   Declares `background.js` as the service worker.
    *   Registers `content.js` and `styles.css` to be injected into YouTube watch pages.
    *   Defines icons and the browser action, linking it to `popup.html`.
*   **`background.js`**:
    *   Contains the core logic for interacting with the Gemini API.
    *   Listens for `getSummary` messages from `content.js` containing the video URL.
    *   **IMPORTANT:** Currently holds a hardcoded Gemini API key (`GEMINI_API_KEY`). This is a significant security risk and should be replaced with a secure method like `chrome.storage` or an options page for user input.
    *   Constructs the API request payload, including the prompt and generation configuration (temperature, max tokens).
    *   Uses `fetch` to call the Gemini API endpoint.
    *   Handles API responses, extracts the summary text, and manages potential errors.
    *   Sends the summary (or error message) back to `content.js`.
*   **`content.js`**:
    *   Responsible for interacting with the YouTube page's DOM.
    *   Injects the "✨ Summarize" button near the like/dislike buttons.
    *   Injects a `div` container (`#youtube-summary-container-ext`) into the secondary column to display the summary. This container is initially hidden and includes an "X" close button in the top-right corner.
    *   Handles clicks on the "Summarize" button, displays a loading state, and sends the video URL to `background.js`.
    *   Receives the summary response from `background.js` and displays it.
    *   Uses a `MutationObserver` to handle YouTube's single-page application nature, ensuring the button is re-injected when navigating between videos.
    *   Reads the theme preference from `chrome.storage` on load and applies the corresponding CSS class (`dark-theme`) to the summary container and button.
    *   Listens for `updateTheme` messages from `popup.js` to dynamically change the theme.
*   **`styles.css`**:
    *   Contains all the styling for the injected elements (button, summary container, close button, scrollbars).
    *   Defines base styles (light theme) and overrides for the dark theme using a `.dark-theme` class selector.
*   **`popup.html`**:
    *   Provides the HTML structure for the popup window accessed via the extension's toolbar icon.
    *   Includes a toggle switch for selecting the theme (Light/Dark).
    *   Links to `popup.js`.
*   **`popup.js`**:
    *   Handles the logic for the theme toggle switch in the popup.
    *   Reads the current theme setting from `chrome.storage.sync` on load.
    *   Saves the updated theme preference to `chrome.storage.sync` when the toggle is changed.
    *   Sends a message (`updateTheme`) to the active tab's `content.js` to apply the theme change immediately.
    *   **`icons/`**:
        *   Contains the extension's icons (`icon16.png`, `icon48.png`, `icon128.png`) used in the browser toolbar and extensions page.
*   **`api/`**: Contains a Python-based backend API.
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

*   **Chrome Extension APIs:** Manifest V3, Service Workers (`background.js`), Content Scripts (`content.js`), Popups (`action.default_popup`), `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, `chrome.storage.sync`, `chrome.tabs.query`, `chrome.tabs.sendMessage`, DOM manipulation.
*   **Web APIs:** `fetch`, `MutationObserver`, DOM manipulation (`document.querySelector`, `createElement`, `appendChild`, `insertBefore`, event listeners), CSS Variables, `element.classList`.
*   **External API:** Google Gemini API (`generativelanguage.googleapis.com`).
*   **Languages:** JavaScript, HTML, CSS, JSON.
*   **Security:** Explicitly notes the risk of hardcoding API keys.

## Potential Improvements (from `ideas.md`)

*   Better UI/UX for the close button (Implemented: "X" button added).
*   Dark mode support (Implemented: Theme toggle added).
*   Proper Markdown rendering for summaries.
*   Secure API key handling (implied by warnings in `background.js` and `temp.md`).
