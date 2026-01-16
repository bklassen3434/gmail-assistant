# Gmail Claude Assistant

A Firefox extension that integrates Claude AI directly into Gmail for drafting and improving emails.

![Extension Preview](preview.png)

## Features

- **Compose Mode**: Write new emails with AI-generated subject lines and body
- **Reply Mode**: Get help crafting replies to emails you're viewing
- **Iterative Chat**: Go back and forth with Claude until you're happy with the result
- **Learn Your Style**: Automatically scans your sent emails via Gmail API and learns your unique writing voice (filters out quoted replies to only analyze YOUR words)
- **One-Click Insert**: Automatically fills subject and body fields in Gmail
- **Resizable Sidebar**: Drag to adjust width, persists across sessions
- **Dark Theme**: Clean, modern UI that doesn't distract

## Installation

### From Mozilla Add-ons (Recommended)
1. Visit the [extension page on Mozilla Add-ons](#) *(link pending approval)*
2. Click "Add to Firefox"

### Manual Installation (Development)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select the `manifest.json` file from this directory
4. Navigate to Gmail to use the extension

## Setup

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Add billing credit ($5 minimum)
3. Open Gmail - the Claude sidebar will appear on the right
4. Enter your API key in the sidebar and click "Save"

## Usage

### Workflow
1. **Open an email** (to reply) or **click Compose** (for new email)
2. Click **"Detect Email"** - the extension captures context
3. **Edit your request** and click **"Send →"**
4. **Iterate** - ask for changes like "make it shorter" or "more formal"
5. When satisfied, click **"↑ Insert into Email"**

### Keyboard Shortcuts
- `Ctrl+Enter` / `Cmd+Enter`: Send message to Claude

### Teaching Claude Your Style (One-Time Google Cloud Setup)

The style learning feature uses the Gmail API to automatically read your sent emails. This requires a one-time Google Cloud setup:

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/projectcreate)
2. Create a new project (e.g., "Gmail Claude Assistant")

#### Step 2: Enable Gmail API
1. Go to [Gmail API Library](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
2. Select your project and click **Enable**

#### Step 3: Configure OAuth Consent Screen
1. Go to [OAuth Consent](https://console.cloud.google.com/apis/credentials/consent)
2. Choose **External**, click **Create**
3. Fill in app name and email fields
4. Add scope: `gmail.readonly`
5. Add yourself as a test user

#### Step 4: Create OAuth Credentials
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add redirect URI from the extension sidebar (shown in the setup section)
5. Copy the **Client ID**

#### Step 5: Use in Extension
1. Paste Client ID in the extension sidebar
2. Click **Connect Gmail & Scan**
3. Authorize with Google when prompted
4. Extension fetches your last 50 sent emails and learns your style!

Your style is saved locally - you only need to do this setup once. Click **"Clear Style"** anytime to return to default.

## Privacy

- **API Keys**: Your Claude API key and Google Client ID are stored locally in Firefox's extension storage
- **Email Processing**: Email content is sent to Anthropic's Claude API for drafting assistance
- **Style Learning**: Gmail API access is read-only (`gmail.readonly` scope) - we can only read, never modify your emails
- **OAuth Tokens**: Google access tokens are stored in memory only (not persisted) and expire after 1 hour
- **Style Profile**: Your writing style analysis is stored locally and included in API requests to Claude
- **No Data Collection**: No data is sent anywhere except Anthropic's API and Google's Gmail API (for style scanning only)

## Development

### Project Structure
```
gmail-claude-extension/
├── manifest.json    # Extension configuration & permissions
├── background.js    # OAuth2 handling & Gmail API calls
├── content.js       # UI logic (injected into Gmail)
├── sidebar.css      # Styling
└── README.md        # This file
```

### How It Works (Technical)

The extension uses a multi-component architecture:

**content.js** (Content Script)
- Injected into Gmail pages
- Creates and manages the sidebar UI
- Handles user interactions (detect email, send to Claude, insert)
- Communicates with background.js via message passing

**background.js** (Background Script)
- Handles OAuth2 authentication with Google
- Makes Gmail API requests (requires cross-origin permissions)
- Stores/retrieves access tokens
- Runs persistently to maintain auth state

**OAuth2 Flow:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  content.js │ --> │background.js│ --> │   Google    │
│  (sidebar)  │     │  (OAuth2)   │     │   OAuth2    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  "authorize"      │                   │
       │ ─────────────────>│                   │
       │                   │   launchWebAuth   │
       │                   │ ─────────────────>│
       │                   │                   │
       │                   │   access_token    │
       │                   │ <─────────────────│
       │                   │                   │
       │  "fetchEmails"    │                   │
       │ ─────────────────>│                   │
       │                   │   Gmail API       │
       │                   │ ─────────────────>│
       │                   │                   │
       │    emails[]       │   emails data     │
       │ <─────────────────│ <─────────────────│
       │                   │                   │
       │  Send to Claude   │                   │
       │  for analysis     │                   │
       └───────────────────┴───────────────────┘
```

**Why the Redirect URI matters:**
- Google OAuth requires whitelisted redirect URIs for security
- Firefox extensions have unique URIs like `https://abc123.extensions.allizom.org/`
- The extension generates this URI; you must add it to Google Cloud Console
- This prevents malicious sites from hijacking your OAuth tokens

### Local Development
1. Make changes to the source files
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Reload" next to the extension

## API Costs

This extension uses the Claude API which has usage-based pricing:
- Typical email interaction: ~$0.01-0.03
- Uses `claude-sonnet-4-20250514` model

See [Anthropic's pricing](https://www.anthropic.com/pricing) for details.

## License

MIT License - see [LICENSE](LICENSE) file.

## Contributing

Contributions welcome! Please open an issue or pull request.
