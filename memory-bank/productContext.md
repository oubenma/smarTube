# Product Context: SmarTube Chrome Extension

## Problem Solved
The SmarTube Chrome Extension addresses the common problem of information overload and time consumption associated with watching lengthy YouTube videos. Users often need to quickly understand the core content of a video or find specific answers without investing the time to watch the entire duration.

## How it Works
The extension injects a dynamic summary container into the YouTube video watch page. This container provides:
1.  **Video Summarization:** On user request, it fetches the video transcript and uses Google's Gemini AI to generate a concise summary, displayed directly on the page.
2.  **Q&A Interface:** Users can type questions into a dedicated input field, and the extension will provide answers based *only* on the video's transcript, leveraging Gemini AI.

## User Experience Goals
- **Seamless Integration:** The summary container should appear naturally within the YouTube interface (secondary column) and be responsive to dynamic page navigation (e.g., navigating between videos without page reload).
- **Intuitive Interaction:** Users should easily be able to toggle the container's visibility, trigger summaries, and ask questions.
- **Customization:** Users can personalize their experience by setting API keys, choosing themes (Auto/Light/Dark), and defining the container's initial collapsed state via a dedicated options page.
- **Reliability:** The extension should handle API key management robustly, including cycling through multiple Supadata keys to mitigate rate limits and ensure continuous service.
- **Accessibility:** The options page and injected UI should support dark mode and maintain readability and proper contrast.

## Core Features
- **Injected Summary Container:** `#youtube-summary-container-ext` in the YouTube secondary column.
- **Sticky Header:** "Video Summary" title, settings (⚙️) button, and collapse/expand functionality on header click.
- **"Show Summary" Button:** Triggers summary generation, replaced by loading message, then Markdown-rendered HTML summary.
- **Sticky Footer:** Q&A textarea input ("Ask about this video...") and send button (➤).
- **Chat-like Q&A Display:** User questions and AI answers appended to the container body.
- **Dynamic Navigation Handling:** Detects URL changes (History API, MutationObserver) to clear and reinject the container for new videos.
- **Options Page:**
    - Gemini API key input.
    - Supadata API key management (add, list, activate, delete, rate-limit indicator).
    - Language selection for summaries.
    - Theme selection (Auto/Light/Dark).
    - Initial container collapse state setting.
- **Theme Support:** Auto-sync with system, consistent dark theme, CSS variables, smooth transitions, proper contrast.
- **API Key Security:** Keys stored securely in `chrome.storage.sync`.
- **Showdown.js Integration:** For Markdown to HTML conversion.