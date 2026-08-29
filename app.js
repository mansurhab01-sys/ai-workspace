// AI Workspace Frontend Logic - Mobile & Desktop Optimized

const state = {
  currentView: 'view-chat',
  activeChatId: 'chat_default',
  chats: [],
  gallery: [],
  isStreaming: false,
  isGeneratingArt: false,
  abortController: null,
  studio: {
    prompt: '',
    style: 'photorealism',
    aspectRatio: '1:1',
    model: 'flux-realism'
  },
  settings: {
    theme: 'dark'
  }
};

const elements = {
  tabNavChat: document.getElementById('tab-nav-chat'),
  tabNavStudio: document.getElementById('tab-nav-studio'),
  viewChat: document.getElementById('view-chat'),
  viewStudio: document.getElementById('view-studio'),
  chatList: document.getElementById('chat-list'),
  chatMessages: document.getElementById('chat-messages'),
  promptInput: document.getElementById('prompt-input'),
  btnSend: document.getElementById('btn-send'),
  btnStopStream: document.getElementById('btn-stop-stream'),
  btnNewChat: document.getElementById('btn-new-chat'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  welcomeScreen: document.getElementById('welcome-screen'),
  currentChatTitle: document.getElementById('current-chat-title'),
  
  imagePrompt: document.getElementById('image-prompt'),
  imageModelSelect: document.getElementById('image-model-select'),
  btnGenerateArt: document.getElementById('btn-generate-art'),
  previewEmpty: document.getElementById('preview-empty'),
  previewLoading: document.getElementById('preview-loading'),
  previewResult: document.getElementById('preview-result'),
  resultImageSrc: document.getElementById('result-image-src'),
  btnDownloadArt: document.getElementById('btn-download-art'),
  loadingStatusText: document.getElementById('loading-status-text'),
  
  settingsModal: document.getElementById('settings-modal'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnThemeToggle: document.getElementById('btn-theme-toggle')
};

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setupMobileNav();
  await fetchChats();
});

function setupMobileNav() {
  document.getElementById('mob-tab-chat')?.addEventListener('click', () => {
    switchView('view-chat');
  });

  document.getElementById('mob-tab-studio')?.addEventListener('click', () => {
    switchView('view-studio');
  });

  document.getElementById('mob-tab-settings')?.addEventListener('click', () => {
    elements.settingsModal?.classList.remove('hidden');
  });
}

function switchView(viewName) {
  state.currentView = viewName;
  const isChat = viewName === 'view-chat';
  
  elements.viewChat?.classList.toggle('hidden', !isChat);
  elements.viewStudio?.classList.toggle('hidden', isChat);
  
  elements.tabNavChat?.classList.toggle('active', isChat);
  elements.tabNavStudio?.classList.toggle('active', !isChat);
  
  document.getElementById('mob-tab-chat')?.classList.toggle('active', isChat);
  document.getElementById('mob-tab-studio')?.classList.toggle('active', !isChat);
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function fetchChats() {
  try {
    const res = await fetch('/api/chats');
    state.chats = await res.json();
    if (state.chats.length > 0 && !state.activeChatId) {
      state.activeChatId = state.chats[0].id;
    }
  } catch (e) {}
}

async function sendMessage(overrideText = null) {
  const userText = overrideText || elements.promptInput.value.trim();
  if (!userText || state.isStreaming) return;

  elements.promptInput.value = '';
  elements.promptInput.style.height = 'auto';
  elements.welcomeScreen?.classList.add('hidden');

  appendMessageElement('user', userText);

  const botContentDiv = appendMessageElement('assistant', '', true);
  const cursorSpan = document.createElement('span');
  cursorSpan.className = 'typing-cursor';
  botContentDiv.appendChild(cursorSpan);

  state.isStreaming = true;
  elements.btnSend.classList.add('hidden');
  elements.btnStopStream.classList.remove('hidden');

  state.abortController = new AbortController();
  let accumulatedText = '';

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: state.activeChatId || 'chat_default',
        messages: [{ role: 'user', content: userText }]
      }),
      signal: state.abortController.signal
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.substring(6));
            if (data.chunk) {
              accumulatedText += data.chunk;
              botContentDiv.innerHTML = renderMarkdown(accumulatedText);
              botContentDiv.appendChild(cursorSpan);
              scrollToBottom();
            }
          } catch (err) {}
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      accumulatedText += `\n\n> ⚠️ Ошибка: ${err.message}`;
    }
  } finally {
    cursorSpan.remove();
    botContentDiv.innerHTML = renderMarkdown(accumulatedText || 'Ответ получен.');
    state.isStreaming = false;
    elements.btnSend.classList.remove('hidden');
    elements.btnStopStream.classList.add('hidden');
    scrollToBottom();
  }
}

function appendMessageElement(role, content, isLive = false) {
  const msgWrapper = document.createElement('div');
  msgWrapper.className = `message-row ${role === 'user' ? 'user-message' : 'bot-message'}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  const contentBox = document.createElement('div');
  contentBox.className = 'msg-content';
  if (!isLive) {
    contentBox.innerHTML = renderMarkdown(content);
  }

  msgWrapper.appendChild(avatar);
  msgWrapper.appendChild(contentBox);
  elements.chatMessages.appendChild(msgWrapper);
  scrollToBottom();
  return contentBox;
}

function renderMarkdown(txt) {
  if (typeof marked !== 'undefined') {
    try { return marked.parse(txt); } catch (e) {}
  }
  return escapeHtml(txt).replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  if (container) container.scrollTop = container.scrollHeight;
}

// ---------------- ART STUDIO ----------------

async function generateMedia() {
  const prompt = elements.imagePrompt.value.trim();
  if (!prompt || state.isGeneratingArt) {
    if (!prompt) elements.imagePrompt.focus();
    return;
  }

  state.isGeneratingArt = true;
  elements.btnGenerateArt.disabled = true;

  elements.previewEmpty.classList.add('hidden');
  elements.previewResult.classList.add('hidden');
  elements.previewLoading.classList.remove('hidden');
  elements.loadingStatusText.textContent = 'ИИ создает изображение в HD...';

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        style: state.studio.style,
        aspectRatio: state.studio.aspectRatio,
        model: elements.imageModelSelect.value
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Ошибка');

    elements.previewLoading.classList.add('hidden');
    elements.previewResult.classList.remove('hidden');
    elements.resultImageSrc.src = data.item.url;
    elements.btnDownloadArt.href = data.item.url;
    elements.btnDownloadArt.download = `art_${Date.now()}.jpg`;

    // Scroll to preview on mobile
    elements.previewResult.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    alert('Ошибка генерации: ' + err.message);
    elements.previewLoading.classList.add('hidden');
    elements.previewEmpty.classList.remove('hidden');
  } finally {
    state.isGeneratingArt = false;
    elements.btnGenerateArt.disabled = false;
  }
}

// ---------------- EVENT LISTENERS ----------------

function setupEventListeners() {
  elements.tabNavChat?.addEventListener('click', () => switchView('view-chat'));
  elements.tabNavStudio?.addEventListener('click', () => switchView('view-studio'));

  // Mobile Touch + Click handlers for Send
  elements.btnSend?.addEventListener('click', () => sendMessage());
  elements.btnSend?.addEventListener('touchend', (e) => {
    e.preventDefault();
    sendMessage();
  });

  elements.btnStopStream?.addEventListener('click', () => {
    if (state.abortController) state.abortController.abort();
  });

  elements.btnNewChat?.addEventListener('click', () => {
    elements.chatMessages.innerHTML = '';
    elements.welcomeScreen?.classList.remove('hidden');
    elements.promptInput.value = '';
  });

  elements.btnClearChat?.addEventListener('click', () => {
    elements.chatMessages.innerHTML = '';
    elements.welcomeScreen?.classList.remove('hidden');
  });

  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const p = card.getAttribute('data-prompt');
      if (p) sendMessage(p);
    });
  });

  elements.promptInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Style chips
  document.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.studio.style = chip.getAttribute('data-style');
    });
  });

  // Ratio buttons
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.studio.aspectRatio = btn.getAttribute('data-ratio');
    });
  });

  // Quick tags
  document.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      elements.imagePrompt.value = pill.getAttribute('data-insert');
      elements.imagePrompt.focus();
    });
  });

  elements.btnGenerateArt?.addEventListener('click', generateMedia);
  elements.btnGenerateArt?.addEventListener('touchend', (e) => {
    e.preventDefault();
    generateMedia();
  });

  elements.btnThemeToggle?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
  });

  elements.btnCloseSettings?.addEventListener('click', () => {
    elements.settingsModal?.classList.add('hidden');
  });
  elements.btnSaveSettings?.addEventListener('click', () => {
    elements.settingsModal?.classList.add('hidden');
  });
}
