# Project Brief: SmarTube Chrome Extension

## Core Purpose
This Chrome browser extension is designed to enhance the YouTube video watching experience by providing AI-powered summarization and Q&A capabilities. It aims to help users quickly grasp video content and get specific answers without watching the entire video.

## Key Goals
- **Video Summarization:** Generate concise summaries of YouTube videos using Google's Gemini AI.
- **Q&A Interface:** Allow users to ask questions about video content and receive answers based on the video transcript.
- **Seamless Integration:** Inject a summary container directly into the YouTube watch page, ensuring it is always visible and responsive to navigation.
- **User Customization:** Provide options for API key management (Gemini, Supadata), theme selection (Auto/Light/Dark), and container behavior (collapsed state).
- **Robust API Key Management:** Implement a system for managing multiple Supadata API keys, including automatic cycling on rate limits/errors.

## Target Audience
YouTube users who want to save time by quickly understanding video content or finding specific information within videos.

## Scope
The extension focuses on integrating with the YouTube watch page, fetching transcripts, interacting with AI models (Gemini), and presenting information in a user-friendly interface. It manages API keys securely via `chrome.storage.sync` and handles dynamic YouTube navigation.

## Licensing
The project uses the MIT License with Commons Clause, allowing free non-commercial use. Commercial use requires explicit written permission and is subject to restrictions on commercial advantage, product integration, or business analysis.