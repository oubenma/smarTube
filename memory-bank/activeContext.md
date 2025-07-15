# Active Context: SmarTube Chrome Extension

## Current Work Focus
The primary focus of the SmarTube Chrome Extension is to provide YouTube video summarization and Q&A capabilities directly within the YouTube watch page. This involves seamless UI injection, robust handling of dynamic YouTube navigation, secure API key management, and effective communication between extension components.

## Recent Changes / Implementations
Based on the `context.md` file, several key features and improvements have already been implemented:
- **UI/UX Enhancements:** Sticky header with settings button, header click to collapse/expand body/footer.
- **Enhanced Theme Support:** Auto/Light/Dark options, with "Auto" matching YouTube's theme.
- **Proper Markdown Rendering:** Integration of Showdown.js for summaries and Q&A answers.
- **Secure API Key Handling:** API keys are managed via the options page and stored in `chrome.storage.sync`. This includes enhanced management for Supadata with multiple key support and cycling logic.
- **Initial Container State:** The container now shows with a "Show Summary" button initially.
- **Q&A Feature:** Implemented with a fixed footer, input field, send button, and chat-like display.
- **Font Size Customization:** For answers within the container.
- **Improved Arabic Language Support:** Text alignment and display.
- **Direct Options Page Access:** Clicking the extension icon now directly opens the options page.
- **Robust Video Navigation Handling:** Utilizes History API listeners, video ID tracking, and MutationObserver for proper cleanup and reinjection of the container when navigating between videos.

## Next Steps
The current task is to read the `context.md` file and populate the memory bank. Having completed the initial core files, the next step is to create the `progress.md` file to document the current status and what's left to build.

## Active Decisions and Considerations
- The extension relies heavily on the YouTube DOM structure; future YouTube updates could potentially break the UI injection or navigation detection. The `MutationObserver` is a key mitigation for this.
- The Supadata API key cycling mechanism is crucial for maintaining service availability given potential rate limits. It has been refined to only deactivate a Supadata API key if the error message explicitly indicates a rate limit, rather than for all API errors.
- Security of API keys via `chrome.storage.sync` is a critical design choice.
- The Python backend in `api/` is currently not used by the extension's core flow, which directly uses the Supadata API. This might be a point for future consideration if alternative transcript sources are needed.