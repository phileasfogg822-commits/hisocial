const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { buildStyledImagePrompt, validateImagePrompt } = require('./imagePromptStyleGuide');
const { composeImageWithLayers } = require('./ppleRenderer');
const { generatePostWithAI } = require('./aiPostGenerator');
const aiRoute = require('../routes/ai'); // Import to access parseStructuredPost
const parseStructuredPost = aiRoute.parseStructuredPost;

const ppleOutputDir = path.join(__dirname, '..', '..', 'uploads', 'pple');
fs.mkdirSync(ppleOutputDir, { recursive: true });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function simpleHash(value = '') {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function normalizeText(text = '') {
  return String(text || '')
    .replace(/[ \t]+/g, ' ')        // collapse spaces/tabs but keep newlines
    .replace(/\n{3,}/g, '\n\n')     // collapse 3+ blank lines into max 2
    .trim();
}

function getBackendBaseUrl() {
  const configured = String(process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_PUBLIC_URL || process.env.LOCAL_BACKEND_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:4000';
}

function normalizeLayerImageSrc(src = '', backendBaseUrl = 'http://localhost:4000') {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('/uploads/')) return `${backendBaseUrl}${raw}`;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname && parsed.pathname.startsWith('/uploads/')) {
      return `${backendBaseUrl}${parsed.pathname}`;
    }
  } catch {
  }
  return raw;
}

function normalizeTemplateLayers(layers = [], backendBaseUrl = 'http://localhost:4000') {
  return (Array.isArray(layers) ? layers : []).map((layer) => {
    if (layer?.type !== 'image') return layer;
    return {
      ...layer,
      src: normalizeLayerImageSrc(layer.src || '', backendBaseUrl),
    };
  });
}

async function applyTemplateOnGeneratedImage(db, userId, baseImageUrl, config, nameSuffix = 'autopilot') {
  const templateId = config?.selected_template_id ? String(config.selected_template_id).trim() : '';
  if (!templateId) return baseImageUrl;

  const backendBaseUrl = getBackendBaseUrl();
  const templateRes = await db.query(
    `SELECT id, name, canvas_width, canvas_height, layers
     FROM pple_templates
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [templateId, userId]
  );

  const template = templateRes.rows[0];
  if (!template) {
    throw new Error(`Configured Auto Pilot template (${templateId}) was not found. Re-select a valid template in Auto Pilot settings.`);
  }

  try {
    const rendered = await composeImageWithLayers({
      baseImageSrc: baseImageUrl,
      layers: normalizeTemplateLayers(template.layers || [], backendBaseUrl),
      outputWidth: template.canvas_width || 1080,
      outputHeight: template.canvas_height || 1080,
    });

    const filename = `autopilot_pple_${uuidv4()}.png`;
    const outputPath = path.join(ppleOutputDir, filename);
    fs.writeFileSync(outputPath, rendered.buffer);

    const localBase = String(process.env.LOCAL_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
    const publicBase = String(process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_PUBLIC_URL || localBase).replace(/\/$/, '');
    const localUrl = `${localBase}/uploads/pple/${filename}`;
    const publicUrl = `${publicBase}/uploads/pple/${filename}`;

    await db.query(
      `INSERT INTO media_uploads (user_id, original_name, storage_path, mime_type, file_size, local_url, public_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId,
        `${nameSuffix}_${template.name || 'template'}.png`,
        outputPath,
        'image/png',
        rendered.buffer.length,
        localUrl,
        publicUrl,
      ]
    );

    return publicUrl || localUrl;
  } catch (e) {
    console.error('Auto Pilot template overlay failed:', e.message);
    throw new Error(`Auto Pilot template overlay failed: ${e.message}`);
  }
}

function pickTextProvider(preferred = '', strict = false) {
  const providers = [];
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_')) providers.push('gemini');
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_')) providers.push('openai');
  if (process.env.BIGMODEL_API_KEY && !process.env.BIGMODEL_API_KEY.startsWith('your_')) providers.push('bigmodel');
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('your_')) providers.push('anthropic');
  if (process.env.GROK_API_KEY && !process.env.GROK_API_KEY.startsWith('your_')) providers.push('grok');

  if (preferred && providers.includes(preferred)) return preferred;
  if (strict) return '';
  return providers[0] || '';
}

// Returns all available text providers with preferred first (used for fallback on 429)
function pickAllTextProviders(preferred = '') {
  const all = [];
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_')) all.push('gemini');
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_')) all.push('openai');
  if (process.env.BIGMODEL_API_KEY && !process.env.BIGMODEL_API_KEY.startsWith('your_')) all.push('bigmodel');
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('your_')) all.push('anthropic');
  if (process.env.GROK_API_KEY && !process.env.GROK_API_KEY.startsWith('your_')) all.push('grok');

  if (preferred && all.includes(preferred)) {
    return [preferred, ...all.filter((p) => p !== preferred)];
  }
  return all;
}

function pickImageProvider(preferred = '', strict = false) {
  const providers = [];
  if (process.env.ALIBABA_DASHSCOPE_API_KEY && !process.env.ALIBABA_DASHSCOPE_API_KEY.startsWith('your_')) providers.push('alibaba');
  if (process.env.DEAPI_API_KEY && !process.env.DEAPI_API_KEY.startsWith('your_')) providers.push('deapi');
  if (process.env.BIGMODEL_API_KEY && !process.env.BIGMODEL_API_KEY.startsWith('your_')) providers.push('bigmodel');
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_')) providers.push('openai');

  if (preferred && providers.includes(preferred)) return preferred;
  if (strict) return '';
  return providers[0] || '';
}

// Template mapping matches App.js detectTemplateFromCategory exactly
const CATEGORY_TEMPLATE_MAP = {
  tech: 'tech',
  technology: 'tech',
  business: 'business',
  finance: 'business',
  analytics: 'growth',
  growth: 'growth',
  data: 'growth',
  product: 'products',
  ecommerce: 'products',
  education: 'educational',
  learning: 'educational',
  lifestyle: 'lifestyle',
};

function buildImagePrompt(content, heading = '', hashtags = '', category = '', niche = '') {
  // Clean content the same way App.js buildImagePrompt does
  const base = String(content || '')
    .replace(/^\s*(HEADING|CONTENT|PICKUP_LINE|CTA|CLOSING|CAPTION|HASHTAGS)\s*:\s*/gim, '')
    .replace(/#[a-zA-Z0-9_]+/g, ' ')
    .replace(/\b(click|read more|follow us|comment below|learn more|dm us|share this)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  const normalizedCategory = String(category || '').toLowerCase();
  let selectedTemplate = 'growth';
  for (const [key, template] of Object.entries(CATEGORY_TEMPLATE_MAP)) {
    if (normalizedCategory.includes(key)) {
      selectedTemplate = template;
      break;
    }
  }

  return buildStyledImagePrompt(base, {
    template: selectedTemplate,
    contentType: 'social_media',
    aspectRatio: '1:1',
    additionalElements: niche ? [niche] : [],
    heading: String(heading || '').slice(0, 100), // Pass heading for zone 2 placement
    hashtags: String(hashtags || '').slice(0, 150), // Pass hashtags for zone 3 icons
  });
}

// Calls one provider with up to 3 retries on 429 using exponential backoff + Retry-After header
async function callOneProviderText(provider, userPrompt, temperature, maxTokens, systemPrompt) {
  const MAX_RETRIES = 3;
  let lastErr;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      if (provider === 'gemini') {
        const combined = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
        const resp = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: combined }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }
        );
        return resp.data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n') || '';
      }

      if (provider === 'openai') {
        const messages = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
          : [{ role: 'user', content: userPrompt }];
        const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4o-mini',
          messages,
          temperature,
          max_tokens: maxTokens,
        }, {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        });
        return resp.data?.choices?.[0]?.message?.content || '';
      }

      if (provider === 'bigmodel') {
        const messages = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
          : [{ role: 'user', content: userPrompt }];
        const resp = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          model: 'glm-4-flash',
          messages,
          temperature,
          max_tokens: maxTokens,
        }, {
          headers: { Authorization: `Bearer ${process.env.BIGMODEL_API_KEY}`, 'Content-Type': 'application/json' },
        });
        return resp.data?.choices?.[0]?.message?.content || '';
      }

      if (provider === 'anthropic') {
        const body = {
          model: 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: userPrompt }],
        };
        if (systemPrompt) body.system = systemPrompt;
        const resp = await axios.post('https://api.anthropic.com/v1/messages', body, {
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
        });
        return resp.data?.content?.[0]?.text || '';
      }

      if (provider === 'grok') {
        const messages = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
          : [{ role: 'user', content: userPrompt }];
        const resp = await axios.post('https://api.x.ai/v1/chat/completions', {
          model: 'grok-beta',
          messages,
          temperature,
          max_tokens: maxTokens,
        }, {
          headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}`, 'Content-Type': 'application/json' },
        });
        return resp.data?.choices?.[0]?.message?.content || '';
      }

      throw new Error(`Unknown provider: ${provider}`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        lastErr = err;
        // Respect Retry-After header if present (Gemini sends it in seconds)
        const retryAfterSec = Number(err.response?.headers?.['retry-after'] || 0);
        const backoffMs = retryAfterSec > 0
          ? retryAfterSec * 1000
          : Math.min(2000 * (2 ** attempt), 30000); // 2s, 4s, 8s … capped at 30s
        console.warn(`[AutoPilot] ${provider} 429 rate-limited — waiting ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoffMs);
        continue;
      }
      throw err; // non-429 errors bubble up immediately
    }
  }
  throw lastErr; // all retries exhausted
}

// Calls preferred provider with retries; if that provider is still 429 after retries,
// automatically falls back to the next available provider.
async function callProviderText(provider, userPrompt, temperature = 0.8, maxTokens = 800, systemPrompt = '') {
  const candidates = pickAllTextProviders(provider);
  if (!candidates.length) throw new Error('No text provider configured for Auto Pilot.');

  let lastErr;
  for (const candidate of candidates) {
    try {
      const result = await callOneProviderText(candidate, userPrompt, temperature, maxTokens, systemPrompt);
      if (candidate !== provider) {
        console.log(`[AutoPilot] Used fallback provider: ${candidate} (preferred: ${provider} was rate-limited)`);
      }
      return result;
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        console.warn(`[AutoPilot] ${candidate} still rate-limited after retries — trying next provider`);
        lastErr = new Error(`${candidate} rate-limited (429). Try again in a few minutes or switch provider in Auto Pilot settings.`);
        continue;
      }
      throw err; // non-429: don't fall back, surface real error
    }
  }
  throw lastErr || new Error('All text providers are rate-limited. Try again in a few minutes.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(provider, prompt) {
  const size = '1024x1024';
  const [width, height] = size.split('x').map((n) => Number(n));

  if (provider === 'deapi') {
    const headers = {
      Authorization: `Bearer ${process.env.DEAPI_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };

    const createRes = await axios.post('https://api.deapi.ai/api/v1/client/txt2img', {
      prompt,
      model: 'Flux_2_Klein_4B_BF16',
      width,
      height,
      guidance: 1,
      steps: 4,
      seed: Math.floor(Math.random() * 2147483647),
      negative_prompt: 'text, typography, words, letters, headline, title, caption, paragraph, watermark, logo text, brand text'
    }, { headers, timeout: 30000 });

    const requestId = createRes.data?.data?.request_id || createRes.data?.request_id;
    if (!requestId) {
      const immediateUrl = createRes.data?.url || createRes.data?.data?.url;
      if (immediateUrl) return immediateUrl;
      throw new Error('DEAPI did not return request_id');
    }

    for (let i = 0; i < 30; i += 1) {
      const statusRes = await axios.get(`https://api.deapi.ai/api/v1/client/request-status/${requestId}`, { headers, timeout: 30000 });
      const data = statusRes.data?.data || {};
      const status = String(data.status || '').toLowerCase();
      if (status === 'done') {
        const url = data.result_url || data.url || data.image_url || data.results_alt_formats?.webp || data.results_alt_formats?.jpg;
        if (url) return url;
        if (data.preview) return data.preview.startsWith('data:') ? data.preview : `data:image/png;base64,${data.preview}`;
        throw new Error('DEAPI done without result URL');
      }
      if (status === 'error') throw new Error(data.error_message || 'DEAPI generation failed');
      await sleep(i < 8 ? 2000 : 3000);
    }
    throw new Error('DEAPI generation timed out');
  }

  if (provider === 'bigmodel') {
    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/images/generations', {
      model: 'cogview-3-flash',
      prompt,
      size,
      n: 1
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BIGMODEL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const url = response.data?.data?.[0]?.url || response.data?.data?.[0]?.image_url || response.data?.image_urls?.[0]?.url;
    if (!url) throw new Error('BigModel image generation returned no URL');
    return url;
  }

  if (provider === 'openai') {
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'standard'
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const url = response.data?.data?.[0]?.url;
    if (!url) throw new Error('OpenAI image generation returned no URL');
    return url;
  }

  if (provider === 'alibaba') {
    const apiKey = process.env.ALIBABA_DASHSCOPE_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) {
      throw new Error('Alibaba API key not configured');
    }

    const region = String(process.env.ALIBABA_REGION || 'singapore').toLowerCase();
    const endpoint = region === 'beijing'
      ? 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
      : 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

    const response = await axios.post(endpoint, {
      model: 'wan2.7-image-pro',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      parameters: {
        size: '1024*1024',
        n: 1,
        watermark: false,
        thinking_mode: true
      }
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const url = response.data?.output?.choices?.[0]?.message?.content?.[0]?.image;
    if (!url) {
      const errorMsg = response.data?.message || 'Alibaba image generation returned no URL';
      throw new Error(errorMsg);
    }
    return url;
  }

  throw new Error('No image provider configured for Auto Pilot.');
}

// Tone guide matches ai.js generatePosts() exactly
const TONE_GUIDE = {
  funny:         'humorous, witty, and laugh-out-loud funny',
  serious:       'serious, authoritative, and data-driven',
  motivational:  'inspiring, uplifting, and action-driving',
  sad:           'emotional, empathetic, and deeply heartfelt',
  angry:         'urgent, passionate, and strongly opinionated',
  warning:       'cautionary, alarming, and important alert',
  storytelling:  'compelling narrative story format with a hook',
  sarcastic:     'sarcastic, ironic, and cleverly witty',
  professional:  'professional, polished, and business-appropriate',
  casual:        'casual, conversational, friendly, and approachable',
  inspirational: 'inspiring, uplifting, and deeply motivating',
  educational:   'informative, clear, and teaching-focused',
};

const SYSTEM_PROMPT = 'You are an elite social media content strategist with 10+ years of experience creating viral content. You specialize in crafting posts that drive engagement, shares, and conversions across all major platforms.';

function buildTextPrompt({ topic, niche, category, tone, platforms, angle }) {
  const toneDesc = TONE_GUIDE[tone] || TONE_GUIDE.professional;
  const nicheNote = niche ? `Industry/Niche: ${niche}. ` : '';
  const categoryNote = category ? `Category: ${category}. ` : '';
  const platformNote = Array.isArray(platforms) && platforms.length > 0
    ? `Optimized for: ${platforms.join(', ')}. `
    : '';

  const userPrompt = `Create one completely unique, highly engaging social media post about: "${topic}"

${nicheNote}${categoryNote}${platformNote}Tone: ${toneDesc}
Emoji usage: Use 1-2 relevant emojis per post naturally.
Character limit: Maximum 700 characters.
Unique angle: ${angle}

Requirements:
- Write authentically — avoid generic AI-sounding phrases
- Include a clear value proposition or call-to-action naturally
- Make it shareable and scroll-stopping
- Output plain post text only (NO labels like HEADING:, CONTENT:, etc.)
- Flow should naturally read as: attention-grabbing heading, body content, pickup line, CTA, closing, caption, and hashtags
- Include relevant hashtags in the final line(s), each beginning with #
- Keep the final output highly readable and natural, not template-looking

Output ONLY the post text, nothing else.`;

  return { system: SYSTEM_PROMPT, user: userPrompt };
}

function generateTimeSlots(postsPerDay) {
  const safe = clamp(postsPerDay, 1, 5);
  const startMinutes = 9 * 60;
  const endMinutes = 21 * 60;

  if (safe === 1) {
    const midpoint = Math.round((startMinutes + endMinutes) / 2);
    return [{ hour: Math.floor(midpoint / 60), minute: midpoint % 60 }];
  }

  const interval = (endMinutes - startMinutes) / (safe - 1);
  return Array.from({ length: safe }).map((_, index) => {
    const value = Math.round(startMinutes + (interval * index));
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return { hour, minute };
  });
}

const KARACHI_OFFSET_MINUTES = 5 * 60;

function karachiDatePartsFromUtc(date) {
  const karachiMillis = date.getTime() + (KARACHI_OFFSET_MINUTES * 60 * 1000);
  const karachi = new Date(karachiMillis);
  return {
    year: karachi.getUTCFullYear(),
    month: karachi.getUTCMonth(),
    day: karachi.getUTCDate(),
  };
}

function utcDateFromKarachiParts(year, monthZeroIndexed, day, hour, minute, dayOffset = 0) {
  const utcMillis = Date.UTC(year, monthZeroIndexed, day + dayOffset, hour, minute, 0) - (KARACHI_OFFSET_MINUTES * 60 * 1000);
  return new Date(utcMillis);
}

async function isDuplicateContent(db, userId, content) {
  const normalized = normalizeText(content);
  const result = await db.query(
    `SELECT id FROM posts WHERE user_id=$1 AND content=$2 LIMIT 1`,
    [userId, normalized]
  );
  return result.rowCount > 0;
}

async function isAutopilotKilled(db) {
  try {
    const result = await db.query(`SELECT killed FROM autopilot_control WHERE id=1`);
    return Boolean(result.rows[0]?.killed);
  } catch {
    return false;
  }
}

async function noteAutopilotFailure(db, userId) {
  const { afterFailure } = require('../utils/autopilotSafety');
  const config = await getAutoPilotConfig(db, userId);
  if (!config) return;
  const next = afterFailure(config.consecutive_failures || 0);
  if (next.shouldDisable) {
    await db.query(
      `UPDATE ai_autopilot_configs SET consecutive_failures=$1, enabled=false, disabled_reason='auto-disabled after 3 consecutive failed runs', updated_at=NOW() WHERE user_id=$2`,
      [next.consecutiveFailures, userId]
    );
  } else {
    await db.query(
      `UPDATE ai_autopilot_configs SET consecutive_failures=$1, updated_at=NOW() WHERE user_id=$2`,
      [next.consecutiveFailures, userId]
    );
  }
}

async function getAutoPilotConfig(db, userId) {
  const result = await db.query(
    `SELECT * FROM ai_autopilot_configs WHERE user_id=$1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function runAutoPilotForUser(db, userId, { force = false } = {}) {
  const { shouldSkipRun, remainingForToday } = require('../utils/autopilotSafety');
  const config = await getAutoPilotConfig(db, userId);
  if (!config) throw new Error('Auto Pilot is not configured yet.');
  const today = new Date().toISOString().slice(0, 10);
  const killed = await isAutopilotKilled(db);
  const skipReason = shouldSkipRun({ killed, enabled: config.enabled, force, lastRunOn: config.last_run_on, today });
  if (skipReason) return { status: 'skipped', reason: skipReason, generated: 0, scheduled: 0, duplicates: 0 };

  const postsPerDay = clamp(Number(config.posts_per_day) || 1, 1, 5);
  // Phase 19 daily cap: count the day's autopilot posts
  // before scheduling more, so a force run cannot push
  // the day past posts_per_day.
  const todayCountRes = await db.query(
    `SELECT COUNT(*) AS count FROM posts WHERE user_id=$1 AND autopilot_generated=true AND created_at::date = CURRENT_DATE`,
    [userId]
  );
  const remaining = remainingForToday(Number(todayCountRes.rows[0]?.count || 0), postsPerDay);
  if (remaining <= 0) {
    return { status: 'skipped', reason: 'daily-cap-reached', generated: 0, scheduled: 0, duplicates: 0 };
  }
  const topic = normalizeText(config.topic);
  if (!topic) throw new Error('Auto Pilot topic is required.');

  // Use the AI Creative Engine for post generation
  const textProvider = pickTextProvider(config.text_provider || '', true);
  const imageProvider = pickImageProvider(config.image_provider || '', true);
  if (!textProvider) throw new Error('Select a valid Text AI provider in Auto Pilot settings.');
  if (!imageProvider) throw new Error('Select a valid Image AI provider in Auto Pilot settings.');

  const platforms = Array.isArray(config.platforms) && config.platforms.length > 0
    ? config.platforms
    : ['instagram', 'linkedin', 'facebook'];

  const slots = generateTimeSlots(postsPerDay);
  const now = new Date();
  const pkDateParts = karachiDatePartsFromUtc(now);
  const slotDates = slots.map((slot) => utcDateFromKarachiParts(
    pkDateParts.year,
    pkDateParts.month,
    pkDateParts.day,
    slot.hour,
    slot.minute,
    0
  ));
  const shouldShiftToTomorrow = slotDates.some((slotDate) => slotDate <= now);
  const scheduledDates = slotDates.map((slotDate) => {
    if (!shouldShiftToTomorrow) return slotDate;
    const shifted = new Date(slotDate);
    shifted.setDate(shifted.getDate() + 1);
    return shifted;
  });

  let generated = 0;
  let scheduled = 0;
  let duplicates = 0;

  const postsToSchedule = Math.min(postsPerDay, remaining);
  let failedPosts = 0;
  for (let i = 0; i < postsToSchedule; i += 1) {
    try {
    // Generate content using the AI Creative Engine
    const aiResult = await generatePostWithAI(
      {
        tone: config.tone || 'professional',
        niche: config.niche || 'general',
        category: config.category || 'general',
        topic: topic,
        provider: textProvider,
        // Include additional V2 engine parameters
        heading: '',
        post_text: '',
        hashtags: [],
        ratio: '1:1',
        style: 'modern',
        useEngine: true,
        enhanceWithGemini: false
      },
      userId,
      db
    );

    const content = aiResult.content.post_content;
    if (!content) continue;

    generated += 1;

    if (await isDuplicateContent(db, userId, content)) {
      duplicates += 1;
      continue;
    }

    // Apply template overlay if configured
    const finalImageUrl = aiResult.content.generated_image_url 
      ? await applyTemplateOnGeneratedImage(
          db,
          userId,
          aiResult.content.generated_image_url,
          config,
          `autopilot_${today}_${i + 1}`
        )
      : null;

    const scheduledAt = scheduledDates[i] || scheduledDates[scheduledDates.length - 1];

    await db.query(
      `INSERT INTO posts
       (user_id, content, platforms, media_urls, status, scheduled_at, facebook_page_ids, linkedin_target_ids, autopilot_generated, generation_source, generation_batch_id, generation_index, generation_total)
       VALUES ($1,$2,$3,$4,'scheduled',$5,$6,$7,true,$8,$9,$10,$11)`,
      [
        userId,
        content,
        platforms,
        finalImageUrl ? [finalImageUrl] : [],
        scheduledAt,
        config.facebook_page_ids || [],
        config.linkedin_target_ids || [],
        'ai_creative_engine_autopilot',
        `ai_auto_${today}`,
        i + 1,
        postsPerDay,
      ]
    );

    await db.query(
      `INSERT INTO ai_content_memory
       (user_id, content_text, topic, tone, platforms, keywords, hook, content_hash, engagement, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [
        userId,
        content,
        topic,
        config.tone || 'professional',
        platforms,
        [],
        content.split(/[.!?\n]/).map((part) => part.trim()).filter(Boolean)[0] || content.slice(0, 120),
        simpleHash(content),
        JSON.stringify({}),
      ]
    );

    scheduled += 1;
    } catch (e) {
      // Phase 19: one bad post fails that post, not the run.
      failedPosts += 1;
      console.error(`🤖 AutoPilot: post ${i + 1} failed for user ${userId}:`, e.message);
    }
  }

  const runStatus = failedPosts > 0 ? (scheduled > 0 ? 'partial' : 'failed') : 'success';
  await db.query(
    `UPDATE ai_autopilot_configs
     SET last_run_on=$2, last_run_at=NOW(), consecutive_failures=0, disabled_reason=NULL, updated_at=NOW()
     WHERE user_id=$1`,
    [userId, today]
  );

  await db.query(
    `INSERT INTO ai_autopilot_runs (user_id, config_id, run_date, generated_count, scheduled_count, duplicate_count, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, config.id, today, generated, scheduled, duplicates, runStatus]
  );

  return { status: runStatus, generated, scheduled, duplicates, failed: failedPosts, textProvider, imageProvider };
}

async function runAutoPilotSweep(db) {
  if (await isAutopilotKilled(db)) {
    console.log('🤖 AutoPilot: killed — sweep skipped');
    return { status: 'skipped', reason: 'killed' };
  }
  const result = await db.query(
    `SELECT user_id FROM ai_autopilot_configs
     WHERE enabled=true
       AND (last_run_on IS NULL OR last_run_on < CURRENT_DATE)`
  );

  for (const row of result.rows) {
    try {
      const summary = await runAutoPilotForUser(db, row.user_id, { force: false });
      console.log(`🤖 AutoPilot: user ${row.user_id} -> ${summary.status} (scheduled: ${summary.scheduled || 0})`);
    } catch (e) {
      console.error(`🤖 AutoPilot: user ${row.user_id} failed:`, e.message);
      await noteAutopilotFailure(db, row.user_id).catch(() => {});
      await db.query(
        `INSERT INTO ai_autopilot_runs (user_id, run_date, generated_count, scheduled_count, duplicate_count, status, error_message)
         VALUES ($1,$2,0,0,0,'failed',$3)`,
        [row.user_id, new Date().toISOString().slice(0, 10), e.message]
      ).catch(() => {});
    }
  }
}

function createAutoPilotWorker({ db }) {
  if (!db) return;
  console.log('🤖 Auto Pilot worker started — checking every 10 minutes');
  setInterval(() => {
    runAutoPilotSweep(db).catch((e) => console.error('🤖 AutoPilot sweep failed:', e.message));
  }, 10 * 60 * 1000);

  runAutoPilotSweep(db).catch((e) => console.error('🤖 Initial AutoPilot sweep failed:', e.message));
}

module.exports = {
  createAutoPilotWorker,
  runAutoPilotForUser,
  runAutoPilotSweep,
  isAutopilotKilled
};
