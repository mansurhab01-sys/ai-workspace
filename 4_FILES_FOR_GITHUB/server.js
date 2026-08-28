const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve static files from root AND public
app.use(express.static(__dirname));
if (fs.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Directories for chats and gallery
const DATA_DIR = path.join(__dirname, 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const GALLERY_DIR = path.join(DATA_DIR, 'gallery');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, JSON.stringify([], null, 2), 'utf8');
if (!fs.existsSync(GALLERY_FILE)) fs.writeFileSync(GALLERY_FILE, JSON.stringify([], null, 2), 'utf8');

app.use('/gallery-media', express.static(GALLERY_DIR));

function readChats() {
  try { return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8') || '[]'); } catch (err) { return []; }
}
function writeChats(chats) {
  try { fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2), 'utf8'); } catch (err) {}
}
function readGallery() {
  try { return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8') || '[]'); } catch (err) { return []; }
}
function writeGallery(items) {
  try { fs.writeFileSync(GALLERY_FILE, JSON.stringify(items, null, 2), 'utf8'); } catch (err) {}
}

// REST API for chats
app.get('/api/chats', (req, res) => {
  const chats = readChats();
  const summaries = chats.map(c => ({
    id: c.id,
    title: c.title || 'Новый диалог',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt || c.createdAt,
    messageCount: (c.messages || []).length
  })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(summaries);
});

app.post('/api/chats', (req, res) => {
  const chats = readChats();
  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: req.body.title || 'Новый диалог',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: req.body.messages || []
  };
  chats.unshift(newChat);
  writeChats(chats);
  res.json(newChat);
});

app.get('/api/chats/:id', (req, res) => {
  const chats = readChats();
  const chat = chats.find(c => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: 'Чат не найден' });
  res.json(chat);
});

app.put('/api/chats/:id', (req, res) => {
  const chats = readChats();
  const index = chats.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Чат не найден' });
  if (req.body.title !== undefined) chats[index].title = req.body.title;
  if (req.body.messages !== undefined) chats[index].messages = req.body.messages;
  chats[index].updatedAt = new Date().toISOString();
  writeChats(chats);
  res.json(chats[index]);
});

app.delete('/api/chats/:id', (req, res) => {
  let chats = readChats();
  chats = chats.filter(c => c.id !== req.params.id);
  writeChats(chats);
  res.json({ success: true });
});

// Translation Engine
async function translateAndEnhancePrompt(rawPrompt) {
  const hasCyrillic = /[а-яё]/i.test(rawPrompt);
  if (!hasCyrillic) return rawPrompt;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(rawPrompt)}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      const translated = data[0].map(s => s[0]).join('');
      if (translated && translated.trim().length > 2) return translated.trim();
    }
  } catch (e) {}
  return rawPrompt;
}

// ART Generation API
const STYLE_PROMPTS = {
  'photorealism': 'candid raw photograph, shot on Sony A7IV, 85mm f1.4 lens, natural daylight, genuine human skin texture, realistic depth of field, real life photograph, unedited',
  'cinematic': 'cinematic 35mm movie still, shot on Arri Alexa, anamorphic lens, natural cinematic lighting, shallow depth of field, blockbuster film aesthetic, highly detailed',
  'editorial': 'vogue fashion magazine editorial photograph, professional studio lighting, shot on Hasselblad, high fashion look, sharp details',
  'anime': 'masterpiece, high quality anime artwork, makoto shinkai style, vibrant colors, detailed illustration, clean lineart',
  'cyberpunk': 'cyberpunk aesthetic, neon lighting, futuristic, high-tech, highly detailed, octane render, 8k',
  '3d-render': 'cute 3d render, pixar style, octane render, trending on artstation, smooth lighting, volumetric, vibrant, 8k',
  'fantasy': 'epic fantasy concept art, highly detailed, magical glow, artstation trending, matte painting, breathtaking, intricate details'
};

const ASPECT_RATIO_DIMS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '4:3': { width: 1024, height: 768 }
};

app.post('/api/generate-image', async (req, res) => {
  let { prompt = '', style = 'photorealism', aspectRatio = '1:1', model = 'flux-realism' } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Введите промпт' });

  try {
    const dims = ASPECT_RATIO_DIMS[aspectRatio] || { width: 1024, height: 1024 };
    const styleModifier = STYLE_PROMPTS[style] || STYLE_PROMPTS['photorealism'];
    const englishPrompt = await translateAndEnhancePrompt(prompt.trim());
    const fullPrompt = `${englishPrompt}, ${styleModifier}`;
    const seed = Math.floor(Math.random() * 10000000);
    const genModel = (style === 'photorealism' || style === 'editorial') ? 'flux-realism' : (model || 'flux');

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${dims.width}&height=${dims.height}&model=${encodeURIComponent(genModel)}&nologo=true&seed=${seed}`;

    const imageResp = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!imageResp.ok) throw new Error(`HTTP Error ${imageResp.status}`);

    const buffer = Buffer.from(await imageResp.arrayBuffer());
    const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const fileName = `${imageId}.jpg`;
    const filePath = path.join(GALLERY_DIR, fileName);

    fs.writeFileSync(filePath, buffer);

    const imageRecord = {
      id: imageId,
      type: 'image',
      prompt: prompt.trim(),
      translatedPrompt: englishPrompt,
      style,
      aspectRatio,
      model: genModel,
      width: dims.width,
      height: dims.height,
      fileName,
      url: `/gallery-media/${fileName}`,
      createdAt: new Date().toISOString()
    };

    const gallery = readGallery();
    gallery.unshift(imageRecord);
    writeGallery(gallery);

    res.json({ success: true, item: imageRecord });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
});

app.get('/api/gallery', (req, res) => {
  res.json(readGallery());
});

app.get('/api/ollama/status', (req, res) => {
  res.json({ running: false, models: [] });
});

// Chat stream
app.post('/api/chat/stream', async (req, res) => {
  let { chatId, messages = [], provider = 'gemini', apiKey = '', systemPrompt = '' } = req.body;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let fullAssistantText = '';
  const sendChunk = (text) => {
    fullAssistantText += text;
    res.write('data: ' + JSON.stringify({ chunk: text }) + '\n\n');
  };
  const sendError = (errMsg) => {
    res.write('data: ' + JSON.stringify({ error: errMsg }) + '\n\n');
    res.write('data: ' + JSON.stringify({ done: true }) + '\n\n');
    res.end();
  };
  const finishStream = () => {
    if (chatId && fullAssistantText) {
      try {
        const chats = readChats();
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
          chat.messages.push({
            id: 'msg_' + Date.now(),
            role: 'assistant',
            content: fullAssistantText,
            timestamp: new Date().toISOString(),
            provider,
            model: 'cloud-ai'
          });
          chat.updatedAt = new Date().toISOString();
          writeChats(chats);
        }
      } catch (e) {}
    }
    res.write('data: ' + JSON.stringify({ done: true, fullText: fullAssistantText }) + '\n\n');
    res.end();
  };

  sendChunk('👋 Привет! Облачный сервер AI Workspace активен и работает 24/7. Введите ваш API-ключ Gemini или Groq в Настройках ⚙️ для мгновенных ответов!');
  finishStream();
});

app.listen(PORT, () => {
  console.log(`🚀 Cloud Server ready on port ${PORT}`);
});
