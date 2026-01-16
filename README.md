# Gmail Claude Assistant

A Firefox extension that integrates Claude AI directly into Gmail for drafting and improving emails.

![Extension Preview](preview.png)

## Features

- **Compose Mode**: Write new emails with AI-generated subject lines and body
- **Reply Mode**: Get help crafting replies to emails you're viewing
- **Iterative Chat**: Go back and forth with Claude until you're happy with the result
- **Learn Your Style**: Paste a few emails you've written and Claude learns to write like you
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

### Teaching Claude Your Style
1. Open your **Sent** folder in Gmail
2. Click on a few emails to expand them (2-5 emails work best)
3. Click **"Learn My Writing Style"** in the sidebar
4. Click **"Scan My Sent Emails"**
5. Claude automatically reads and analyzes your writing style
6. All future emails will be written in your personal style
7. Click **"Clear Style"** anytime to return to default

## Privacy

- Your API key is stored locally in Firefox's extension storage
- Emails are sent only to Anthropic's API for processing
- Style analysis reads emails only when you click "Scan" - requires explicit consent
- Your style profile is stored locally and included in API requests
- No data is collected or sent anywhere except Anthropic's API

## Development

### Project Structure
```
gmail-claude-extension/
├── manifest.json    # Extension configuration
├── content.js       # Main logic (injected into Gmail)
├── sidebar.css      # Styling
└── README.md        # This file
```

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
