// Gmail OAuth2 Background Script

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1';

let accessToken = null;
let clientId = null;

// Load saved client ID
browser.storage.local.get('googleClientId').then(result => {
  if (result.googleClientId) {
    clientId = result.googleClientId;
  }
});

// Get redirect URL for OAuth
function getRedirectURL() {
  return browser.identity.getRedirectURL();
}

// OAuth2 authorization
async function authorize() {
  if (!clientId) {
    throw new Error('NO_CLIENT_ID');
  }

  const redirectURL = getRedirectURL();
  const authURL = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  authURL.searchParams.set('client_id', clientId);
  authURL.searchParams.set('redirect_uri', redirectURL);
  authURL.searchParams.set('response_type', 'token');
  authURL.searchParams.set('scope', SCOPES);
  authURL.searchParams.set('prompt', 'consent');

  try {
    const responseURL = await browser.identity.launchWebAuthFlow({
      url: authURL.toString(),
      interactive: true
    });

    // Extract access token from response URL
    const url = new URL(responseURL);
    const params = new URLSearchParams(url.hash.substring(1));
    accessToken = params.get('access_token');

    if (!accessToken) {
      throw new Error('No access token in response');
    }

    return { success: true };
  } catch (error) {
    console.error('OAuth error:', error);
    throw error;
  }
}

// Fetch sent emails from Gmail API
async function fetchSentEmails(maxResults = 50) {
  if (!accessToken) {
    throw new Error('NOT_AUTHORIZED');
  }

  try {
    // Get list of sent messages
    const listResponse = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?labelIds=SENT&maxResults=${maxResults}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (listResponse.status === 401) {
      accessToken = null;
      throw new Error('TOKEN_EXPIRED');
    }

    if (!listResponse.ok) {
      throw new Error('Failed to fetch message list');
    }

    const listData = await listResponse.json();

    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    // Get user's email address to filter only their sent emails
    const profileResponse = await fetch(
      `${GMAIL_API_BASE}/users/me/profile`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    let userEmail = '';
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      userEmail = profile.emailAddress.toLowerCase();
    }

    // Fetch full content of each message (up to 50 for better style analysis)
    const messagesToFetch = listData.messages.slice(0, 50);
    const emails = [];

    for (const msg of messagesToFetch) {
      try {
        const msgResponse = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=full`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (msgResponse.ok) {
          const msgData = await msgResponse.json();

          // Verify this email is FROM the user (not just in their sent folder)
          const fromHeader = getHeader(msgData.payload, 'From') || '';
          const isFromUser = userEmail && fromHeader.toLowerCase().includes(userEmail);

          if (!isFromUser && userEmail) {
            continue; // Skip emails not actually sent by user
          }

          const body = extractEmailBody(msgData);
          const cleanBody = stripQuotedText(body); // Remove quoted replies

          if (cleanBody && cleanBody.length > 20 && cleanBody.length < 10000) {
            emails.push(cleanBody);
          }
        }
      } catch (e) {
        console.error('Error fetching message:', e);
      }
    }

    return emails;
  } catch (error) {
    console.error('Gmail API error:', error);
    throw error;
  }
}

// Extract email body from Gmail API response
function extractEmailBody(message) {
  const payload = message.payload;

  if (!payload) return null;

  // Try to get plain text body
  if (payload.body && payload.body.data) {
    return decodeBase64(payload.body.data);
  }

  // Check parts for text/plain
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBase64(part.body.data);
      }
    }

    // Fall back to text/html if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const html = decodeBase64(part.body.data);
        return stripHtml(html);
      }
    }

    // Check nested parts (multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body && subpart.body.data) {
            return decodeBase64(subpart.body.data);
          }
        }
      }
    }
  }

  return null;
}

// Decode base64url encoded string
function decodeBase64(data) {
  try {
    // Replace URL-safe characters
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    return null;
  }
}

// Strip HTML tags
function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

// Get email header value
function getHeader(payload, headerName) {
  if (!payload || !payload.headers) return null;
  const header = payload.headers.find(h => h.name.toLowerCase() === headerName.toLowerCase());
  return header ? header.value : null;
}

// Strip quoted text from email replies (remove other people's words)
function stripQuotedText(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const cleanLines = [];
  let inQuotedBlock = false;

  for (const line of lines) {
    // Skip lines that start with ">" (quoted replies)
    if (line.trim().startsWith('>')) {
      inQuotedBlock = true;
      continue;
    }

    // Skip "On [date], [person] wrote:" lines
    if (/^On .+ wrote:$/i.test(line.trim())) {
      inQuotedBlock = true;
      continue;
    }

    // Skip "From: / Sent: / To: / Subject:" header blocks in forwarded emails
    if (/^(From|Sent|To|Subject|Date|Cc):/.test(line.trim())) {
      continue;
    }

    // Skip separator lines like "---------- Forwarded message ---------"
    if (/^-{3,}/.test(line.trim()) && line.includes('Forward')) {
      inQuotedBlock = true;
      continue;
    }

    // If we hit quoted content, stop processing (everything after is likely quoted)
    if (inQuotedBlock && line.trim() === '') {
      continue;
    }

    if (!inQuotedBlock) {
      cleanLines.push(line);
    }
  }

  return cleanLines.join('\n').trim();
}

// Message handler
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getRedirectURL') {
    sendResponse({ redirectURL: getRedirectURL() });
    return false;
  }

  if (message.action === 'setClientId') {
    clientId = message.clientId;
    browser.storage.local.set({ googleClientId: clientId });
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'checkAuth') {
    sendResponse({
      hasClientId: !!clientId,
      isAuthorized: !!accessToken
    });
    return false;
  }

  if (message.action === 'authorize') {
    authorize()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({
        success: false,
        error: error.message
      }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'fetchEmails') {
    fetchSentEmails(message.maxResults || 20)
      .then(emails => sendResponse({ success: true, emails }))
      .catch(error => sendResponse({
        success: false,
        error: error.message
      }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'logout') {
    accessToken = null;
    sendResponse({ success: true });
    return false;
  }
});
