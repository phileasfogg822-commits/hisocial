const express = require('express');
const axios = require('axios');
const router = express.Router();
const { executeAISocialCreativeEngineV2 } = require('../services/aiSocialCreativeEngineV2');
const { executeWithGeminiThinking } = require('../services/aiSocialCreativeEngineV2Gemini');

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// Phase 12: the provider list lives in the registry
// (utils/aiProviders.js), not hardcoded here. This keeps
// the backend list, the Settings list, and the generation
// fallback chain on the same single source of truth.
const { listProviders, availableTextProviders, getProviderSpec } = require('../utils/aiProviders');

// Kept for the generation path: providers it may actually
// call today (configured, live text APIs — Muse excluded
// until the Phase 14 queue exists).
function getAvailableProviders() {
  return availableTextProviders();
}

// Best-effort merge of the last recorded test status
// (ai_provider_tests). A missing table or DB never breaks
// the provider list — status is just null.
async function withTestStatus(db, providers) {
  if (!db) return providers;
  try {
    const result = await db.query(`SELECT provider_id, last_status, last_detail, last_tested_at FROM ai_provider_tests`);
    const byId = {};
    for (const row of result.rows) byId[row.provider_id] = row;
    return providers.map((p) => ({
      ...p,
      lastTestStatus: byId[p.id]?.last_status || null,
      lastTestDetail: byId[p.id]?.last_detail || null,
      lastTestedAt: byId[p.id]?.last_tested_at || null,
    }));
  } catch {
    return providers;
  }
}

async function recordTestStatus(db, providerId, status, detail) {
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO ai_provider_tests (provider_id, last_status, last_detail, last_tested_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT (provider_id) DO UPDATE SET last_status=$2, last_detail=$3, last_tested_at=NOW(), updated_at=NOW()`,
      [providerId, status, String(detail || '').substring(0, 500)]
    );
  } catch {
    // Test recording must never fail the test itself.
  }
}

router.get('/providers', requireAuth, async (req, res) => {
  const providers = await withTestStatus(req.app.locals.db, listProviders());
  res.json(providers);
});

// Phase 13: assignment CRUD + picker options. Scopes:
// global (every generation), group (an account group),
// account (one connected social account). Precedence is
// resolved by utils/aiAssignments, not here.
const { validateAssignmentInput, resolveAiProvider } = require('../utils/aiAssignments');

router.get('/assignments', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const result = await db.query(
    `SELECT id, scope_type, scope_key, task_kind, provider_id, updated_at
     FROM ai_assignments WHERE user_id=$1 ORDER BY scope_type, task_kind`,
    [req.user.id]
  );
  res.json(result.rows);
});

router.get('/assignment-options', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const [groups, accounts] = await Promise.all([
    db.query(`SELECT id, name FROM account_groups WHERE user_id=$1 ORDER BY name`, [req.user.id]),
    db.query(
      `SELECT id, platform, platform_username FROM social_accounts WHERE user_id=$1 AND is_active=true ORDER BY platform, platform_username`,
      [req.user.id]
    ),
  ]);
  res.json({ groups: groups.rows, accounts: accounts.rows });
});

router.post('/assignments', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const checked = validateAssignmentInput(req.body || {});
  if (!checked.ok) return res.status(400).json({ error: checked.error });
  const a = checked.assignment;
  // Ownership: a group or account assignment must name
  // one of this user's own groups or accounts.
  if (a.scope_type === 'group') {
    const own = await db.query(`SELECT id FROM account_groups WHERE id=$1 AND user_id=$2`, [a.scope_key, req.user.id]);
    if (!own.rows[0]) return res.status(404).json({ error: 'Group not found' });
  }
  if (a.scope_type === 'account') {
    const own = await db.query(`SELECT id FROM social_accounts WHERE id=$1 AND user_id=$2`, [a.scope_key, req.user.id]);
    if (!own.rows[0]) return res.status(404).json({ error: 'Account not found' });
  }
  const result = await db.query(
    `INSERT INTO ai_assignments (user_id, scope_type, scope_key, task_kind, provider_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, scope_type, scope_key, task_kind) DO UPDATE SET provider_id=$5, updated_at=NOW()
     RETURNING *`,
    [req.user.id, a.scope_type, a.scope_key, a.task_kind, a.provider_id]
  );
  res.status(201).json(result.rows[0]);
});

router.delete('/assignments/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const result = await db.query(
    `DELETE FROM ai_assignments WHERE id=$1 AND user_id=$2 RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ deleted: true });
});

router.post('/test', requireAuth, async (req, res) => {
  const { provider = 'gemini', prompt = 'Reply with one short sentence confirming the Gemini API key is working.' } = req.body || {};
  const db = req.app.locals.db;
  const registry = listProviders();
  const selectedProvider = registry.find((item) => item.id === provider);
  const spec = getProviderSpec(provider);

  if (!selectedProvider || !spec) {
    return res.status(400).json({ error: `Unknown AI provider: ${provider}` });
  }

  // Phase 12: Muse and image-only providers get honest
  // non-live answers, recorded like any other test, so
  // Settings shows their real state instead of a 400
  // that looks like a broken test button.
  if (spec.testKind === 'queue') {
    const detail = spec.note;
    await recordTestStatus(db, provider, 'unavailable', detail);
    return res.json({
      ok: false,
      status: 'unavailable',
      provider: selectedProvider.id,
      provider_name: selectedProvider.name,
      text: detail,
    });
  }

  if (spec.testKind === 'image-manual') {
    const detail = `${selectedProvider.name} is image-only and has no free probe endpoint — generate one image to verify it.`;
    await recordTestStatus(db, provider, 'untestable', detail);
    return res.json({
      ok: false,
      status: 'untestable',
      provider: selectedProvider.id,
      provider_name: selectedProvider.name,
      text: detail,
    });
  }

  if (!selectedProvider.configured) {
    return res.status(400).json({
      error: `${provider} is not configured. Add the API key in docker-compose.yml and recreate the backend.`
    });
  }

  try {
    const text = await testProvider(provider, prompt);
    await recordTestStatus(db, provider, 'ok', text);
    res.json({
      ok: true,
      status: 'ok',
      provider: selectedProvider.id,
      provider_name: selectedProvider.name,
      text
    });
  } catch (e) {
    const message = e.response?.data?.error?.message || e.message;
    await recordTestStatus(db, provider, 'failed', message);
    console.error('AI test error:', e.response?.data || e.message);
    res.status(500).json({ error: message });
  }
});

router.post('/generate', requireAuth, async (req, res) => {
  const {
    topic,
    tone = 'professional',
    emoji_level = 'light',
    max_length = 300,
    count = 3,
    niche = '',
    platforms = [],
    provider: preferredProvider = '',
    group_id = null,
    account_id = null,
    language = 'en',
    format = 'post'
  } = req.body;

  if (!topic?.trim()) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  const { validateGenerationOptions } = require('../utils/languagePacks');
  const checkedOptions = validateGenerationOptions({ language, format });
  if (!checkedOptions.ok) {
    return res.status(400).json({ error: checkedOptions.error });
  }

  const available = getAvailableProviders().filter((provider) => provider.hasText !== false);
  if (available.length === 0) {
    return res.status(400).json({
      error: 'No text AI provider configured. Add OPENAI_API_KEY, GEMINI_API_KEY, BIGMODEL_API_KEY, ANTHROPIC_API_KEY, or GROK_API_KEY in docker-compose.yml and recreate the backend.'
    });
  }

  // Phase 12: Muse appears in provider lists as the
  // preferred generator, but generation via the task
  // queue lands in Phase 14. Refuse it plainly here
  // instead of silently substituting another provider.
  // Phase 13: when no explicit provider is given, the
  // assignment chain (account > group > global) picks
  // one; an explicit provider still wins outright.
  let resolvedProvider = null;
  if (!preferredProvider) {
    const db = req.app.locals.db;
    try {
      const rows = await db.query(
        `SELECT scope_type, scope_key, task_kind, provider_id FROM ai_assignments WHERE user_id=$1`,
        [req.user.id]
      );
      let accountGroupId = group_id;
      if (!accountGroupId && account_id) {
        const account = await db.query(
          `SELECT group_id FROM social_accounts WHERE id=$1 AND user_id=$2`,
          [account_id, req.user.id]
        );
        accountGroupId = account.rows[0]?.group_id || null;
      }
      resolvedProvider = resolveAiProvider({
        assignments: rows.rows,
        taskKind: 'text',
        accountScopeKey: account_id,
        groupScopeKey: accountGroupId,
        configuredIds: new Set([...available.map((p) => p.id), 'muse']),
      });
    } catch {
      resolvedProvider = null;
    }
  }

  if (preferredProvider === 'muse' || resolvedProvider === 'muse') {
    return res.status(400).json({
      error: 'Muse generation arrives with the Phase 14 task queue. Pick another provider for now.'
    });
  }

  const preferred = available.find(p => p.id === preferredProvider)
    || (resolvedProvider && available.find(p => p.id === resolvedProvider))
    || available[0];

  // Build fallback chain: preferred first, then remaining providers in configured order
  const providerChain = [preferred, ...available.filter(p => p.id !== preferred.id)];

  let lastError = null;
  for (const provider of providerChain) {
    try {
      const posts = await generatePosts({
        topic: topic.trim(),
        tone,
        emoji_level,
        max_length: Math.min(parseInt(max_length) || 300, 3000),
        count: Math.min(Math.max(parseInt(count) || 3, 1), 20),
        niche: niche.trim(),
        platforms,
        provider: provider.id,
        language,
        format
      });
      return res.json({ posts, provider: provider.id, provider_name: provider.name, language, format });
    } catch (e) {
      const status = e.response?.status;
      const isQuotaError = status === 429 || status === 503 ||
        (e.response?.data?.error?.message || e.message || '').toLowerCase().includes('quota');
      if (isQuotaError && providerChain.indexOf(provider) < providerChain.length - 1) {
        console.warn(`AI generate: ${provider.id} quota/rate-limit, trying next provider`);
        lastError = e;
        continue;
      }
      console.error('AI generate error:', e.response?.data || e.message);
      return res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
  }
  console.error('AI generate: all providers failed:', lastError?.response?.data || lastError?.message);
  res.status(500).json({ error: 'All AI providers are currently unavailable. Please try again later.' });
});

function getPreferredImageProvider(preferredProvider) {
  const imageProviders = getAvailableProviders().filter((provider) => provider.hasImage);
  if (preferredProvider) {
    return imageProviders.find((provider) => provider.id === preferredProvider) || null;
  }

  return imageProviders.find((provider) => provider.id === 'deapi')
    || imageProviders.find((provider) => provider.id === 'bigmodel')
    || imageProviders.find((provider) => provider.id === 'alibaba')
    || imageProviders.find((provider) => provider.id === 'openai')
    || null;
}

function extractDeapiImageUrl(payload) {
  const candidates = [
    payload?.url,
    payload?.image_url,
    payload?.result?.url,
    payload?.data?.url,
    payload?.data?.image_url,
    payload?.data?.result?.url,
    payload?.data?.images?.[0]?.url,
    payload?.data?.images?.[0]?.image_url,
    payload?.data?.[0]?.url,
    payload?.data?.[0]?.image_url,
    payload?.result?.[0]?.url,
    payload?.result?.[0]?.image_url,
    typeof payload?.result?.[0] === 'string' ? payload.result[0] : null,
    typeof payload?.data?.result?.[0] === 'string' ? payload.data.result[0] : null,
  ].filter(Boolean);

  if (candidates[0]) return candidates[0];

  const base64Image = payload?.b64_json
    || payload?.image_base64
    || payload?.data?.b64_json
    || payload?.data?.image_base64
    || payload?.data?.[0]?.b64_json;

  return base64Image ? `data:image/png;base64,${base64Image}` : '';
}

function buildFallbackHashtags(topic, niche = '') {
  const seeds = `${topic || ''} ${niche || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length >= 3)
    .slice(0, 4)
    .map((word) => `#${word}`);

  const unique = Array.from(new Set(['#socialmedia', '#marketing', ...seeds]));
  return unique.slice(0, 6).join(' ');
}

function parseStructuredPost(rawPost, topic, niche) {
  let post = String(rawPost || '').trim();
  if (!post) return { heading: '', body: '', hashtags: '' };

  // Extract HEADING: ... section
  const headingMatch = post.match(/^HEADING:\s*(.+?)(?:\nBODY:|$)/i);
  const heading = headingMatch ? headingMatch[1].trim().slice(0, 300) : '';

  // Extract BODY: ... section
  const bodyMatch = post.match(/^BODY:\s*(.+?)(?:\nHASHTAGS:|$)/im);
  let body = bodyMatch ? bodyMatch[1].trim() : '';

  // Extract HASHTAGS: ... section
  const hashtagsMatch = post.match(/^HASHTAGS:\s*(.+?)$/im);
  let hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : '';

  // Clean up body: remove any label prefixes
  body = body
    .replace(/^\s*(HEADING|CONTENT|PICKUP_LINE|CTA|CLOSING|CAPTION|HASHTAGS)\s*:\s*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Ensure heading is max 7 words
  const headingWords = heading.split(/\s+/).slice(0, 7);
  const cleanHeading = headingWords.join(' ');

  // Extract hashtags properly: only #word format, space-separated
  const hashtagTokens = Array.from(new Set(
    (hashtags.match(/#[a-zA-Z0-9_]+/g) || [])
  ));

  // If no hashtags found in dedicated section, extract from body
  if (hashtagTokens.length === 0) {
    const bodyHashtags = body.match(/#[a-zA-Z0-9_]+/g) || [];
    hashtagTokens.push(...Array.from(new Set(bodyHashtags)));
  }

  // Remove any hashtags from body to avoid duplication
  body = body
    .replace(/#[a-zA-Z0-9_]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Fallback hashtags if none found
  const finalHashtags = hashtagTokens.length > 0 ? hashtagTokens.join(' ') : buildFallbackHashtags(topic, niche);

  return {
    heading: cleanHeading,
    body: body,
    hashtags: finalHashtags,
    // For backward compatibility, include full text
    full_text: [cleanHeading, body, finalHashtags].filter(Boolean).join('\n\n')
  };
}

function normalizeGeneratedPostText(rawPost, topic, niche) {
  const parsed = parseStructuredPost(rawPost, topic, niche);
  return parsed.full_text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveDeapiResultUrl(statusPayload) {
  const data = statusPayload?.data || {};

  const directUrl = data.result_url
    || data.url
    || data.image_url
    || data.result?.url
    || data.results_alt_formats?.webp
    || data.results_alt_formats?.jpg;
  if (directUrl) return directUrl;

  const preview = data.preview;
  if (typeof preview === 'string' && preview.trim()) {
    // DEAPI preview is base64 (no prefix). Convert to data URL for frontend rendering.
    if (preview.startsWith('data:')) return preview;
    return `data:image/png;base64,${preview}`;
  }

  return '';
}

async function pollDeapiUntilReady(requestId, headers) {
  const maxAttempts = 30;
  const baseIntervalMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const statusRes = await axios.get(`https://api.deapi.ai/api/v1/client/request-status/${requestId}`, {
      headers,
      timeout: 30000,
    });

    const data = statusRes.data?.data || {};
    const status = String(data.status || '').toLowerCase();

    if (status === 'done') {
      const url = resolveDeapiResultUrl(statusRes.data);
      if (!url) {
        throw new Error('DEAPI returned status=done but no result_url/preview was provided.');
      }
      return {
        url,
        statusPayload: statusRes.data,
      };
    }

    if (status === 'error') {
      const errorMsg = data.error_message || data.error || 'DEAPI job failed with status=error';
      throw new Error(errorMsg);
    }

    // Adaptive wait: slow down as attempts increase.
    const waitMs = attempt <= 8 ? baseIntervalMs : 3000;
    await sleep(waitMs);
  }

  throw new Error('DEAPI request timed out while waiting for image generation result.');
}

router.post('/image', requireAuth, async (req, res) => {
  // V2.0: EITHER accept a direct prompt OR use engine input fields
  const {
    // Legacy path: direct prompt
    prompt,
    style = 'realistic',
    aspect_ratio = '1:1',
    provider: preferredProvider = '',
    
    // V2.0 Engine path: 9 input fields
    tone,
    niche,
    category,
    topic,
    post_text,
    heading,
    hashtags,
    ratio,
    
    // V2.0 flags
    useEngine = false,
    enginePrompt = null,
    
    // GEMINI ENHANCEMENT FLAG
    enhanceWithGemini = false
  } = req.body;

  // Determine which path to use
  const shouldUseEngine = useEngine || (tone && category && heading && topic) || enginePrompt;
  
  let finalPrompt = null;
  let engineResult = null;
  let validationData = null;

  if (shouldUseEngine && enginePrompt) {
    // Direct engine prompt provided (pre-computed by frontend)
    finalPrompt = enginePrompt;
  } else if (shouldUseEngine && (tone && category && heading && topic)) {
    // Run V2.0 engine orchestration (with optional Gemini enhancement)
    try {
      const engineInput = {
        tone: tone || 'professional',
        niche: niche || '',
        category: category || '',
        topic: topic || '',
        post_text: post_text || '',
        heading: heading || '',
        hashtags: hashtags || [],
        ratio: ratio || aspect_ratio || '1:1',
        style: style
      };

      // Use Gemini-enhanced version if requested and available
      if (enhanceWithGemini) {
        console.log('🧠 Using Gemini-enhanced thinking layer...');
        engineResult = await executeWithGeminiThinking(engineInput);
      } else {
        engineResult = executeAISocialCreativeEngineV2(engineInput);
      }

      validationData = engineResult.validation;

      // CHECK: Validation passed?
      if (validationData && !validationData.passed) {
        return res.status(400).json({
          error: 'Design failed validation checks',
          recommendation: engineResult.recommendation,
          validation: {
            passed: false,
            scores: validationData.checks,
            failed_checks: validationData.failed_checks
          },
          enhanced: engineResult.enhanced
        });
      }

      // Use engine-generated prompt
      finalPrompt = engineResult.prompt || prompt;
    } catch (engineError) {
      console.error('Engine orchestration error:', engineError);
      return res.status(500).json({
        error: 'Design engine error',
        details: engineError.message
      });
    }
  } else {
    // Legacy path: use direct prompt
    finalPrompt = prompt;
  }

  // Validate we have a prompt
  if (!finalPrompt?.trim()) {
    return res.status(400).json({
      error: 'Prompt is required (either provide "prompt" directly or enable engine with tone, category, heading, topic)'
    });
  }

  const selectedProvider = getPreferredImageProvider(preferredProvider);
  if (!selectedProvider) {
    return res.status(400).json({ error: 'No image generation provider configured. Add DEAPI_API_KEY, BIGMODEL_API_KEY, or OPENAI_API_KEY to docker-compose.yml.' });
  }

  const sizeMap = { '1:1': '1024x1024', '4:5': '1024x1280', '16:9': '1792x1024', '9:16': '1024x1792' };
  const size = sizeMap[aspect_ratio] || '1024x1024';
  const [width, height] = size.split('x').map((value) => parseInt(value, 10) || 1024);

  const styleDescriptions = {
    realistic: 'photorealistic, high quality photography, 8k',
    illustration: 'digital illustration, vector art style, vibrant',
    cartoon: 'cartoon style, vibrant colors, animated look',
    '3d': '3D render, CGI, octane render, professional quality',
    cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic city, dark',
    minimal: 'minimalist design, clean lines, simple, white background'
  };

  // Helper function to build response with engine metadata
  const buildResponse = (imageResponse) => {
    const response = {
      ...imageResponse,
      // Add V2.0 engine metadata if available
      ...(engineResult && {
        engine: {
          status: engineResult.status,
          recommendation: engineResult.recommendation,
          validation: validationData?.checks,
          decisions: engineResult.decisions
        }
      })
    };
    return response;
  };

  const enhancedPrompt = `${finalPrompt.trim()}. Style: ${styleDescriptions[style] || styleDescriptions.realistic}. Social media optimized image.`;

  try {
    if (selectedProvider.id === 'deapi') {
      const deapiHeaders = {
        Authorization: `Bearer ${process.env.DEAPI_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      };

      const response = await axios.post('https://api.deapi.ai/api/v1/client/txt2img', {
        prompt: enhancedPrompt,
        model: 'Flux_2_Klein_4B_BF16',
        width,
        height,
        guidance: 1,
        negative_prompt: 'text, typography, words, letters, headline, title, caption, paragraph, watermark, logo text, brand text',
        seed: Math.floor(Math.random() * 2147483647),
        steps: 4
      }, {
        headers: deapiHeaders,
        timeout: 30000,
      });

      const immediateUrl = extractDeapiImageUrl(response.data);
      if (immediateUrl) {
        return res.json(buildResponse({
          url: immediateUrl,
          revised_prompt: enhancedPrompt,
          provider: 'deapi'
        }));
      }

      const requestId = response.data?.data?.request_id || response.data?.request_id;
      if (!requestId) {
        return res.status(500).json({
          error: 'DEAPI accepted the request but did not return request_id or image data.',
          debug: {
            top_level_keys: Object.keys(response.data || {}),
            data_keys: response.data?.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data)
              ? Object.keys(response.data.data)
              : [],
          }
        });
      }

      const result = await pollDeapiUntilReady(requestId, deapiHeaders);

      return res.json(buildResponse({
        url: result.url,
        revised_prompt: enhancedPrompt,
        provider: 'deapi',
        request_id: requestId,
      }));
    }

    if (selectedProvider.id === 'bigmodel') {
      const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/images/generations', {
        model: 'cogview-3-flash',
        prompt: enhancedPrompt,
        size,
        n: 1
      }, {
        headers: {
          Authorization: `Bearer ${process.env.BIGMODEL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const url = response.data?.data?.[0]?.url || response.data?.data?.[0]?.image_url || response.data?.image_urls?.[0]?.url;
      if (!url) return res.status(500).json({ error: 'BigModel image response did not include a URL.' });

      return res.json(buildResponse({
        url,
        revised_prompt: enhancedPrompt,
        provider: 'bigmodel'
      }));
    }

    if (selectedProvider.id === 'alibaba') {
      const apiKey = process.env.ALIBABA_DASHSCOPE_API_KEY;
      if (!apiKey || apiKey.startsWith('your_')) {
        return res.status(500).json({ error: 'Alibaba API key not configured' });
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
                  text: enhancedPrompt
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
        return res.status(500).json({ error: errorMsg });
      }

      return res.json(buildResponse({
        url,
        revised_prompt: enhancedPrompt,
        provider: 'alibaba'
      }));
    }

    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size,
      quality: 'standard'
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(buildResponse({
      url: response.data.data[0].url,
      revised_prompt: response.data.data[0].revised_prompt,
      provider: 'openai'
    }));
  } catch (e) {
    console.error('Image generation error:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/image-alibaba-debug  — Alibaba Image Generation Debug Endpoint
// Forces Alibaba provider ONLY for isolated testing
// NO AUTH REQUIRED - Debug endpoint for testing only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/image-alibaba-debug', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  const apiKey = process.env.ALIBABA_DASHSCOPE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    return res.status(500).json({ 
      error: 'Alibaba API key not configured',
      apiKeyStatus: apiKey ? 'Invalid (starts with your_)' : 'Missing',
      configCheck: {
        ALIBABA_DASHSCOPE_API_KEY: apiKey ? '***configured***' : 'NOT SET',
        ALIBABA_REGION: process.env.ALIBABA_REGION || 'NOT SET (default: singapore)'
      }
    });
  }

  const region = String(process.env.ALIBABA_REGION || 'singapore').toLowerCase();
  const endpoint = region === 'beijing'
    ? 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
    : 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

  console.log('[Alibaba Debug] Starting image generation', {
    region,
    endpoint,
    prompt: prompt.substring(0, 100) + '...',
    apiKeyPrefix: apiKey.substring(0, 20) + '...'
  });

  try {
    const startTime = Date.now();
    const response = await axios.post(endpoint, {
      model: 'wan2.7-image-pro',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: prompt.trim()
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

    const elapsed = Date.now() - startTime;
    console.log('[Alibaba Debug] Request succeeded', {
      elapsed: elapsed + 'ms',
      statusCode: response.status,
      responseKeys: Object.keys(response.data || {}),
      outputKeys: Object.keys(response.data?.output || {}),
      choicesCount: response.data?.output?.choices?.length || 0
    });

    const url = response.data?.output?.choices?.[0]?.message?.content?.[0]?.image;
    
    if (!url) {
      console.error('[Alibaba Debug] No URL in response', {
        fullResponse: JSON.stringify(response.data, null, 2).substring(0, 500)
      });
      const errorMsg = response.data?.message || 'Alibaba image generation returned no URL';
      return res.status(500).json({
        error: errorMsg,
        debug: {
          status: response.status,
          responseStructure: {
            output: response.data?.output ? 'exists' : 'missing',
            choices: response.data?.output?.choices ? `array(${response.data.output.choices.length})` : 'missing',
            message: response.data?.output?.choices?.[0]?.message ? 'exists' : 'missing',
            content: response.data?.output?.choices?.[0]?.message?.content ? `array(${response.data.output.choices[0].message.content.length})` : 'missing',
            image: response.data?.output?.choices?.[0]?.message?.content?.[0]?.image ? 'exists (truncated)' : 'missing'
          }
        }
      });
    }

    console.log('[Alibaba Debug] Image URL generated successfully', {
      urlLength: url.length,
      urlPrefix: url.substring(0, 50) + '...'
    });

    return res.json({
      url,
      revised_prompt: prompt.trim(),
      provider: 'alibaba',
      debug: {
        region,
        endpoint: endpoint.split('?')[0],
        elapsed: elapsed + 'ms',
        model: 'wan2.7-image-pro',
        apiKeyVerified: true
      }
    });
  } catch (error) {
    console.error('[Alibaba Debug] Error during request', {
      errorMessage: error.message,
      errorCode: error.code,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'no response data'
    });

    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
      provider: 'alibaba',
      debug: {
        errorType: error.code || 'UNKNOWN',
        httpStatus: error.response?.status || 'no response',
        responseData: error.response?.data ? {
          message: error.response.data.message,
          code: error.response.data.code,
          keys: Object.keys(error.response.data).slice(0, 5)
        } : null,
        requestConfig: {
          model: 'wan2.7-image-pro',
          region,
          timeout: '60000ms'
        }
      }
    });
  }
});

async function generatePosts({ topic, tone, emoji_level, max_length, count, niche, platforms, provider, language = 'en', format = 'post' }) {
  const { validateGenerationOptions } = require('../utils/languagePacks');
  const checked = validateGenerationOptions({ language, format });
  const pack = checked.ok ? checked.pack : { languageInstruction: 'Write entirely in English.', hashtagNote: 'Hashtags in English, relevant to the topic.' };
  const formatSpec = checked.ok ? checked.formatSpec : { bodySpec: 'BODY should flow naturally and include the offer, value proposition, benefits, call-to-action' };
  const emojiGuide = {
    off: 'Do not use any emojis whatsoever.',
    light: 'Use 1-2 relevant emojis per post naturally.',
    moderate: 'Use 3-5 emojis strategically placed throughout.',
    heavy: 'Use emojis liberally, multiple per sentence.'
  };

  const toneGuide = {
    funny: 'humorous, witty, and laugh-out-loud funny',
    serious: 'serious, authoritative, and data-driven',
    motivational: 'inspiring, uplifting, and action-driving',
    sad: 'emotional, empathetic, and deeply heartfelt',
    angry: 'urgent, passionate, and strongly opinionated',
    warning: 'cautionary, alarming, and important alert',
    storytelling: 'compelling narrative story format with a hook',
    sarcastic: 'sarcastic, ironic, and cleverly witty',
    professional: 'professional, polished, and business-appropriate',
    casual: 'casual, conversational, friendly, and approachable'
  };

  const platformNote = platforms.length > 0
    ? `Optimized for: ${platforms.join(', ')}. `
    : '';

  const nicheNote = niche ? `Industry/Niche: ${niche}. ` : '';
  const languageNote = `${pack.languageInstruction} `;

  const systemPrompt = `You are an elite social media content strategist with 10+ years of experience creating viral content. You specialize in crafting posts that drive engagement, shares, and conversions across all major platforms.`;

  const userPrompt = `Create ${count} completely unique, highly engaging social media post${count > 1 ? 's' : ''} about: "${topic}"

${nicheNote}${platformNote}${languageNote}Tone: ${toneGuide[tone] || toneGuide.professional}
Emoji usage: ${emojiGuide[emoji_level] || emojiGuide.light}
Character limit: Maximum ${max_length} characters per post.

REQUIRED OUTPUT FORMAT (use these exact separators):
HEADING: [A catchy, curiosity-driven line with NO MORE THAN 7 WORDS]
BODY: [The main post content: body text, offer, benefits, CTA, closing remarks]
HASHTAGS: [Space-separated hashtags, each starting with #, example: #social #marketing #growth]

Requirements:
- HEADING must be exactly 7 words or fewer - make it curious, compelling, and image-friendly
- HEADING should NOT appear in the BODY text - make them distinct and separate
- ${formatSpec.bodySpec}
- HASHTAGS should be ONLY hashtag tokens separated by spaces, nothing else. ${pack.hashtagNote}
- Each post MUST use a completely different angle, hook, and heading
- Write authentically — avoid generic AI-sounding phrases
- Make posts shareable and scroll-stopping
- Keep the final output highly readable and natural

Separate each post with exactly: |||

Output ONLY the posts with the above format, separated by |||, nothing else.`;

  let rawText = '';

  if (provider === 'openai') {
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.92,
      max_tokens: Math.min(max_length * count * 4, 4096)
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    rawText = resp.data.choices[0].message.content;
  } else if (provider === 'gemini') {
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: 0.92,
          maxOutputTokens: Math.min(max_length * count * 4, 4096)
        }
      }
    );
    rawText = resp.data.candidates[0].content.parts[0].text;
  } else if (provider === 'bigmodel') {
    const resp = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.92,
      max_tokens: Math.min(max_length * count * 4, 4096)
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BIGMODEL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    rawText = resp.data?.choices?.[0]?.message?.content || '';
  } else if (provider === 'anthropic') {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: Math.min(max_length * count * 4, 4096),
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    rawText = resp.data.content[0].text;
  } else if (provider === 'grok') {
    const resp = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-beta',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.92
    }, {
      headers: {
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    rawText = resp.data.choices[0].message.content;
  }

  const posts = rawText
    .split(/\|\|\|/)
    .map((p) => parseStructuredPost(p, topic, niche))
    .filter((p) => p.body && p.body.length > 10);
  if (posts.length === 0) return [{ 
    heading: 'Content Generation Failed',
    body: 'Unable to generate content. Please try again with a different topic.',
    hashtags: '',
    full_text: 'Unable to generate content. Please try again with a different topic.'
  }];
  return posts.slice(0, count);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/topics  — Topic Intelligence Engine (Gemini-powered)
// Returns 5 specific, pain-driven, outcome-focused topic suggestions
// ─────────────────────────────────────────────────────────────────────────────
router.post('/topics', requireAuth, async (req, res) => {
  const { niche = '', category = '', tone = '', count = 5 } = req.body || {};

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.startsWith('your_')) {
    return res.status(400).json({ error: 'Gemini API key not configured.' });
  }

  // Build dynamic context — the AI expertise area is driven by what the user filled in
  const domainFocus = [niche, category].filter(Boolean).join(' and ');
  const expertiseClause = domainFocus
    ? `You are a world-class social media content strategist with deep expertise in ${domainFocus}.`
    : 'You are a world-class social media content strategist with expertise across many industries and niches.';

  const nicheContext  = niche    ? `Target Niche/Industry: ${niche}.`    : '';
  const categoryNote  = category ? `Content Category: ${category}.`      : '';
  const toneNote      = tone     ? `Audience tone preference: ${tone}.`  : '';

  // What topics should NOT be — generic industry terms
  const avoidExample = domainFocus
    ? `Avoid generic phrases like "${domainFocus}" alone — make each topic specific and situation-based.`
    : 'Avoid generic industry terms — make each topic specific, situational, and outcome-focused.';

  const prompt = `${expertiseClause}

${nicheContext} ${categoryNote} ${toneNote}

Generate exactly ${count} highly specific, pain-driven, outcome-focused social media post topics.

Each topic must:
- Be directly relevant to the niche and category context above
- Address a real, specific pain point, transformation, or situation in that space
- NOT be generic — the topic should clearly belong to "${domainFocus || 'the specified niche'}"
- Include a clear outcome, problem, comparison, or shift in perspective
- Be phrased as a scroll-stopping post title or hook
- Match the ${tone || 'general'} tone where possible
- Be between 10 and 20 words

${avoidExample}

Rules:
- Output ONLY the topics, one per line
- No numbering, no bullets, no labels, no extra text
- Each topic on its own line
- Use ${count} completely different hook structures (question, bold statement, story, cost angle, etc.)

Output ${count} topics now:`;

  try {
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.95, maxOutputTokens: 512 }
      }
    );

    const raw = resp.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '';
    const topics = raw
      .split('\n')
      .map((t) => t.replace(/^[\d\.\-\*\s]+/, '').trim())
      .filter((t) => t.length > 10)
      .slice(0, count);

    if (topics.length === 0) {
      return res.status(500).json({ error: 'No topics generated. Please try again.' });
    }

    res.json({ topics });
  } catch (e) {
    console.error('Topic generation error:', e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data?.error?.message || 'Failed to generate topics' });
  }
});

async function testProvider(provider, prompt) {
  if (provider === 'gemini') {
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 120
        }
      }
    );

    return resp.data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n').trim() || 'Gemini responded with an empty message.';
  }

  if (provider === 'openai') {
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 120
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return resp.data?.choices?.[0]?.message?.content?.trim() || 'OpenAI responded with an empty message.';
  }

  if (provider === 'bigmodel') {
    const resp = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 120
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BIGMODEL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return resp.data?.choices?.[0]?.message?.content?.trim() || 'BigModel responded with an empty message.';
  }

  if (provider === 'anthropic') {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    return resp.data?.content?.[0]?.text?.trim() || 'Anthropic responded with an empty message.';
  }

  if (provider === 'grok') {
    const resp = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-beta',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 120
    }, {
      headers: {
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return resp.data?.choices?.[0]?.message?.content?.trim() || 'Grok responded with an empty message.';
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = router;
module.exports.parseStructuredPost = parseStructuredPost;
