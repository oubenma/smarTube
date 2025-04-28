# Plan: YouTube Summarizer - Summary Container Revamp

**Goal:** Modify the extension so the summary container is always visible upon injection. Initially, it will contain a "Show Summary" button. Clicking this button will trigger the summary generation and display the result within the same container, replacing the button. The container will have a fixed header bar that toggles the visibility of the content body.

**Revised Plan:**

1.  **Modify `content.js`:**
    *   **`injectSummaryDivContainer` function:**
        *   Ensure the main container (`#youtube-summary-container-ext`) is visible by default.
        *   Structure the `innerHTML`:
            *   Create a header div (`#summary-header-ext`) containing the title (`<span>Video Summary</span>`) and the close button (`#close-summary-x-btn`).
            *   Create a body div (`#summary-body-ext`) below the header, initially containing the "Show Summary" button (`#show-summary-btn-ext`).
        *   Add a click listener to `#summary-header-ext`. Inside the listener, check if the click target was *not* the close button. If it wasn't, toggle a class (e.g., `.collapsed`) on the main container or directly toggle the `display` style of `#summary-body-ext`.
        *   Keep the close button (`#close-summary-x-btn`) listener to hide the *entire* container.
        *   Add the click listener to `#show-summary-btn-ext` as previously planned.
    *   **`#show-summary-btn-ext` Click Listener:**
        *   When clicked, get the URL.
        *   Target `#summary-body-ext`.
        *   Replace the button inside `#summary-body-ext` with the loading message and the actual content area div (`#summary-content-ext`).
        *   Send the `getSummary` message.
    *   **`displaySummary` function:**
        *   Target `#summary-content-ext` (which is inside `#summary-body-body-ext`).
    *   **Remove Old Button Logic:** Proceed with removing the external "✨ Summarize" button logic.
    *   **Theme Application (`applyTheme`):** Ensure themes apply correctly to the header, body, and their contents.

2.  **Modify `styles.css`:**
    *   **Main Container (`#youtube-summary-container-ext`):** Style as needed (background, border, etc.). Set `position: relative;` and `overflow: hidden;` to manage the sticky header and scrolling body correctly.
    *   **Header (`#summary-header-ext`):**
        *   Style as a bar (padding, background).
        *   Use `position: sticky; top: 0; z-index: 1;` to make it stick.
        *   Use flexbox/grid for layout (title on left, button on right).
        *   Add `cursor: pointer;` to indicate clickability for collapsing.
    *   **Body (`#summary-body-ext`):**
        *   Set `overflow-y: auto;` to enable scrolling for summary content.
        *   Define a `max-height` or `height` to control the scrollable area size, potentially calculated relative to the container height minus the header height.
        *   Add padding.
    *   **Collapsed State:** Add a CSS rule like `#youtube-summary-container-ext.collapsed #summary-body-ext { display: none; }` or similar to handle the toggling.
    *   **New Button (`#show-summary-btn-ext`):** Style within the body.
    *   **Remove Old Styles:** Remove `#summarize-button-ext` styles.
    *   **Theme Styles:** Update dark theme rules for header, body, etc.

**Revised Visual Flow (Mermaid Diagram):**

```mermaid
graph TD
    subgraph Page Interaction
        A[Page Load / Navigation] --> B{Container Exists?};
        B -- No --> C[Inject Container (#youtube-summary-container-ext)];
        C --> D[Set Initial HTML: Sticky Header (Title + Close Btn) + Body (Show Summary Btn)];
        D --> E[Container Visible, Body Visible];
        B -- Yes --> E;
    end

    subgraph Summary Generation
        E -- Click 'Show Summary' --> F[Get Video URL];
        F --> G[Replace Button in Body with Loading Msg & Content Area];
        G --> H[Send 'getSummary' to background.js];
        H --> I{Receive Response};
        I -- Summary --> J[Render Summary in Content Area (inside Body)];
        I -- Error --> K[Display Error in Content Area (inside Body)];
    end

    subgraph Container Control
         E -- Click Header (not 'X') --> M{Toggle Body Visibility};
         J -- Click Header (not 'X') --> M;
         K -- Click Header (not 'X') --> M;
         M --> E;

         E -- Click Close Button 'X' --> L[Hide Entire Container];
         J -- Click Close Button 'X' --> L;
         K -- Click Close Button 'X' --> L;
         M -- Click Close Button 'X' --> L;
    end

    style C fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#ccf,stroke:#333,stroke-width:2px
    style L fill:#fcc,stroke:#333,stroke-width:2px
    style M fill:#ffc,stroke:#333,stroke-width:2px