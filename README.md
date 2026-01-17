# Gmail Claude Assistant

A Firefox extension that adds a Claude AI sidebar to Gmail for drafting and improving emails.

## Demo

https://github.com/user-attachments/assets/YOUR_VIDEO_ID_HERE

## Features

- Compose new emails or reply to existing ones with AI assistance
- Iterative chat - refine drafts until satisfied
- Style learning - scans sent emails via Gmail API to learn your writing voice
- One-click insert into Gmail compose fields
- Resizable sidebar with dark theme

## Architecture

```
gmail-claude-extension/
├── manifest.json    # Extension config, permissions, content script registration
├── background.js    # OAuth2 flow, Gmail API calls (runs in extension context)
├── content.js       # Sidebar UI, state machine, Claude API calls (injected into Gmail)
└── sidebar.css      # Catppuccin-themed dark UI
```

### Component Communication

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   content.js    │     │  background.js  │     │   External   │
│   (Gmail DOM)   │     │   (Extension)   │     │    APIs      │
└────────┬────────┘     └────────┬────────┘     └──────┬───────┘
         │                       │                     │
         │  browser.runtime      │                     │
         │  .sendMessage()       │                     │
         │ ─────────────────────>│                     │
         │                       │                     │
         │                       │  Gmail API          │
         │                       │  (OAuth2 token)     │
         │                       │ ───────────────────>│
         │                       │                     │
         │                       │  Sent emails        │
         │                       │<────────────────────│
         │  emails[]             │                     │
         │<──────────────────────│                     │
         │                       │                     │
         │  Claude API           │                     │
         │  (direct fetch)       │                     │
         │ ───────────────────────────────────────────>│
         │                       │                     │
```

### Key Files

**manifest.json**
- Manifest V2 (Firefox)
- Permissions: `storage`, `identity`, `clipboardWrite`, Gmail API, Claude API
- Content script injected on `mail.google.com`

**background.js**
- `authorize()` - OAuth2 implicit flow via `browser.identity.launchWebAuthFlow()`
- `fetchSentEmails()` - Gets messages from SENT label, extracts body, strips quoted text
- `getHeader()` / `stripQuotedText()` - Filters to only user's own writing

**content.js**
- State machine: `DETECT → CHAT → SENDING → DONE`
- `getSystemPrompt()` - Builds prompt with optional style profile
- `detectEmail()` - Scrapes Gmail DOM for compose/reply context
- `insertIntoEmail()` - Injects response into Gmail compose fields
- Message passing to background.js for OAuth operations

**sidebar.css**
- Fixed position sidebar (400px default, resizable)
- Catppuccin Mocha color palette

### OAuth2 Flow

Uses implicit grant flow for browser extensions:
1. `browser.identity.launchWebAuthFlow()` opens Google consent screen
2. Redirect URI is extension-specific (`https://[id].extensions.allizom.org/`)
3. Access token extracted from URL fragment
4. Token stored in memory (not persisted), expires in 1 hour

### Style Learning

1. Fetches up to 50 sent emails via Gmail API
2. Filters by From header to ensure only user's emails
3. Strips quoted replies (`>` lines, "On X wrote:" blocks, forwarded headers)
4. Sends to Claude for style analysis
5. Style profile stored in `browser.storage.local`, injected into system prompt

## Development

Load temporarily via `about:debugging#/runtime/this-firefox`

Requires:
- Claude API key (console.anthropic.com)
- Google Cloud OAuth client ID (for style learning feature)

## License

MIT
