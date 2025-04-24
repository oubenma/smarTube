# Project Context: YouTube Summarizer (Gemini) Chrome Extension

This project is a Chrome browser extension designed to summarize YouTube videos using Google's Gemini AI.

## Core Functionality

The extension injects a "✨ Summarize" button onto YouTube video watch pages (`youtube.com/watch*`). When clicked:
1.  `content.js` sends the video's URL to `background.js`.
2.  `background.js` calls the Supadata Transcript API (`https://api.supadata.ai/v1/youtube/transcript`) to fetch the video's transcript.
3.  If successful, `background.js` sends the fetched transcript text to the Google Gemini API (`gemini-1.5-flash-latest` by default) with a prompt asking for a detailed summary of the transcript.
4.  The Gemini API returns the summary in Markdown format.
5.  `background.js` sends this Markdown summary back to `content.js`.
6.  `content.js` uses the bundled Showdown.js library to convert the Markdown summary into HTML.
7.  The resulting HTML summary is displayed in a dedicated container injected into the YouTube page's secondary column.

This container features an "X" close button in the top-right corner. The extension also includes a theme toggle (Light/Dark) accessible via a popup window when clicking the extension's toolbar icon. The chosen theme is saved and applied to the button and summary container.

## File Structure & Purpose

*   **`manifest.json`**:
    *   Defines the extension's metadata (name, version, description).
    *   Specifies necessary permissions (`activeTab`, `scripting`, `storage`) and host permissions (`https://generativelanguage.googleapis.com/` for Gemini API calls).
    *   Declares `background.js` as the service worker.
    *   Registers `libs/showdown.min.js`, `content.js`, and `styles.css` to be injected into YouTube watch pages (note: comments were removed as they are invalid in JSON).
    *   Defines icons and the browser action, linking it to `popup.html`.
*   **`background.js`**:
    *   Handles the core API interaction logic.
    *   Listens for `getSummary` messages from `content.js` containing the video URL.
    *   Calls the Supadata Transcript API to fetch the video transcript using a hardcoded API key (`SUPADATA_API_KEY`).
    *   If transcript fetch is successful, constructs a prompt using the transcript text and calls the Gemini API (`GEMINI_API_URL`) using a hardcoded API key (`GEMINI_API_KEY`).
    *   **IMPORTANT:** Hardcoding both `GEMINI_API_KEY` and `SUPADATA_API_KEY` is a significant security risk. These should be managed securely (e.g., via `chrome.storage` and an options page).
    *   Handles API responses, extracts the Markdown summary text from Gemini, and manages potential errors from both API calls.
    *   Sends the Markdown summary (or error message) back to `content.js`.
*   **`content.js`**:
    *   Responsible for interacting with the YouTube page's DOM.
    *   Injects the "✨ Summarize" button near the like/dislike buttons.
    *   Injects a `div` container (`#youtube-summary-container-ext`) into the secondary column to display the summary. This container is initially hidden and includes an "X" close button in the top-right corner.
    *   Handles clicks on the "Summarize" button, displays a loading state, and sends the video URL to `background.js`.
    *   Receives the Markdown summary (or error message) from `background.js`.
    *   Uses the bundled Showdown library (`libs/showdown.min.js`) to convert the received Markdown summary into HTML.
    *   Displays the generated HTML (or error message) in the summary container.
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

*   **Chrome Extension APIs:** Manifest V3, Service Workers (`background.js`), Content Scripts (`content.js`), Popups (`action.default_popup`), `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, `chrome.storage.sync`, `chrome.tabs.query`, `chrome.tabs.sendMessage`, DOM manipulation.
*   **Web APIs:** `fetch`, `MutationObserver`, DOM manipulation (`document.querySelector`, `createElement`, `appendChild`, `insertBefore`, event listeners), CSS Variables, `element.classList`.
*   **External APIs:**
    *   Google Gemini API (`generativelanguage.googleapis.com`)
    *   Supadata Transcript API (`api.supadata.ai`)
*   **Libraries:** Showdown.js (for Markdown rendering).
*   **Languages:** JavaScript, HTML, CSS, JSON.
*   **Security:** Explicitly notes the significant risk of hardcoding API keys (`GEMINI_API_KEY`, `SUPADATA_API_KEY`).

## Potential Improvements (from `ideas.md`)

*   Better UI/UX for the close button (Implemented: "X" button added).
*   Dark mode support (Implemented: Theme toggle added).
*   Proper Markdown rendering for summaries (Implemented: Using Showdown.js).
*   Secure API key handling (High Priority - currently hardcoded).
