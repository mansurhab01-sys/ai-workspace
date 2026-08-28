// AI Workspace Full Application Logic (Chat + Art Studio)

const state = {
  currentView: 'view-chat',
  activeChatId: null,
  chats: [],
  gallery: [],
  isStreaming: false,
  isGeneratingArt: false,
  abortController: null,
  studio: {
    mediaType: 'image',
    prompt: '',
    style: 'photorealism',
    aspectRatio: '1:1',
    model: 'flux-realism'
  },
  settings: {
    mode: 'ollama',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    groqApiKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    ollamaModel: 'qwen2.5:1.5b',
    systemPrompt: 'Ты — умный, вежливый и полезный ИИ-помощник. Ты даешь точные, структурированные ответы, оформляешь код с подсветкой и пишешь на чистом русском языке.',
    theme: 'dark'
  }
};

// DOM Elements
const elements = {
  // Navigation
  tabNavChat: document.getElementById('tab-nav-chat'),
  tabNavStudio: document.getElementById('tab-nav-studio'),
  viewChat: document.getElementById('view-chat'),
  viewStudio: document.getElementById('view-studio'),
  sidebarChatSection: document.getElementById('sidebar-chat-section'),
  sidebarStudioSection: document.getElementById('sidebar-studio-section'),
  studioMiniHistory: document.getElementById('studio-mini-history'),

  // Media Type Switcher
  typeBtnImage: document.getElementById('type-btn-image'),
  typeBtnVideo: document.getElementById('type-btn-video'),
  promptLabelText: document.getElementById('prompt-label-text'),
  styleSelectorGroup: document.getElementById('style-selector-group'),
  modelSelectGroup: document.getElementById('model-select-group'),

  // Chat
  chatList: document.getElementById('chat-list'),
  btnNewChat: document.getElementById('btn-new-chat'),
  btnCollapseSidebar: document.getElementById('btn-collapse-sidebar'),
  btnOpenSidebar: document.getElementById('btn-open-sidebar'),
  sidebar: document.getElementById('sidebar'),
  messagesContainer: document.getElementById('messages-container'),
  welcomeScreen: document.getElementById('welcome-screen'),
  chatMessages: document.getElementById('chat-messages'),
  promptInput: document.getElementById('prompt-input'),
  btnSend: document.getElementById('btn-send'),
  btnStopStream: document.getElementById('btn-stop-stream'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  currentChatTitle: document.getElementById('current-chat-title'),
  statusModeLabel: document.getElementById('status-mode-label'),
  currentModeBadge: document.getElementById('current-mode-badge'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),

  // Studio
  imagePrompt: document.getElementById('image-prompt'),
  imageModelSelect: document.getElementById('image-model-select'),
  btnGenerateArt: document.getElementById('btn-generate-art'),
  btnGenText: document.getElementById('btn-gen-text'),
  btnGenIcon: document.getElementById('btn-gen-icon'),
  previewEmpty: document.getElementById('preview-empty'),
  emptyIconArt: document.getElementById('empty-icon-art'),
  emptyTitleText: document.getElementById('empty-title-text'),
  previewLoading: document.getElementById('preview-loading'),
  previewResult: document.getElementById('preview-result'),
  resultImageSrc: document.getElementById('result-image-src'),
  resultVideoSrc: document.getElementById('result-video-src'),
  btnDownloadArt: document.getElementById('btn-download-art'),
  downloadBtnText: document.getElementById('download-btn-text'),
  loadingStatusText: document.getElementById('loading-status-text'),
  loadingSubText: document.getElementById('loading-sub-text'),
  galleryGrid: document.getElementById('gallery-grid'),
  galleryItemsCount: document.getElementById('gallery-items-count'),

  // Settings
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnCancelSettings: document.getElementById('btn-cancel-settings'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  settingsModal: document.getElementById('settings-modal'),
  geminiApiKey: document.getElementById('gemini-api-key'),
  geminiModelSelect: document.getElementById('gemini-model-select'),
  groqApiKey: document.getElementById('groq-api-key'),
  groqModelSelect: document.getElementById('groq-model-select'),
  ollamaModelInput: document.getElementById('ollama-model-input'),
  systemPromptInput: document.getElementById('system-prompt-input'),
  ollamaDot: document.getElementById('ollama-dot'),
  ollamaStatusMsg: document.getElementById('ollama-status-msg'),
  btnCheckOllama: document.getElementById('btn-check-ollama')
};

// ---------------- INITIALIZATION ----------------

document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  applyTheme(state.settings.theme);
  updateModeBadge();
  setupMarked();
  setupEventListeners();
  await fetchChats();
  await fetchGallery();
  checkOllamaStatus();
});

function setupMarked() {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (e) {}
      }
      return hljs.highlightAuto(code).value;
    }
  });
}

function loadSettings() {
  const saved = localStorage.getItem('ai_chat_settings');
  if (saved) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    } catch (e) {}
  }
}

function saveSettings() {
  localStorage.setItem('ai_chat_settings', JSON.stringify(state.settings));
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.settings.theme = theme;
  saveSettings();
}

function updateModeBadge() {
  let label = 'Локально: Ollama';
  if (state.settings.mode === 'gemini') {
    label = `Облако: ${state.settings.geminiModel}`;
  } else if (state.settings.mode === 'groq') {
    label = `Groq: ${state.settings.groqModel}`;
  } else if (state.settings.mode === 'ollama') {
    label = `Локально: ${state.settings.ollamaModel || 'qwen2.5:1.5b'}`;
  }
  elements.statusModeLabel.textContent = label;
}

// ---------------- NAVIGATION ----------------

function switchView(viewName) {
  state.currentView = viewName;
  if (viewName === 'view-chat') {
    elements.tabNavChat.classList.add('active');
    elements.tabNavStudio.classList.remove('active');
    elements.viewChat.classList.remove('hidden');
    elements.viewStudio.classList.add('hidden');
    elements.sidebarChatSection.classList.remove('hidden');
    elements.sidebarStudioSection.classList.add('hidden');
  } else {
    elements.tabNavChat.classList.remove('active');
    elements.tabNavStudio.classList.add('active');
    elements.viewChat.classList.add('hidden');
    elements.viewStudio.classList.remove('hidden');
    elements.sidebarChatSection.classList.add('hidden');
    elements.sidebarStudioSection.classList.remove('hidden');
  }
}

function switchMediaType(type) {
  state.studio.mediaType = type;
  if (type === 'image') {
    elements.typeBtnImage.classList.add('active');
    elements.typeBtnVideo.classList.remove('active');
    elements.typeBtnVideo.classList.remove('video-mode');

    elements.promptLabelText.textContent = 'Описание изображения (можно писать на русском):';
    elements.styleSelectorGroup.classList.remove('hidden');
    elements.modelSelectGroup.classList.remove('hidden');

    elements.btnGenerateArt.classList.remove('video-btn');
    elements.btnGenIcon.textContent = '🚀';
    elements.btnGenText.textContent = 'Сгенерировать изображение';
    elements.emptyIconArt.textContent = '🖼️';
  } else {
    elements.typeBtnVideo.classList.add('active');
    elements.typeBtnVideo.classList.add('video-mode');
    elements.typeBtnImage.classList.remove('active');

    elements.promptLabelText.textContent = 'Описание видео-анимации (динамика, движение камеры, свет):';
    elements.styleSelectorGroup.classList.remove('hidden');
    elements.modelSelectGroup.classList.add('hidden');

    elements.btnGenerateArt.classList.add('video-btn');
    elements.btnGenIcon.textContent = '🎬';
    elements.btnGenText.textContent = 'Сгенерировать видео-анимацию (2–4 сек)';
    elements.emptyIconArt.textContent = '🎬';
  }
}

// ---------------- ART & VIDEO STUDIO LOGIC ----------------

async function fetchGallery() {
  try {
    const res = await fetch('/api/gallery');
    state.gallery = await res.json();
    renderGallery();
    renderMiniHistory();
  } catch (err) {
    console.error('Error fetching gallery:', err);
  }
}

function renderGallery() {
  elements.galleryGrid.innerHTML = '';
  elements.galleryItemsCount.textContent = `${state.gallery.length} ${getNoun(state.gallery.length, 'работа', 'работы', 'работ')}`;

  if (state.gallery.length === 0) {
    elements.galleryGrid.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1; padding: 20px 0;">У вас пока нет сохраненных работ. Создайте первое фото или видео выше!</div>';
    return;
  }

  state.gallery.forEach(item => {
    const isVideo = item.type === 'video' || (item.fileName && item.fileName.endsWith('.mp4'));
    const card = document.createElement('div');
    card.className = 'gallery-card';

    const mediaHtml = isVideo 
      ? `<video src="${item.url}" muted loop playsinline></video><div class="video-indicator-badge">🎬 Видео</div>`
      : `<img src="${item.url}" alt="${escapeHtml(item.prompt)}" loading="lazy">`;

    card.innerHTML = `
      <div class="gallery-card-img-wrapper" title="Нажмите для просмотра">
        ${mediaHtml}
      </div>
      <button class="gallery-card-delete" title="Удалить" data-id="${item.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
      <div class="gallery-card-info">
        <div class="gallery-card-prompt">${escapeHtml(item.prompt)}</div>
        <div class="gallery-card-meta">
          <span>${isVideo ? 'Видео-анимация' : item.style}</span>
          <span>${item.width}x${item.height}</span>
        </div>
      </div>
    `;

    const imgWrapper = card.querySelector('.gallery-card-img-wrapper');
    if (isVideo) {
      const vid = imgWrapper.querySelector('video');
      imgWrapper.addEventListener('mouseenter', () => vid.play().catch(()=>{}));
      imgWrapper.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
    }

    imgWrapper.addEventListener('click', () => {
      showPreviewResult(item.url, item.prompt, isVideo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    card.querySelector('.gallery-card-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Удалить эту работу?')) {
        await deleteGalleryItem(item.id);
      }
    });

    elements.galleryGrid.appendChild(card);
  });
}

function renderMiniHistory() {
  elements.studioMiniHistory.innerHTML = '';
  state.gallery.slice(0, 8).forEach(item => {
    const isVideo = item.type === 'video' || (item.fileName && item.fileName.endsWith('.mp4'));
    const thumb = document.createElement('div');
    thumb.className = 'mini-thumb';

    if (isVideo) {
      thumb.innerHTML = `<video src="${item.url}" muted loop playsinline></video><span class="mini-thumb-video-badge">🎬</span>`;
    } else {
      thumb.innerHTML = `<img src="${item.url}" alt="${escapeHtml(item.prompt)}" title="${escapeHtml(item.prompt)}">`;
    }

    thumb.addEventListener('click', () => {
      showPreviewResult(item.url, item.prompt, isVideo);
    });
    elements.studioMiniHistory.appendChild(thumb);
  });
}

async function deleteGalleryItem(id) {
  try {
    await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    state.gallery = state.gallery.filter(g => g.id !== id);
    renderGallery();
    renderMiniHistory();
  } catch (err) {}
}

function showPreviewResult(mediaUrl, prompt, isVideo = false) {
  elements.previewEmpty.classList.add('hidden');
  elements.previewLoading.classList.add('hidden');
  elements.previewResult.classList.remove('hidden');

  if (isVideo) {
    elements.resultImageSrc.classList.add('hidden');
    elements.resultVideoSrc.classList.remove('hidden');
    elements.resultVideoSrc.src = mediaUrl;
    elements.resultVideoSrc.play().catch(()=>{});

    elements.btnDownloadArt.href = mediaUrl;
    elements.btnDownloadArt.download = `video_anim_${Date.now()}.mp4`;
    elements.downloadBtnText.textContent = 'Скачать MP4 Видео';
  } else {
    elements.resultVideoSrc.classList.add('hidden');
    elements.resultImageSrc.classList.remove('hidden');
    elements.resultImageSrc.src = mediaUrl;

    elements.btnDownloadArt.href = mediaUrl;
    elements.btnDownloadArt.download = `art_${Date.now()}.jpg`;
    elements.downloadBtnText.textContent = 'Скачать HD Фото';
  }
}

async function generateMedia() {
  const prompt = elements.imagePrompt.value.trim();
  if (!prompt || state.isGeneratingArt) {
    if (!prompt) elements.imagePrompt.focus();
    return;
  }

  const isVideo = state.studio.mediaType === 'video';
  state.isGeneratingArt = true;
  elements.btnGenerateArt.disabled = true;

  elements.previewEmpty.classList.add('hidden');
  elements.previewResult.classList.add('hidden');
  elements.previewLoading.classList.remove('hidden');

  if (isVideo) {
    elements.loadingStatusText.textContent = 'ИИ рендерит видео-анимацию...';
    elements.loadingSubText.textContent = 'Создание и интерполяция кадров (занимает ~10–15 секунд)';
  } else {
    elements.loadingStatusText.textContent = 'Нейросеть создает изображение...';
    elements.loadingSubText.textContent = 'Вычисления на облачных GPU (занимает ~3–5 секунд)';
  }

  try {
    const endpoint = isVideo ? '/api/generate-video' : '/api/generate-image';
    const bodyPayload = isVideo ? {
      prompt: prompt,
      style: state.studio.style,
      aspectRatio: state.studio.aspectRatio
    } : {
      prompt: prompt,
      style: state.studio.style,
      aspectRatio: state.studio.aspectRatio,
      model: elements.imageModelSelect.value
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Ошибка создания медиа');
    }

    showPreviewResult(data.item.url, data.item.prompt, isVideo);
    state.gallery.unshift(data.item);
    renderGallery();
    renderMiniHistory();

  } catch (err) {
    alert('Ошибка генерации: ' + err.message);
    elements.previewLoading.classList.add('hidden');
    elements.previewEmpty.classList.remove('hidden');
  } finally {
    state.isGeneratingArt = false;
    elements.btnGenerateArt.disabled = false;
  }
}

function getNoun(number, one, two, five) {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) return five;
  n %= 10;
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return two;
  return five;
}

// ---------------- CHAT MANAGEMENT ----------------

async function fetchChats() {
  try {
    const res = await fetch('/api/chats');
    state.chats = await res.json();
    renderChatList();
  } catch (err) {
    console.error('Failed to fetch chats:', err);
  }
}

function renderChatList() {
  elements.chatList.innerHTML = '';
  state.chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = `chat-item ${chat.id === state.activeChatId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="chat-item-title">${escapeHtml(chat.title || 'Новый диалог')}</div>
      <div class="chat-item-actions">
        <button class="chat-action-btn" title="Удалить" data-delete-id="${chat.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-id]')) return;
      loadChat(chat.id);
    });

    const deleteBtn = item.querySelector('[data-delete-id]');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Удалить этот диалог?')) {
        await deleteChat(chat.id);
      }
    });

    elements.chatList.appendChild(item);
  });
}

async function createNewChat() {
  try {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Новый диалог' })
    });
    const newChat = await res.json();
    state.chats.unshift(newChat);
    state.activeChatId = newChat.id;
    renderChatList();
    renderActiveChat(newChat);
    elements.promptInput.focus();
  } catch (err) {}
}

async function loadChat(chatId) {
  try {
    state.activeChatId = chatId;
    renderChatList();
    const res = await fetch(`/api/chats/${chatId}`);
    const chat = await res.json();
    renderActiveChat(chat);
  } catch (err) {}
}

async function deleteChat(chatId) {
  try {
    await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
    state.chats = state.chats.filter(c => c.id !== chatId);
    if (state.activeChatId === chatId) {
      state.activeChatId = null;
      if (state.chats.length > 0) {
        loadChat(state.chats[0].id);
      } else {
        renderActiveChat(null);
      }
    }
    renderChatList();
  } catch (err) {}
}

function renderActiveChat(chat) {
  elements.chatMessages.innerHTML = '';
  if (!chat || !chat.messages || chat.messages.length === 0) {
    elements.welcomeScreen.classList.remove('hidden');
    elements.currentChatTitle.textContent = chat ? chat.title : 'Новый диалог';
    return;
  }

  elements.welcomeScreen.classList.add('hidden');
  elements.currentChatTitle.textContent = chat.title || 'Диалог';

  chat.messages.forEach(msg => {
    appendMessageElement(msg.role, msg.content, false);
  });
  scrollToBottom();
}

function appendMessageElement(role, initialContent = '', isLive = false) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role === 'user' ? 'user' : 'bot'}`;
  avatar.textContent = role === 'user' ? 'Вы' : 'AI';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  if (role === 'user') {
    contentDiv.textContent = initialContent;
    row.appendChild(contentDiv);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(contentDiv);
    if (initialContent) {
      renderMarkdownToElement(contentDiv, initialContent);
    }
  }

  elements.chatMessages.appendChild(row);
  scrollToBottom();
  return contentDiv;
}

function renderMarkdownToElement(element, markdownText) {
  let rawHtml = marked.parse(markdownText);
  element.innerHTML = rawHtml;

  if (window.renderMathInElement) {
    try {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {}
  }

  element.querySelectorAll('pre code').forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    let lang = 'code';
    const classes = codeBlock.className.split(' ');
    for (const c of classes) {
      if (c.startsWith('language-')) {
        lang = c.replace('language-', '');
        break;
      }
    }

    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="btn-copy-code" title="Скопировать код">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Копировать</span>
      </button>
    `;

    const copyBtn = header.querySelector('.btn-copy-code');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeBlock.innerText).then(() => {
        copyBtn.querySelector('span').textContent = 'Скопировано!';
        setTimeout(() => {
          copyBtn.querySelector('span').textContent = 'Копировать';
        }, 2000);
      });
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

function scrollToBottom() {
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------------- SEND & STREAMING ----------------

async function sendMessage(text) {
  const userText = (text || elements.promptInput.value).trim();
  if (!userText || state.isStreaming) return;

  if (!state.activeChatId) {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: userText.slice(0, 30) + '...' })
    });
    const newChat = await res.json();
    state.chats.unshift(newChat);
    state.activeChatId = newChat.id;
    renderChatList();
  }

  elements.promptInput.value = '';
  elements.promptInput.style.height = 'auto';
  elements.welcomeScreen.classList.add('hidden');

  appendMessageElement('user', userText);

  const chatIndex = state.chats.findIndex(c => c.id === state.activeChatId);
  const currentChat = state.chats[chatIndex];

  if (currentChat && (!currentChat.messages || currentChat.messages.length === 0)) {
    const title = userText.length > 32 ? userText.slice(0, 32) + '...' : userText;
    currentChat.title = title;
    elements.currentChatTitle.textContent = title;
    fetch(`/api/chats/${state.activeChatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    renderChatList();
  }

  const userMsgObj = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: userText,
    timestamp: new Date().toISOString()
  };

  let messagesHistory = [];
  try {
    const chatRes = await fetch(`/api/chats/${state.activeChatId}`);
    const fullChat = await chatRes.json();
    fullChat.messages.push(userMsgObj);
    messagesHistory = fullChat.messages;

    await fetch(`/api/chats/${state.activeChatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: fullChat.messages })
    });
  } catch (e) {
    messagesHistory = [{ role: 'user', content: userText }];
  }

  const botContentDiv = appendMessageElement('assistant', '', true);
  const cursorSpan = document.createElement('span');
  cursorSpan.className = 'typing-cursor';
  botContentDiv.appendChild(cursorSpan);

  state.isStreaming = true;
  elements.btnSend.classList.add('hidden');
  elements.btnStopStream.classList.remove('hidden');

  state.abortController = new AbortController();

  let accumulatedText = '';
  const provider = state.settings.mode || 'ollama';
  let apiKey = '';
  let model = '';

  if (provider === 'gemini') {
    apiKey = state.settings.geminiApiKey;
    model = state.settings.geminiModel;
  } else if (provider === 'groq') {
    apiKey = state.settings.groqApiKey;
    model = state.settings.groqModel;
  } else if (provider === 'ollama') {
    model = state.settings.ollamaModel || 'qwen2.5:1.5b';
  }

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: state.activeChatId,
        messages: messagesHistory,
        provider,
        model,
        apiKey,
        systemPrompt: state.settings.systemPrompt
      }),
      signal: state.abortController.signal
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

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
          const jsonStr = trimmed.substring(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.error) {
              accumulatedText += `\n\n> ⚠️ **Ошибка:** ${data.error}`;
              renderMarkdownToElement(botContentDiv, accumulatedText);
            } else if (data.chunk) {
              accumulatedText += data.chunk;
              renderMarkdownToElement(botContentDiv, accumulatedText);
              botContentDiv.appendChild(cursorSpan);
              scrollToBottom();
            }
          } catch (err) {}
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      accumulatedText += ' *(Генерация остановлена)*';
    } else {
      accumulatedText += `\n\n> ⚠️ **Ошибка:** ${err.message}`;
    }
  } finally {
    cursorSpan.remove();
    renderMarkdownToElement(botContentDiv, accumulatedText);
    state.isStreaming = false;
    elements.btnSend.classList.remove('hidden');
    elements.btnStopStream.classList.add('hidden');
    scrollToBottom();
  }
}

function stopStreaming() {
  if (state.abortController) state.abortController.abort();
}

// ---------------- OLLAMA CHECK ----------------

async function checkOllamaStatus() {
  elements.ollamaDot.className = 'status-dot-large checking';
  try {
    const res = await fetch('/api/ollama/status');
    const data = await res.json();
    if (data.running) {
      elements.ollamaDot.className = 'status-dot-large online';
      elements.ollamaStatusMsg.innerHTML = `✅ <strong>Ollama активна</strong> (${data.models?.join(', ') || 'модели готовы'})`;
    } else {
      elements.ollamaDot.className = 'status-dot-large offline';
      elements.ollamaStatusMsg.innerHTML = '❌ <strong>Ollama не запущена</strong>';
    }
  } catch (err) {
    elements.ollamaDot.className = 'status-dot-large offline';
  }
}

// ---------------- EVENT LISTENERS ----------------

function setupEventListeners() {
  // Navigation Tabs
  elements.tabNavChat.addEventListener('click', () => switchView('view-chat'));
  elements.tabNavStudio.addEventListener('click', () => switchView('view-studio'));

  // Media Type Switcher (Photo vs Video)
  elements.typeBtnImage.addEventListener('click', () => switchMediaType('image'));
  elements.typeBtnVideo.addEventListener('click', () => switchMediaType('video'));

  // Chat controls
  elements.btnNewChat.addEventListener('click', createNewChat);
  elements.btnSend.addEventListener('click', () => sendMessage());
  elements.btnStopStream.addEventListener('click', stopStreaming);

  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt) sendMessage(prompt);
    });
  });

  elements.promptInput.addEventListener('input', () => {
    elements.promptInput.style.height = 'auto';
    elements.promptInput.style.height = Math.min(elements.promptInput.scrollHeight, 180) + 'px';
  });

  elements.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  elements.btnClearChat.addEventListener('click', () => {
    if (state.activeChatId && confirm('Очистить сообщения в этом диалоге?')) {
      fetch(`/api/chats/${state.activeChatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] })
      }).then(() => {
        elements.chatMessages.innerHTML = '';
        elements.welcomeScreen.classList.remove('hidden');
      });
    }
  });

  // Studio Style chips
  document.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.studio.style = chip.getAttribute('data-style');
    });
  });

  // Studio Ratio buttons
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.studio.aspectRatio = btn.getAttribute('data-ratio');
    });
  });

  // Studio Prompt Quick tags
  document.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      elements.imagePrompt.value = pill.getAttribute('data-insert');
      elements.imagePrompt.focus();
    });
  });

  // Generate Media (Photo or Video)
  elements.btnGenerateArt.addEventListener('click', generateMedia);

  // Theme Toggle
  elements.btnThemeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Settings Modal
  elements.btnOpenSettings.addEventListener('click', openSettingsModal);
  elements.currentModeBadge.addEventListener('click', openSettingsModal);
  elements.btnCloseSettings.addEventListener('click', closeSettingsModal);
  elements.btnCancelSettings.addEventListener('click', closeSettingsModal);
  elements.btnSaveSettings.addEventListener('click', saveSettingsFromModal);

  document.querySelectorAll('.modal-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.remove('hidden');
    });
  });

  document.querySelectorAll('input[name="app-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateProviderSubsettings(e.target.value);
    });
  });

  elements.btnCheckOllama.addEventListener('click', checkOllamaStatus);
}

function updateProviderSubsettings(mode) {
  document.getElementById('subsettings-gemini').classList.toggle('hidden', mode !== 'gemini');
  document.getElementById('subsettings-groq').classList.toggle('hidden', mode !== 'groq');
  document.getElementById('subsettings-ollama').classList.toggle('hidden', mode !== 'ollama');
  if (mode === 'ollama') checkOllamaStatus();
}

function openSettingsModal() {
  const modeRadio = document.querySelector(`input[name="app-mode"][value="${state.settings.mode}"]`);
  if (modeRadio) modeRadio.checked = true;

  updateProviderSubsettings(state.settings.mode);

  elements.geminiApiKey.value = state.settings.geminiApiKey || '';
  elements.geminiModelSelect.value = state.settings.geminiModel || 'gemini-2.5-flash';
  elements.groqApiKey.value = state.settings.groqApiKey || '';
  elements.groqModelSelect.value = state.settings.groqModel || 'llama-3.3-70b-versatile';
  elements.ollamaModelInput.value = state.settings.ollamaModel || 'qwen2.5:1.5b';
  elements.systemPromptInput.value = state.settings.systemPrompt || '';

  elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  elements.settingsModal.classList.add('hidden');
}

function saveSettingsFromModal() {
  const selectedMode = document.querySelector('input[name="app-mode"]:checked')?.value || 'ollama';

  state.settings.mode = selectedMode;
  state.settings.geminiApiKey = elements.geminiApiKey.value.trim();
  state.settings.geminiModel = elements.geminiModelSelect.value;
  state.settings.groqApiKey = elements.groqApiKey.value.trim();
  state.settings.groqModel = elements.groqModelSelect.value;
  state.settings.ollamaModel = elements.ollamaModelInput.value.trim();
  state.settings.systemPrompt = elements.systemPromptInput.value.trim();

  saveSettings();
  updateModeBadge();
  closeSettingsModal();
}
// Register Service Worker for PWA (Installable app on iPhone / Android)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Fetch network IP for mobile connection tab
async function fetchNetworkInfo() {
  try {
    const res = await fetch('/api/network-info');
    const data = await res.json();
    const el = document.getElementById('mobile-url-display');
    if (el && data.phoneUrl) {
      el.textContent = data.phoneUrl;
    }
  } catch (e) {}
}

// Toggle mobile sidebar
document.getElementById('btn-open-sidebar')?.addEventListener('click', () => {
  elements.sidebar.classList.toggle('open');
});
