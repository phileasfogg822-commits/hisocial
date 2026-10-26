const express = require('express');
const axios = require('axios');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

router.get('/status', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const [memoryCount, campaignCount] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM ai_content_memory WHERE user_id=$1', [req.user.id]),
      db.query('SELECT COUNT(*)::int AS count FROM ai_campaigns WHERE user_id=$1', [req.user.id])
    ]);

    res.json({
      providers: getAvailableProviders(),
      memory_count: memoryCount.rows[0].count,
      campaign_count: campaignCount.rows[0].count,
      modes: ['manual', 'assisted', 'autonomous']
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/memory/sync', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const synced = await syncMemoryFromPosts(db, req.user.id);
    res.json({ synced });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/quality/ingest', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { post_id, platform, likes = 0, comments = 0, clicks = 0 } = req.body || {};

  if (!post_id || !platform) {
    return res.status(400).json({ error: 'post_id and platform are required' });
  }

  const engagementScore = (Number(likes) * 1) + (Number(comments) * 2) + (Number(clicks) * 1.5);

  try {
    const result = await db.query(
      `INSERT INTO ai_quality_signals (user_id, post_id, platform, likes, comments, clicks, engagement_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [req.user.id, post_id, platform, Number(likes), Number(comments), Number(clicks), engagementScore]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/quality/insights', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const byPlatform = await db.query(
      `SELECT platform,
              AVG(engagement_score)::numeric(10,2) AS avg_score,
              COUNT(*)::int AS sample_size
       FROM ai_quality_signals
       WHERE user_id=$1
       GROUP BY platform
       ORDER BY AVG(engagement_score) DESC`,
      [req.user.id]
    );

    res.json({
      top_platforms: byPlatform.rows,
      recommendation: buildQualityRecommendation(byPlatform.rows)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/command', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const {
    instruction,
    start_date,
    end_date,
    provider = 'gemini',
    mode = 'assisted',
    platforms = ['linkedin'],
    save = true,
    max_posts_per_day = 4
  } = req.body || {};

  if (!instruction || !instruction.trim()) {
    return res.status(400).json({ error: 'instruction is required' });
  }

  try {
    const parsed = parseInstruction(instruction);
    const output = await runContentBrainWorkflow({
      db,
      userId: req.user.id,
      command: instruction,
      topic: parsed.topic,
      days: parsed.days,
      totalItems: parsed.totalItems,
      postsPerDay: parsed.postsPerDay,
      startDate: start_date,
      endDate: end_date,
      provider,
      mode,
      platforms,
      save,
      weekendOnly: parsed.weekendOnly,
      maxPostsPerDay: max_posts_per_day,
      campaignName: parsed.campaignName
    });

    res.json(output);
  } catch (e) {
    console.error('AI brain command error:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

router.post('/sequence/generate', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const {
    topic,
    command,
    days = 7,
    total_items = 14,
    posts_per_day,
    start_date,
    end_date,
    provider = 'gemini',
    tone = 'professional',
    niche = '',
    platforms = ['linkedin'],
    mode = 'assisted',
    max_posts_per_day = 4,
    save = false,
    weekend_only = false,
    campaign_name
  } = req.body || {};

  const normalizedTopic = String(topic || command || '').trim();
  if (!normalizedTopic) {
    return res.status(400).json({ error: 'topic or command is required' });
  }

  try {
    const output = await runContentBrainWorkflow({
      db,
      userId: req.user.id,
      command: command || `Generate ${total_items} posts about ${normalizedTopic}`,
      topic: normalizedTopic,
      days: Number(days),
      totalItems: Number(total_items),
      postsPerDay: posts_per_day ? Number(posts_per_day) : undefined,
      startDate: start_date,
      endDate: end_date,
      provider,
      tone,
      niche,
      platforms,
      mode,
      maxPostsPerDay: Number(max_posts_per_day) || 4,
      save: Boolean(save),
      weekendOnly: Boolean(weekend_only),
      campaignName: campaign_name
    });

    res.json(output);
  } catch (e) {
    console.error('AI brain sequence error:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

async function runContentBrainWorkflow({
  db,
  userId,
  command,
  topic,
  days,
  totalItems,
  postsPerDay,
  startDate,
  endDate,
  provider,
  tone = 'professional',
  niche = '',
  platforms = ['linkedin'],
  mode = 'assisted',
  maxPostsPerDay = 4,
  save = false,
  weekendOnly = false,
  campaignName = ''
}) {
  const available = getAvailableProviders();
  const selectedProvider = available.find((p) => p.id === provider) || available[0];

  if (!selectedProvider) {
    throw new Error('No AI provider configured. Configure GEMINI_API_KEY or OPENAI_API_KEY first.');
  }

  await syncMemoryFromPosts(db, userId);

  const memoryRows = await db.query(
    `SELECT content_text, topic, tone, keywords, created_at
     FROM ai_content_memory
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 200`,
    [userId]
  );

  const items = await generateStructuredSequence({
    provider: selectedProvider.id,
    topic,
    command,
    tone,
    niche,
    totalItems,
    days,
    platforms,
    memoryRows: memoryRows.rows
  });

  const diversified = await diversifySequence({
    provider: selectedProvider.id,
    topic,
    tone,
    items,
    memoryRows: memoryRows.rows,
    similarityThreshold: 0.72
  });

  const schedulePlan = buildDistributionPlan({
    totalItems: diversified.length,
    days,
    startDate,
    endDate,
    postsPerDay,
    maxPostsPerDay,
    weekendOnly
  });

  const scheduledItems = diversified.map((item, index) => {
    const slot = schedulePlan.slots[index] || schedulePlan.slots[schedulePlan.slots.length - 1];
    return {
      ...item,
      day: slot.dayNumber,
      scheduled_at: slot.iso,
      date: slot.date,
      time: slot.time
    };
  });

  let campaign = null;
  if (save || mode === 'autonomous') {
    campaign = await persistCampaign({
      db,
      userId,
      command,
      campaignName,
      mode,
      provider: selectedProvider.id,
      topic,
      startDate: schedulePlan.start,
      endDate: schedulePlan.end,
      totalItems: scheduledItems.length,
      postsPerDay: schedulePlan.postsPerDay,
      maxPostsPerDay,
      platforms,
      items: scheduledItems,
      createScheduledPosts: mode === 'autonomous'
    });
  }

  return {
    brain: 'AIContentBrain',
    provider: selectedProvider,
    mode,
    topic,
    total_items: scheduledItems.length,
    posts_per_day: schedulePlan.postsPerDay,
    date_range: { start: schedulePlan.start, end: schedulePlan.end },
    memory_checked: memoryRows.rows.length,
    campaign,
    items: scheduledItems
  };
}

async function syncMemoryFromPosts(db, userId) {
  const result = await db.query(
    `SELECT p.id, p.content, p.platforms, p.created_at, p.published_at
     FROM posts p
     WHERE p.user_id=$1
       AND p.status IN ('published','partial','scheduled')
       AND p.content IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ai_content_memory m
         WHERE m.user_id=p.user_id AND m.source_post_id=p.id
       )`,
    [userId]
  );

  let synced = 0;
  for (const row of result.rows) {
    const keywords = extractKeywords(row.content);
    const hook = row.content.split(/[.!?\n]/).map((part) => part.trim()).filter(Boolean)[0] || row.content.slice(0, 120);
    const hash = simpleHash(row.content);

    await db.query(
      `INSERT INTO ai_content_memory
       (user_id, source_post_id, content_text, topic, tone, platforms, keywords, hook, content_hash, engagement, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (user_id, source_post_id) DO NOTHING`,
      [
        userId,
        row.id,
        row.content,
        inferTopic(row.content),
        inferTone(row.content),
        row.platforms || [],
        keywords,
        hook,
        hash,
        JSON.stringify({}),
        row.published_at || row.created_at || new Date()
      ]
    );
    synced += 1;
  }

  return synced;
}

async function persistCampaign({
  db,
  userId,
  command,
  campaignName,
  mode,
  provider,
  topic,
  startDate,
  endDate,
  totalItems,
  postsPerDay,
  maxPostsPerDay,
  platforms,
  items,
  createScheduledPosts
}) {
  const campaignResult = await db.query(
    `INSERT INTO ai_campaigns
     (user_id, name, command, mode, status, provider, topic, start_date, end_date, total_items, posts_per_day, max_posts_per_day, platforms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      userId,
      campaignName || `${topic} Campaign`,
      command,
      mode,
      createScheduledPosts ? 'scheduled' : 'draft',
      provider,
      topic,
      startDate,
      endDate,
      totalItems,
      postsPerDay,
      maxPostsPerDay,
      platforms
    ]
  );

  const campaign = campaignResult.rows[0];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    const campaignItemResult = await db.query(
      `INSERT INTO ai_campaign_items
       (campaign_id, day_number, sequence_index, title, content, core_content, variations, platform_adaptations, scheduled_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        campaign.id,
        item.day,
        index + 1,
        item.title,
        item.content,
        item.core_content,
        JSON.stringify(item.variations || {}),
        JSON.stringify(item.platform_adaptations || {}),
        item.scheduled_at,
        createScheduledPosts ? 'scheduled' : 'draft'
      ]
    );

    if (createScheduledPosts) {
      const postResult = await db.query(
        `INSERT INTO posts
         (user_id, content, platforms, media_urls, status, scheduled_at)
         VALUES ($1,$2,$3,$4,'scheduled',$5)
         RETURNING id`,
        [userId, item.content, platforms, [], item.scheduled_at]
      );

      const postId = postResult.rows[0].id;
      await db.query(
        `INSERT INTO ai_content_memory
         (user_id, source_post_id, content_text, topic, tone, platforms, keywords, hook, content_hash, engagement, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (user_id, source_post_id) DO NOTHING`,
        [
          userId,
          postId,
          item.content,
          topic,
          inferTone(item.content),
          platforms,
          extractKeywords(item.content),
          item.content.split(/[.!?\n]/).map((part) => part.trim()).filter(Boolean)[0] || item.content.slice(0, 120),
          simpleHash(item.content),
          JSON.stringify({}),
          new Date(item.scheduled_at)
        ]
      );

      await db.query(
        `UPDATE ai_campaign_items SET source_post_id=$1 WHERE id=$2`,
        [postId, campaignItemResult.rows[0].id]
      );
    }
  }

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    total_items: campaign.total_items
  };
}

async function generateStructuredSequence({ provider, topic, command, tone, niche, totalItems, days, platforms, memoryRows }) {
  const memoryAvoid = memoryRows.slice(0, 25).map((row) => row.content_text).filter(Boolean).slice(0, 10);

  const prompt = [
    'You are AIContentBrain, an autonomous social media strategist.',
    `Task: Build a ${days}-day sequence with ${totalItems} content items.`,
    `Primary topic: ${topic}.`,
    `User instruction: ${command}.`,
    `Tone baseline: ${tone}.`,
    niche ? `Niche: ${niche}.` : '',
    `Platforms: ${platforms.join(', ')}.`,
    memoryAvoid.length ? `Avoid repeating these prior ideas or hooks:\n- ${memoryAvoid.join('\n- ')}` : '',
    'Output STRICT JSON only with this shape:',
    '{"items":[{"title":"...","core_content":"...","content":"...","variations":{"professional":"...","casual":"...","inspirational":"..."},"platform_adaptations":{"linkedin":"...","instagram":"...","twitter":"...","pinterest":"..."}}]}',
    `Return exactly ${totalItems} items. No markdown. No extra text.`
  ].filter(Boolean).join('\n');

  const raw = await callProviderText(provider, prompt, 0.85, Math.min(7000, totalItems * 700));
  const parsed = parseJsonSafe(raw);

  const fallback = Array.from({ length: totalItems }).map((_, index) => ({
    title: `Day ${index + 1}: ${topic}`,
    core_content: `${topic} insight ${index + 1}`,
    content: `Day ${index + 1}: ${topic} — practical insight for your audience with a clear takeaway and CTA.`,
    variations: {
      professional: `${topic}: strategic perspective ${index + 1}.`,
      casual: `${topic} tip ${index + 1} in simple terms.`,
      inspirational: `${topic} motivation ${index + 1}: keep progressing.`
    },
    platform_adaptations: {
      linkedin: `${topic} professional angle ${index + 1}.`,
      instagram: `${topic} visual-first angle ${index + 1} ✨`,
      twitter: `${topic} punchy idea ${index + 1}.`,
      pinterest: `${topic} keyword-focused idea ${index + 1}.`
    }
  }));

  const items = Array.isArray(parsed?.items) ? parsed.items : fallback;

  return items.slice(0, totalItems).map((item, index) => ({
    title: String(item.title || `Day ${index + 1}: ${topic}`).trim(),
    core_content: String(item.core_content || item.content || `${topic} insight ${index + 1}`).trim(),
    content: String(item.content || item.core_content || `${topic} insight ${index + 1}`).trim(),
    variations: typeof item.variations === 'object' && item.variations ? item.variations : {},
    platform_adaptations: typeof item.platform_adaptations === 'object' && item.platform_adaptations ? item.platform_adaptations : {}
  }));
}

async function diversifySequence({ provider, topic, tone, items, memoryRows, similarityThreshold }) {
  const memoryTexts = memoryRows.map((row) => row.content_text).filter(Boolean);
  const output = [];

  for (const item of items) {
    const candidates = [...memoryTexts, ...output.map((entry) => entry.content)];
    const maxSimilarity = candidates.reduce((max, text) => Math.max(max, textSimilarity(item.content, text)), 0);

    if (maxSimilarity > similarityThreshold) {
      const rewritten = await rewriteDiverseContent(provider, {
        topic,
        tone,
        original: item.content,
        avoid: candidates.slice(-10)
      });

      output.push({
        ...item,
        content: rewritten
      });
    } else {
      output.push(item);
    }
  }

  return output;
}

function buildDistributionPlan({ totalItems, days, startDate, endDate, postsPerDay, maxPostsPerDay, weekendOnly }) {
  const safeTotal = Math.max(1, Number(totalItems) || 1);
  const effectiveDays = Math.max(1, Number(days) || 1);

  const start = startDate ? new Date(startDate) : startOfDay(new Date());
  const normalizedStart = startOfDay(start);

  const end = endDate
    ? startOfDay(new Date(endDate))
    : addDays(normalizedStart, effectiveDays - 1);

  const dateList = [];
  const cursor = new Date(normalizedStart);

  while (cursor <= end) {
    if (!weekendOnly || cursor.getDay() === 0 || cursor.getDay() === 6) {
      dateList.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const usableDates = dateList.length > 0 ? dateList : [new Date(normalizedStart)];

  const autoPostsPerDay = Math.ceil(safeTotal / usableDates.length);
  const cappedByMax = Math.max(1, Math.min(autoPostsPerDay, maxPostsPerDay || autoPostsPerDay));
  const effectivePostsPerDay = Math.max(1, Math.min(postsPerDay || cappedByMax, maxPostsPerDay || (postsPerDay || cappedByMax)));

  const slots = [];
  let itemCursor = 0;
  let dayCursor = 0;

  while (itemCursor < safeTotal) {
    const dayDate = usableDates[dayCursor] || addDays(usableDates[usableDates.length - 1], dayCursor - usableDates.length + 1);
    const times = generateTimeSlots(effectivePostsPerDay);

    for (let i = 0; i < effectivePostsPerDay && itemCursor < safeTotal; i += 1) {
      const { hour, minute } = times[i];
      const scheduled = new Date(dayDate);
      scheduled.setHours(hour, minute, 0, 0);

      slots.push({
        dayNumber: dayCursor + 1,
        date: scheduled.toISOString().slice(0, 10),
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        iso: scheduled.toISOString()
      });
      itemCursor += 1;
    }

    dayCursor += 1;
  }

  return {
    start: slots[0]?.date || normalizedStart.toISOString().slice(0, 10),
    end: slots[slots.length - 1]?.date || end.toISOString().slice(0, 10),
    postsPerDay: effectivePostsPerDay,
    slots
  };
}

function generateTimeSlots(postsPerDay) {
  const base = [
    { hour: 10, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 19, minute: 0 },
    { hour: 21, minute: 0 },
    { hour: 8, minute: 30 },
    { hour: 12, minute: 30 },
    { hour: 16, minute: 30 }
  ];

  if (postsPerDay <= base.length) return base.slice(0, postsPerDay);

  const slots = [];
  for (let i = 0; i < postsPerDay; i += 1) {
    const totalMinutes = 8 * 60 + Math.round((13 * 60) * (i / Math.max(1, postsPerDay - 1)));
    slots.push({ hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 });
  }
  return slots;
}

async function rewriteDiverseContent(provider, { topic, tone, original, avoid }) {
  const prompt = [
    `Rewrite this social post to be clearly different while keeping the same topic (${topic}).`,
    `Tone: ${tone}.`,
    'Do not reuse the same hook or sentence structure.',
    avoid.length ? `Avoid overlap with:\n- ${avoid.join('\n- ')}` : '',
    `Original:\n${original}`,
    'Return only the rewritten post text.'
  ].filter(Boolean).join('\n\n');

  const text = await callProviderText(provider, prompt, 0.9, 450);
  return text.replace(/^"|"$/g, '').trim() || original;
}

async function callOneProviderText(provider, prompt, temperature, maxTokens) {
  if (provider === 'openai') {
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return resp.data?.choices?.[0]?.message?.content || '';
  }

  if (provider === 'gemini') {
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      }
    );
    return resp.data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n') || '';
  }

  if (provider === 'bigmodel') {
    const resp = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BIGMODEL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return resp.data?.choices?.[0]?.message?.content || '';
  }

  if (provider === 'anthropic') {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    return resp.data?.content?.[0]?.text || '';
  }

  if (provider === 'grok') {
    const resp = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-beta',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens
    }, {
      headers: {
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return resp.data?.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function callProviderText(provider, prompt, temperature = 0.8, maxTokens = 1200) {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callOneProviderText(provider, prompt, temperature, maxTokens);
    } catch (err) {
      const status = err.response?.status;
      const errMsg = (err.response?.data?.error?.message || err.message || '').toLowerCase();
      const isQuotaOrRate = status === 429 || status === 503 || errMsg.includes('quota') || errMsg.includes('rate limit');
      if (isQuotaOrRate && attempt < MAX_RETRIES) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0', 10);
        const delay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 2000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      // Try next available provider on persistent quota/rate error
      if (isQuotaOrRate) {
        const fallbacks = getAvailableProviders().map((p) => p.id).filter((id) => id !== provider);
        for (const fallbackId of fallbacks) {
          try {
            console.warn(`brain.js: ${provider} quota/rate-limit, falling back to ${fallbackId}`);
            return await callOneProviderText(fallbackId, prompt, temperature, maxTokens);
          } catch (_e) { /* try next */ }
        }
      }
      throw err;
    }
  }
}

function parseInstruction(instruction) {
  const text = String(instruction || '').toLowerCase();

  const weekMatch = text.match(/(\d+)\s*week/);
  const dayMatch = text.match(/(\d+)\s*day/);
  const postsPerDayMatch = text.match(/(\d+)\s*(posts?|times?)\s*(per\s*day|a\s*day|daily)/);
  const totalItemsMatch = text.match(/(\d+)\s*(tips?|posts?|ideas?|steps?)/);

  const days = weekMatch ? Number(weekMatch[1]) * 7 : (dayMatch ? Number(dayMatch[1]) : 7);
  const postsPerDay = postsPerDayMatch ? Number(postsPerDayMatch[1]) : undefined;
  const totalItems = totalItemsMatch
    ? Number(totalItemsMatch[1])
    : (postsPerDay ? postsPerDay * days : days * 2);

  const weekendOnly = /weekend/.test(text);

  const topicMatch = instruction.match(/(?:about|for|of)\s+(.+)$/i);
  const topic = (topicMatch?.[1] || instruction).replace(/\.$/, '').trim();

  return {
    topic,
    days,
    postsPerDay,
    totalItems,
    weekendOnly,
    campaignName: `${topic.slice(0, 60)} Campaign`
  };
}

function extractKeywords(text = '') {
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 3)
    .filter((word) => !STOP_WORDS.has(word));

  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word]) => word);
}

function inferTopic(text = '') {
  return extractKeywords(text).slice(0, 4).join(', ') || 'general';
}

function inferTone(text = '') {
  const normalized = String(text).toLowerCase();
  if (/(must|warning|critical|urgent)/.test(normalized)) return 'serious';
  if (/(inspire|dream|believe|journey)/.test(normalized)) return 'inspirational';
  if (/(lol|fun|joke|😂|🤣)/.test(normalized)) return 'casual';
  return 'professional';
}

function textSimilarity(a = '', b = '') {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word));
}

function parseJsonSafe(raw = '') {
  const normalized = String(raw || '').trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized);
  } catch (_) {
    const objectMatch = normalized.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (_) {}
    }
  }

  return null;
}

function buildQualityRecommendation(rows = []) {
  if (!rows.length) {
    return 'No engagement signals yet. Start ingesting likes/comments/clicks to unlock optimization guidance.';
  }

  const best = rows[0];
  return `Focus more volume on ${best.platform} where average engagement score is ${best.avg_score}.`;
}

function getAvailableProviders() {
  const providers = [];

  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_')) {
    providers.push({ id: 'openai', name: 'OpenAI GPT-4o' });
  }
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_')) {
    providers.push({ id: 'gemini', name: 'Google Gemini Flash Latest' });
  }
  if (process.env.BIGMODEL_API_KEY && !process.env.BIGMODEL_API_KEY.startsWith('your_')) {
    providers.push({ id: 'bigmodel', name: 'BigModel GLM / CogView' });
  }
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('your_')) {
    providers.push({ id: 'anthropic', name: 'Anthropic Claude' });
  }
  if (process.env.GROK_API_KEY && !process.env.GROK_API_KEY.startsWith('your_')) {
    providers.push({ id: 'grok', name: 'xAI Grok' });
  }

  return providers;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function simpleHash(text = '') {
  let hash = 0;
  const value = String(text);
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'your', 'about', 'into', 'their', 'there', 'would', 'could',
  'should', 'what', 'when', 'where', 'which', 'while', 'were', 'will', 'them', 'than', 'then', 'because',
  'https', 'http', 'just', 'also', 'very', 'more', 'some', 'only', 'other', 'each', 'many', 'most', 'such'
]);

module.exports = router;
