(function() {
  if (document.getElementById('claude-sidebar')) return;

  // State machine
  const PHASES = {
    DETECT: 'detect',      // Waiting for user to open compose/email
    CHAT: 'chat',          // Chatting with Claude (can send multiple messages)
    SENDING: 'sending',    // API call in progress
    DONE: 'done'           // Inserted into email
  };

  let currentPhase = PHASES.DETECT;
  let apiKey = '';
  let conversationHistory = [];
  let lastResponse = '';
  let lastSubject = '';
  let emailMode = null;
  let hasResponse = false;
  let userStyleProfile = '';

  function getSystemPrompt() {
    let prompt = `You are a professional email assistant integrated into Gmail. Your role is to help users write and improve emails.

FORMATTING RULES:
- When writing a NEW email (compose mode), ALWAYS start your response with a subject line in this exact format:
  Subject: [your subject here]

  [email body here]

- When writing a REPLY to an existing email, do NOT include a subject line. Just provide the reply body directly.

- Never include greetings like "Here's your email:" or "Sure, here you go" - just provide the email content directly.

STYLE GUIDELINES:
- Match the tone requested by the user (formal, casual, friendly, etc.)
- Keep emails concise and professional unless asked otherwise
- Use appropriate greetings and sign-offs based on context
- If the user provides a draft, preserve their voice while improving clarity and grammar

When improving an existing draft:
- Fix grammar and spelling
- Improve clarity and flow
- Maintain the original intent and tone
- For compose mode, suggest a subject if one isn't provided

When the user asks for revisions:
- Apply their feedback to the previous version
- Only output the revised email, not explanations`;

    if (userStyleProfile) {
      prompt += `

USER'S PERSONAL WRITING STYLE:
${userStyleProfile}

IMPORTANT: Always write emails in this user's personal style. Match their tone, vocabulary, sentence structure, and mannerisms as closely as possible.`;
    }

    return prompt;
  }

  const sidebar = document.createElement('div');
  sidebar.id = 'claude-sidebar';
  sidebar.innerHTML = `
    <div id="claude-resize-handle"></div>
    <div id="claude-sidebar-header">
      <div class="header-title">
        <span class="header-icon">&#9679;</span>
        <h3>Claude</h3>
      </div>
      <button id="claude-toggle-btn" title="Minimize">&minus;</button>
    </div>
    <div class="sidebar-content">
      <div id="claude-api-section">
        <div class="api-label">API Key</div>
        <div class="api-input-row">
          <input type="password" id="claude-api-key" placeholder="sk-ant-...">
          <button id="claude-save-key">Save</button>
        </div>
      </div>
      <div id="claude-style-section">
        <button id="claude-style-toggle" class="style-toggle">
          <span class="style-toggle-icon">▶</span> Learn My Writing Style
          <span id="style-status"></span>
        </button>
        <div id="claude-style-content" style="display: none;">
          <div id="style-consent" class="style-consent">
            <p>Claude can learn your writing style by reading your sent emails.</p>
            <p class="style-privacy">Your emails are only sent to Claude's API for analysis and are not stored anywhere else.</p>
            <button id="claude-scan-style" class="btn-analyze">Scan My Sent Emails</button>
          </div>
          <div id="style-scanning" style="display: none;">
            <div class="style-loading">Scanning your sent emails...</div>
          </div>
          <div id="style-result"></div>
          <div class="style-actions" style="display: none;" id="style-actions-row">
            <button id="claude-rescan-style" class="btn-analyze">Rescan</button>
            <button id="claude-clear-style" class="btn-clear-style">Clear Style</button>
          </div>
        </div>
      </div>
      <div id="claude-phase-indicator"></div>
      <div id="claude-messages"></div>
      <div id="claude-input-section">
        <textarea id="claude-input" placeholder="Your message to Claude..." disabled></textarea>
        <div id="claude-actions">
          <button id="claude-primary-btn" class="btn-primary"></button>
          <button id="claude-insert-btn" class="btn-secondary" style="display: none;">↑ Insert into Email</button>
        </div>
        <div id="claude-secondary-actions">
          <button id="claude-reset-btn" class="btn-text">Start Over</button>
        </div>
      </div>
    </div>
  `;

  const collapsedBtn = document.createElement('button');
  collapsedBtn.id = 'claude-collapsed-btn';
  collapsedBtn.textContent = 'Claude';
  collapsedBtn.onclick = () => {
    sidebar.classList.remove('collapsed');
    collapsedBtn.style.display = 'none';
  };

  document.body.appendChild(sidebar);
  document.body.appendChild(collapsedBtn);

  const messagesDiv = document.getElementById('claude-messages');
  const inputArea = document.getElementById('claude-input');
  const primaryBtn = document.getElementById('claude-primary-btn');
  const insertBtn = document.getElementById('claude-insert-btn');
  const resetBtn = document.getElementById('claude-reset-btn');
  const toggleBtn = document.getElementById('claude-toggle-btn');
  const apiKeyInput = document.getElementById('claude-api-key');
  const saveKeyBtn = document.getElementById('claude-save-key');
  const resizeHandle = document.getElementById('claude-resize-handle');
  const apiSection = document.getElementById('claude-api-section');
  const phaseIndicator = document.getElementById('claude-phase-indicator');
  const styleToggle = document.getElementById('claude-style-toggle');
  const styleContent = document.getElementById('claude-style-content');
  const scanStyleBtn = document.getElementById('claude-scan-style');
  const rescanStyleBtn = document.getElementById('claude-rescan-style');
  const clearStyleBtn = document.getElementById('claude-clear-style');
  const styleStatus = document.getElementById('style-status');
  const styleConsent = document.getElementById('style-consent');
  const styleScanning = document.getElementById('style-scanning');
  const styleResult = document.getElementById('style-result');
  const styleActionsRow = document.getElementById('style-actions-row');

  // Load saved API key
  browser.storage.local.get('claudeApiKey').then(result => {
    if (result.claudeApiKey) {
      apiKey = result.claudeApiKey;
      apiKeyInput.value = '••••••••••••••••';
      apiSection.style.display = 'none';
    }
  });

  // Load saved width
  browser.storage.local.get('sidebarWidth').then(result => {
    if (result.sidebarWidth) {
      sidebar.style.width = result.sidebarWidth + 'px';
    }
  });

  // Load saved style profile
  browser.storage.local.get('claudeStyleProfile').then(result => {
    if (result.claudeStyleProfile) {
      userStyleProfile = result.claudeStyleProfile;
      styleStatus.textContent = '✓ Active';
      styleStatus.className = 'style-active';
      styleConsent.style.display = 'none';
      styleResult.innerHTML = `<div class="style-success"><strong>Your style is active!</strong><br><br>${userStyleProfile.replace(/\n/g, '<br>')}</div>`;
      styleActionsRow.style.display = 'flex';
    }
  });

  // Style toggle
  styleToggle.addEventListener('click', () => {
    const isOpen = styleContent.style.display !== 'none';
    styleContent.style.display = isOpen ? 'none' : 'block';
    styleToggle.querySelector('.style-toggle-icon').textContent = isOpen ? '▶' : '▼';
  });

  // Function to grab sent emails from Gmail
  function grabSentEmails() {
    const emails = [];

    // Try to find sent emails in the current view
    // Gmail marks sent emails with specific data attributes
    const emailContainers = document.querySelectorAll('div[data-message-id]');

    emailContainers.forEach(container => {
      const bodyEl = container.querySelector('.a3s.aiL');
      if (bodyEl) {
        const text = bodyEl.textContent.trim();
        if (text.length > 50 && text.length < 5000) {
          emails.push(text);
        }
      }
    });

    // Also try to grab from expanded email threads
    const expandedEmails = document.querySelectorAll('.ii.gt div[dir="ltr"], .ii.gt div[dir="auto"]');
    expandedEmails.forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 50 && text.length < 5000 && !emails.includes(text)) {
        emails.push(text);
      }
    });

    return emails.slice(0, 5); // Return max 5 emails
  }

  // Scan and analyze style
  async function scanAndAnalyzeStyle() {
    if (!apiKey) {
      styleResult.innerHTML = '<div class="style-error">Please save your API key first.</div>';
      return;
    }

    styleConsent.style.display = 'none';
    styleScanning.style.display = 'block';
    styleResult.innerHTML = '';

    // First, try to grab emails from current view
    let emails = grabSentEmails();

    if (emails.length < 2) {
      // Not enough emails in current view - guide user
      styleScanning.style.display = 'none';
      styleConsent.style.display = 'block';
      styleResult.innerHTML = '<div class="style-error"><strong>Need more emails!</strong><br><br>Please open your <strong>Sent</strong> folder and click on a few emails to expand them, then try again.</div>';
      return;
    }

    styleScanning.querySelector('.style-loading').textContent = `Found ${emails.length} emails. Analyzing your style...`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Analyze the writing style of these email samples from the same person. Create a concise style guide (max 200 words) that captures:
- Tone and formality level
- Common phrases or greetings they use
- Sentence structure preferences (short/long, simple/complex)
- Any unique mannerisms, filler words, or patterns
- Sign-off style and signature patterns

Email samples:
${emails.map((e, i) => `--- Email ${i + 1} ---\n${e}`).join('\n\n')}

Respond with ONLY the style guide, no preamble. Be specific about their unique voice.`
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      userStyleProfile = data.content[0].text;
      browser.storage.local.set({ claudeStyleProfile: userStyleProfile });

      styleStatus.textContent = '✓ Active';
      styleStatus.className = 'style-active';
      styleScanning.style.display = 'none';
      styleResult.innerHTML = `<div class="style-success"><strong>Style learned from ${emails.length} emails!</strong><br><br>${userStyleProfile.replace(/\n/g, '<br>')}</div>`;
      styleActionsRow.style.display = 'flex';

    } catch (error) {
      styleScanning.style.display = 'none';
      styleConsent.style.display = 'block';
      styleResult.innerHTML = `<div class="style-error">Error: ${error.message}</div>`;
    }
  }

  // Scan button
  scanStyleBtn.addEventListener('click', scanAndAnalyzeStyle);
  rescanStyleBtn.addEventListener('click', () => {
    styleActionsRow.style.display = 'none';
    styleResult.innerHTML = '';
    styleConsent.style.display = 'block';
    scanAndAnalyzeStyle();
  });

  // Clear style
  clearStyleBtn.addEventListener('click', () => {
    userStyleProfile = '';
    browser.storage.local.remove('claudeStyleProfile');
    styleStatus.textContent = '';
    styleStatus.className = '';
    styleResult.innerHTML = '<div class="style-success">Style cleared. Claude will use default writing style.</div>';
    styleActionsRow.style.display = 'none';
    setTimeout(() => {
      styleResult.innerHTML = '';
      styleConsent.style.display = 'block';
    }, 2000);
  });

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key && !key.startsWith('••')) {
      apiKey = key;
      browser.storage.local.set({ claudeApiKey: key });
      apiKeyInput.value = '••••••••••••••••';
      apiSection.style.display = 'none';
      addMessage('API key saved!', 'system');
    }
  });

  // Drag to resize
  let isResizing = false;
  resizeHandle.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 280 && newWidth <= 800) {
      sidebar.style.width = newWidth + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      browser.storage.local.set({ sidebarWidth: parseInt(sidebar.style.width) });
    }
  });

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    collapsedBtn.style.display = 'block';
  });

  function addMessage(content, role) {
    const msg = document.createElement('div');
    msg.className = `claude-message ${role}`;
    msg.innerHTML = content;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (role === 'assistant' && content.length > 50) {
      const subjectMatch = content.match(/^Subject:\s*(.+?)(?:\n\n|\n)/i);
      if (subjectMatch) {
        lastSubject = subjectMatch[1].trim();
        lastResponse = content.replace(/^Subject:\s*.+?\n\n?/i, '').trim();
      } else {
        lastSubject = '';
        lastResponse = content;
      }
      hasResponse = true;
    }
  }

  function clearMessages() {
    messagesDiv.innerHTML = '';
  }

  function grabEmailContent() {
    const composeBody = document.querySelector('div[aria-label="Message Body"]');
    const subjectInput = document.querySelector('input[name="subjectbox"]');

    if (composeBody) {
      return {
        type: 'compose',
        content: composeBody.textContent.trim(),
        subject: subjectInput?.value || ''
      };
    }

    const emailContent = document.querySelector('div[data-message-id] .a3s.aiL');
    if (emailContent) {
      return { type: 'reply', content: emailContent.textContent.trim() };
    }

    return null;
  }

  function updatePhase(phase) {
    currentPhase = phase;

    // Update phase indicator
    const phases = [
      { key: PHASES.DETECT, label: '1. Detect' },
      { key: PHASES.CHAT, label: '2. Chat' },
      { key: 'insert', label: '3. Insert' }
    ];

    const currentIndex = phase === PHASES.DETECT ? 0 :
                         (phase === PHASES.CHAT || phase === PHASES.SENDING) ? 1 :
                         2;

    phaseIndicator.innerHTML = phases.map((p, i) => {
      let className = 'phase-step';
      if (i < currentIndex) className += ' completed';
      if (i === currentIndex) className += ' active';
      return `<div class="${className}">${p.label}</div>`;
    }).join('<div class="phase-connector"></div>');

    // Update UI based on phase
    switch (phase) {
      case PHASES.DETECT:
        inputArea.disabled = true;
        inputArea.value = '';
        inputArea.placeholder = 'Waiting for email...';
        primaryBtn.textContent = 'Detect Email';
        primaryBtn.disabled = false;
        insertBtn.style.display = 'none';
        resetBtn.style.visibility = 'hidden';
        hasResponse = false;
        clearMessages();
        addMessage('<strong>Step 1:</strong> Open a compose window or click on an email you want to reply to, then click the button below.', 'system');
        break;

      case PHASES.CHAT:
        inputArea.disabled = false;
        inputArea.placeholder = hasResponse ? 'Ask for changes or refinements...' : 'Describe what you want...';
        primaryBtn.textContent = 'Send →';
        primaryBtn.disabled = false;
        insertBtn.style.display = hasResponse ? 'block' : 'none';
        resetBtn.style.visibility = 'visible';
        break;

      case PHASES.SENDING:
        inputArea.disabled = true;
        primaryBtn.textContent = 'Sending...';
        primaryBtn.disabled = true;
        insertBtn.style.display = 'none';
        break;

      case PHASES.DONE:
        inputArea.disabled = true;
        inputArea.value = '';
        primaryBtn.textContent = 'Done!';
        primaryBtn.disabled = true;
        insertBtn.style.display = 'none';
        addMessage('<strong>Success!</strong> Your email has been updated. Click "Start Over" to draft another.', 'system');
        break;
    }
  }

  async function sendToClaudeAPI(userMessage) {
    if (!apiKey) {
      addMessage('Please enter your API key first.', 'error');
      apiSection.style.display = 'flex';
      updatePhase(PHASES.CHAT);
      return;
    }

    updatePhase(PHASES.SENDING);
    conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: getSystemPrompt(),
          messages: conversationHistory
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API request failed');
      }

      const data = await response.json();
      const reply = data.content[0].text;
      conversationHistory.push({ role: 'assistant', content: reply });
      addMessage(reply, 'assistant');
      updatePhase(PHASES.CHAT);

    } catch (error) {
      addMessage(`Error: ${error.message}`, 'error');
      conversationHistory.pop();
      if (error.message.includes('invalid') || error.message.includes('key')) {
        apiSection.style.display = 'flex';
      }
      updatePhase(PHASES.CHAT);
    }
  }

  function insertIntoEmail() {
    const composeBody = document.querySelector('div[aria-label="Message Body"]');
    if (!composeBody) {
      addMessage('Compose window not found. Please open it and try again.', 'error');
      return false;
    }

    if (lastSubject && emailMode === 'compose') {
      const subjectInput = document.querySelector('input[name="subjectbox"]');
      if (subjectInput && !subjectInput.value.trim()) {
        subjectInput.focus();
        subjectInput.value = lastSubject;
        subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    composeBody.focus();
    document.execCommand('insertText', false, lastResponse);
    return true;
  }

  // Primary button handler
  primaryBtn.addEventListener('click', async () => {
    switch (currentPhase) {
      case PHASES.DETECT:
        const grabbed = grabEmailContent();
        if (!grabbed) {
          addMessage('No email detected. Please open a compose window or click on an email first.', 'error');
          return;
        }

        emailMode = grabbed.type;
        clearMessages();

        if (grabbed.type === 'compose') {
          if (grabbed.content) {
            const text = grabbed.subject
              ? `Current subject: ${grabbed.subject}\n\nDraft:\n${grabbed.content}`
              : grabbed.content;
            inputArea.value = `[COMPOSE MODE] Help me improve this email draft:\n\n${text}`;
            addMessage('<strong>Step 2:</strong> Draft detected! Edit your request, send to Claude, and iterate until you\'re happy. Then click "Insert into Email".', 'system');
          } else if (grabbed.subject) {
            inputArea.value = `[COMPOSE MODE] Write an email with this subject: ${grabbed.subject}`;
            addMessage('<strong>Step 2:</strong> Subject detected! Describe what you want, chat with Claude to refine it, then insert when ready.', 'system');
          } else {
            inputArea.value = `[COMPOSE MODE] Write an email about: `;
            addMessage('<strong>Step 2:</strong> Compose window detected! Describe what you want to write. You can go back and forth with Claude until it\'s perfect.', 'system');
          }
        } else {
          inputArea.value = `[REPLY MODE] Help me write a reply to this email:\n\n${grabbed.content}`;
          addMessage('<strong>Step 2:</strong> Email captured! Ask Claude for a reply, refine it with follow-up messages, then insert when you\'re happy.', 'system');
        }

        updatePhase(PHASES.CHAT);
        inputArea.focus();
        break;

      case PHASES.CHAT:
        const text = inputArea.value.trim();
        if (!text) {
          addMessage('Please enter a message first.', 'error');
          return;
        }
        addMessage(text, 'user');
        inputArea.value = '';
        await sendToClaudeAPI(text);
        break;
    }
  });

  // Insert button handler
  insertBtn.addEventListener('click', () => {
    if (insertIntoEmail()) {
      updatePhase(PHASES.DONE);
    }
  });

  // Allow Ctrl+Enter to send
  inputArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && currentPhase === PHASES.CHAT) {
      primaryBtn.click();
    }
  });

  // Reset button
  resetBtn.addEventListener('click', () => {
    conversationHistory = [];
    lastResponse = '';
    lastSubject = '';
    emailMode = null;
    hasResponse = false;
    updatePhase(PHASES.DETECT);
  });

  // Initialize
  updatePhase(PHASES.DETECT);

})();
