const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve static files from current directory, parent directory, and public subfolder
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '..')));
if (fs.existsSync(path.join(__dirname, 'public'))) app.use(express.static(path.join(__dirname, 'public')));
if (fs.existsSync(path.join(__dirname, '..', 'public'))) app.use(express.static(path.join(__dirname, '..', 'public')));

// Root route fallback
app.get('/', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, '..', 'index.html'),
    path.join(__dirname, 'public', 'index.html')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  res.send('AI Workspace Server Active!');
});

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const GALLERY_DIR = path.join(DATA_DIR, 'gallery');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });

app.use('/gallery-media', express.static(GALLERY_DIR));

app.get('/api/chats', (req, res) => res.json([]));
app.post('/api/chats', (req, res) => res.json({ id: 'chat_1', messages: [] }));

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
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Введите описание' });

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

    res.json({ success: true, item: imageRecord });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
});

app.get('/api/gallery', (req, res) => res.json([]));
app.get('/api/ollama/status', (req, res) => res.json({ running: false, models: [] }));

app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const msg = '👋 Привет! Ваш персональный ИИ успешно запущен в облаке и работает 24/7. Вкладка Арт-Студия (генерация изображений) работает 100% бесплатно прямо сейчас!';
  res.write('data: ' + JSON.stringify({ chunk: msg }) + '\n\n');
  res.write('data: ' + JSON.stringify({ done: true, fullText: msg }) + '\n\n');
  res.end();
});

app.listen(PORT, () => {
  console.log(`🚀 AI Workspace is ready on port ${PORT}`);
});
