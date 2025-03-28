# Project Context: YouTube Summarizer (Gemini) Chrome Extension

This project is a Chrome browser extension designed to summarize YouTube videos using Google's Gemini AI.

## Core Functionality

The extension injects a "✨ Summarize" button onto YouTube video watch pages (`youtube.com/watch*`). When clicked, it sends the video's URL to a background script, which then queries the Gemini API (specifically `gemini-1.5-flash-latest` by default) with a prompt asking for a detailed summary. The returned summary is then displayed in a dedicated container injected into the YouTube page's secondary column (where related videos usually appear).

## File Structure & Purpose

*   **`manifest.json`**:
    *   Defines the extension's metadata (name, version, description).
    *   Specifies necessary permissions (`activeTab`, `scripting`) and host permissions (`https://generativelanguage.googleapis.com/` for API calls).
    *   Declares `background.js` as the service worker.
    *   Registers `content.js` and `styles.css` to be injected into YouTube watch pages.
    *   Defines icons and a basic browser action (currently not implemented with a popup).
*   **`background.js`**:
    *   Contains the core logic for interacting with the Gemini API.
    *   Listens for messages from `content.js` containing the video URL.
    *   **IMPORTANT:** Currently holds a hardcoded Gemini API key (`GEMINI_API_KEY`). This is a significant security risk and should be replaced with a secure method like `chrome.storage` or an options page for user input.
    *   Constructs the API request payload, including the prompt and generation configuration (temperature, max tokens).
    *   Uses `fetch` to call the Gemini API endpoint.
    *   Handles API responses, extracts the summary text, and manages potential errors.
    *   Sends the summary (or error message) back to `content.js`.
*   **`content.js`**:
    *   Responsible for interacting with the YouTube page's DOM.
    *   Injects the "✨ Summarize" button near the like/dislike buttons.
    *   Injects a `div` container (`#youtube-summary-container-ext`) into the secondary column to display the summary. This container is initially hidden and includes basic styling, scrollbars, a title, and a "Close" button.
    *   Handles clicks on the "Summarize" button, displays a loading state, and sends the video URL to `background.js`.
    *   Receives the response from `background.js` and displays the summary or error message in the container div.
    *   Uses a `MutationObserver` to handle YouTube's single-page application nature, ensuring the button is re-injected when navigating between videos without a full page reload.
*   **`styles.css`**:
    *   Contains minimal CSS rules. Most styling for the injected elements is handled via inline styles within `content.js`. Includes some basic scrollbar styling.
*   **`icons/`**:
    *   Contains the extension's icons (`icon16.png`, `icon48.png`, `icon128.png`) used in the browser toolbar and extensions page.
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

*   **Chrome Extension APIs:** Manifest V3, Service Workers (`background.js`), Content Scripts (`content.js`), `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, DOM manipulation.
*   **Web APIs:** `fetch`, `MutationObserver`, DOM manipulation (`document.querySelector`, `createElement`, `appendChild`, `insertBefore`, event listeners).
*   **External API:** Google Gemini API (`generativelanguage.googleapis.com`).
*   **Languages:** JavaScript, HTML (within JS), CSS, JSON.
*   **Security:** Explicitly notes the risk of hardcoding API keys.

## Potential Improvements (from `ideas.md`)

*   Better UI/UX for the close button.
*   Dark mode support.
*   Proper Markdown rendering for summaries.
*   Secure API key handling (implied by warnings in `background.js` and `temp.md`).
