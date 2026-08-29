const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve static frontend files
app.use(express.static(__dirname));
if (fs.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// In-Memory & File Store for Chats & Gallery
const chats = [
  {
    id: 'chat_default',
    title: 'Основной диалог',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  }
];

const gallery = [];

app.get('/api/chats', (req, res) => {
  res.json(chats.map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: (c.messages || []).length
  })));
});

app.post('/api/chats', (req, res) => {
  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: req.body.title || 'Новый диалог',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: req.body.messages || []
  };
  chats.unshift(newChat);
  res.json(newChat);
});

app.get('/api/chats/:id', (req, res) => {
  const chat = chats.find(c => c.id === req.params.id) || chats[0];
  res.json(chat);
});

app.put('/api/chats/:id', (req, res) => {
  let chat = chats.find(c => c.id === req.params.id);
  if (!chat) {
    chat = {
      id: req.params.id,
      title: req.body.title || 'Новый диалог',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: req.body.messages || []
    };
    chats.unshift(chat);
  } else {
    if (req.body.title) chat.title = req.body.title;
    if (req.body.messages) chat.messages = req.body.messages;
    chat.updatedAt = new Date().toISOString();
  }
  res.json(chat);
});

app.delete('/api/chats/:id', (req, res) => {
  const idx = chats.findIndex(c => c.id === req.params.id);
  if (idx !== -1) chats.splice(idx, 1);
  res.json({ success: true });
});

// Robust Multi-Engine Translator (Russian -> English)
async function translateAndEnhancePrompt(rawPrompt) {
  const hasCyrillic = /[а-яё]/i.test(rawPrompt);
  if (!hasCyrillic) return rawPrompt;

  // 1. Try MyMemory API
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(rawPrompt)}&langpair=ru|en`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      const tr = data?.responseData?.translatedText;
      if (tr && tr.trim().length > 1 && !tr.includes('MYMEMORY WARNING')) {
        return tr.trim();
      }
    }
  } catch (e) {}

  // 2. Try Google Translate fallback
  try {
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(rawPrompt)}`;
    const gResp = await fetch(gUrl);
    if (gResp.ok) {
      const gData = await gResp.json();
      const gTr = gData[0]?.map(s => s[0]).join('');
      if (gTr && gTr.trim().length > 1) return gTr.trim();
    }
  } catch (e) {}

  return rawPrompt;
}

// Style Prompts: Pure quality keywords, ZERO forced portrait tokens
const STYLE_PROMPTS = {
  'photorealism': 'high quality detailed 8k photography, sharp focus, natural daylight, professional camera shot, realistic depth of field, real life photograph',
  'cinematic': 'cinematic movie still, 35mm film aesthetic, dramatic lighting, detailed composition, blockbuster scene, 8k',
  'cyberpunk': 'cyberpunk aesthetic, vibrant neon lighting, futuristic sci-fi atmosphere, highly detailed, 8k render',
  'anime': 'masterpiece anime illustration, makoto shinkai art style, vibrant colorful scene, clean detailed lineart',
  '3d-render': 'high quality 3d render, pixar art style, volumetric lighting, smooth textures, 8k octane render',
  'fantasy': 'epic fantasy concept artwork, magical atmosphere, detailed landscape, matte painting, breathtaking view',
  'digital-art': 'detailed digital concept art, vibrant colors, trending on artstation, masterpiece painting'
};

const ASPECT_RATIO_DIMS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '4:3': { width: 1024, height: 768 }
};

app.post('/api/generate-image', async (req, res) => {
  let { prompt = '', style = 'photorealism', aspectRatio = '1:1', model = 'flux-realism' } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Введите описание' });

  try {
    const dims = ASPECT_RATIO_DIMS[aspectRatio] || { width: 1024, height: 1024 };
    const styleModifier = STYLE_PROMPTS[style] || STYLE_PROMPTS['photorealism'];
    
    // Translate accurately to English so FLUX understands exact user intent
    const englishPrompt = await translateAndEnhancePrompt(prompt.trim());
    const fullPrompt = `${englishPrompt}, ${styleModifier}`;
    const seed = Math.floor(Math.random() * 10000000);
    const genModel = (style === 'photorealism') ? 'flux-realism' : (model || 'flux');

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${dims.width}&height=${dims.height}&model=${encodeURIComponent(genModel)}&nologo=true&seed=${seed}`;

    const imageRecord = {
      id: 'img_' + Date.now(),
      type: 'image',
      prompt: prompt.trim(),
      translatedPrompt: englishPrompt,
      style,
      aspectRatio,
      model: genModel,
      width: dims.width,
      height: dims.height,
      url: imageUrl,
      createdAt: new Date().toISOString()
    };

    gallery.unshift(imageRecord);
    res.json({ success: true, item: imageRecord });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
});

app.get('/api/gallery', (req, res) => res.json(gallery));
app.get('/api/ollama/status', (req, res) => res.json({ running: false, models: [] }));

// Unified Streaming Chat Endpoint with Free Cloud AI
app.post('/api/chat/stream', async (req, res) => {
  let { chatId, messages = [] } = req.body;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const userQuery = messages.length > 0 ? messages[messages.length - 1].content : 'Привет';

  try {
    const promptUrl = `https://text.pollinations.ai/${encodeURIComponent(userQuery)}?system=${encodeURIComponent('Ты — умный и полезный русскоязычный ИИ. Отвечай понятно, структурированно и вежливо на русском языке.')}&model=openai`;
    const aiResp = await fetch(promptUrl);
    if (aiResp.ok) {
      const text = await aiResp.text();
      const words = text.split(' ');
      for (let i = 0; i < words.length; i += 3) {
        const chunk = words.slice(i, i + 3).join(' ') + ' ';
        res.write('data: ' + JSON.stringify({ chunk }) + '\n\n');
        await new Promise(r => setTimeout(r, 20));
      }
      res.write('data: ' + JSON.stringify({ done: true, fullText: text }) + '\n\n');
      return res.end();
    }
  } catch (e) {}

  const fallback = `Ответ на ваш вопрос:\n\nЯ ваш персональный ИИ-ассистент, работающий в облаке 24/7. Вы можете задавать любые вопросы, просить написать код, стихи или планы, а также генерировать изображения во вкладке «Арт-Студия»!`;
  res.write('data: ' + JSON.stringify({ chunk: fallback }) + '\n\n');
  res.write('data: ' + JSON.stringify({ done: true, fullText: fallback }) + '\n\n');
  res.end();
});

// Root fallback
app.get('*', (req, res) => {
  const p = path.join(__dirname, 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.send('AI Workspace Active');
});

app.listen(PORT, () => {
  console.log(`🚀 AI Workspace cloud server is active on port ${PORT}`);
});
