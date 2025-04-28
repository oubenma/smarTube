# Plan: YouTube Summarizer - Q&A Feature

**Goal:** Add a fixed footer bar with a textarea and send button to the summary container. Sending a question (via button or Enter key, Shift+Enter for newline) should append the question and then the AI's answer (based on the transcript) to the container's body in a chat format.

**Proposed Changes:**

1.  **Modify `content.js`:**
    *   **`injectSummaryDivContainer`:**
        *   Append a new footer div (`#summary-footer-ext`) to the main container (`#youtube-summary-container-ext`).
        *   Inside the footer, add a textarea (`<textarea id="qa-input-ext" rows="1">` with placeholder "Ask anything about this video...") and a send button (`#qa-send-btn-ext` with a send icon like ➤).
        *   Add a `keydown` event listener to the textarea (`#qa-input-ext`). Inside, check if `event.key === 'Enter'`. If it is, check `!event.shiftKey`. If Enter is pressed *without* Shift, prevent default newline insertion and trigger `handleQuestionSubmit`.
        *   Add a `click` event listener to the send button (`#qa-send-btn-ext`) that also triggers `handleQuestionSubmit`.
    *   **New `handleQuestionSubmit` function:**
        *   Gets the text from `#qa-input-ext`.
        *   If the text is not empty:
            *   Clears the `#qa-input-ext` field.
            *   Calls `appendMessage(questionText, 'user')` to display the user's question.
            *   Calls `appendMessage('Thinking...', 'assistant', 'thinking-placeholder')` to show the loading state.
            *   Gets the current video URL.
            *   Sends a new message `{ action: "askQuestion", question: questionText, url: videoUrl }` to `background.js`.
    *   **New `appendMessage(htmlContent, role, id = null)` function:**
        *   Creates a new div (e.g., `<div class="message ${role}-message">`).
        *   Sets its `innerHTML`.
        *   Assigns the optional `id` (used for the 'Thinking...' placeholder).
        *   Appends the new div to the `#summary-body-ext`.
        *   Scrolls the `#summary-body-ext` to the bottom to ensure the new message is visible.
    *   **Update `chrome.runtime.onMessage.addListener`:**
        *   Add a handler for a new message action, e.g., `answerResponse`.
        *   When an answer (or error) is received:
            *   Find the placeholder element (`#thinking-placeholder`).
            *   If found, update its content with the answer/error, remove the ID, and ensure it has the `assistant-message` class.
            *   Scroll the body to the bottom again.
    *   **Modify `displaySummary` and `handleShowSummaryClick`:**
        *   When the initial summary is generated, instead of replacing the body's `innerHTML`, use `appendMessage` to add the "Generating summary..." message and then replace/update that message with the actual summary using the `assistant-message` style. This maintains the chat flow.

2.  **Modify `background.js`:**
    *   **`chrome.runtime.onMessage.addListener`:**
        *   Add an `else if` block for the `askQuestion` action.
        *   This block will:
            *   Retrieve necessary API keys (`geminiApiKey`, `supadataApiKey`).
            *   Call `getTranscript` to fetch the transcript.
            *   If transcript fetch is successful, call a *new* function `callGeminiForQuestion(transcript, question, geminiApiKey)`.
            *   Send the result back to `content.js` using the `answerResponse` action, including either the `answer` or an `error`.
            *   Return `true` to indicate an asynchronous response.
    *   **New `callGeminiForQuestion(transcriptText, question, geminiApiKey)` function:**
        *   Constructs a specific prompt for Gemini, instructing it to answer the `question` based *only* on the provided `transcriptText`.
        *   Makes the `fetch` call to the Gemini API using this new prompt.
        *   Parses the response to extract the answer text.
        *   Returns the answer text or throws an error.

3.  **Modify `styles.css`:**
    *   Add styles for the fixed footer (`#summary-footer-ext`): `position: sticky`, `bottom: 0`, background, padding, border-top, flexbox layout for input and button.
    *   Style the textarea (`#qa-input-ext`): `flex-grow: 1`, `resize: none;`, `overflow-y: auto;`, border, padding, height, line-height.
    *   Style the send button (`#qa-send-btn-ext`): remove default button styles, set background/color, padding, cursor.
    *   Add styles for chat messages (`.message`, `.user-message`, `.assistant-message`): margin, padding, background colors, border-radius to create distinct "bubbles".
    *   Style the `.thinking-placeholder` state.
    *   Adjust `#summary-body-ext`'s `padding-bottom` and/or `max-height` calculation to prevent the fixed footer from overlapping the last message.

**Visual Flow Update (Mermaid):**

```mermaid
graph TD
    subgraph Page Interaction
        A[Page Load / Navigation] --> B{Container Exists?};
        B -- No --> C[Inject Container: Header + Body + Footer (Textarea+Send)];
        C --> D[Set Initial Body: 'Show Summary' Btn];
        D --> E[Container Visible];
        B -- Yes --> E;
    end

    subgraph Summary Generation
        E -- Click 'Show Summary' --> F[Get Video URL];
        F --> G[Replace Btn in Body w/ Loading Msg (assistant message)];
        G --> H[Send 'getSummary' to background.js];
        H --> I{Receive Response};
        I -- Summary --> J[Replace Loading Msg w/ Summary (assistant message)];
        I -- Error --> K[Replace Loading Msg w/ Error (assistant message)];
    end

    subgraph Q&A Interaction
        E -- Type Question & Send (Enter/Button) --> L[Get Question Text];
        J -- Type Question & Send (Enter/Button) --> L;
        K -- Type Question & Send (Enter/Button) --> L;
        L --> M[Clear Textarea];
        M --> N[Append Question (user message) to Body];
        N --> O[Append 'Thinking...' (assistant message placeholder) to Body];
        O --> P[Send 'askQuestion' to background.js];
        P --> Q{Receive Response};
        Q -- Answer --> R[Replace 'Thinking...' w/ Answer (assistant message)];
        Q -- Error --> S[Replace 'Thinking...' w/ Error (assistant message)];
    end

    subgraph Container Control
         E -- Click Header/Minimize --> T{Toggle Body Visibility};
         J -- Click Header/Minimize --> T;
         K -- Click Header/Minimize --> T;
         R -- Click Header/Minimize --> T;
         S -- Click Header/Minimize --> T;
         T --> E;

         E -- Click Settings --> U[Open Options Page];
         J -- Click Settings --> U;
         K -- Click Settings --> U;
         R -- Click Settings --> U;
         S -- Click Settings --> U;
    end

    style C fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#ccf,stroke:#333,stroke-width:2px
    style O fill:#ccf,stroke:#333,stroke-width:2px
    style T fill:#ffc,stroke:#333,stroke-width:2px
    style U fill:#fcc,stroke:#333,stroke-width:2px