const express = require('express');
const { runAutoPilotForUser } = require('../services/autoPilotWorker');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  return next();
}

function normalizePlatforms(platforms) {
  const allowed = new Set(['instagram', 'linkedin', 'linkedin_page', 'facebook']);
  const list = Array.isArray(platforms) ? platforms : [];
  const cleaned = list
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => allowed.has(item));
  return [...new Set(cleaned)];
}

router.get('/config', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT * FROM ai_autopilot_configs WHERE user_id=$1 LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.json({
        config: {
          enabled: false,
          topic: '',
          niche: '',
          category: '',
          tone: 'professional',
          posts_per_day: 1,
          platforms: ['instagram', 'linkedin', 'facebook'],
          text_provider: '',
          image_provider: '',
          selected_template_id: null,
          facebook_page_ids: [],
          linkedin_target_ids: [],
          last_run_on: null,
          last_run_at: null,
        }
      });
    }

    return res.json({ config: result.rows[0] });
  } catch (error) {
    console.error('Get autopilot config error:', error);
    return res.status(500).json({ error: 'Failed to load Auto Pilot config' });
  }
});

router.put('/config', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;

  const {
    enabled,
    topic,
    niche,
    category,
    tone,
    posts_per_day,
    platforms,
    text_provider,
    image_provider,
    selected_template_id,
    facebook_page_ids,
    linkedin_target_ids,
  } = req.body || {};

  const safePostsPerDay = Math.max(1, Math.min(5, Number(posts_per_day) || 1));
  const safePlatforms = normalizePlatforms(platforms);

  if ((enabled || false) && !String(topic || '').trim()) {
    return res.status(400).json({ error: 'Topic is required when Auto Pilot is enabled' });
  }

  if ((enabled || false) && !String(text_provider || '').trim()) {
    return res.status(400).json({ error: 'Text AI provider is required when Auto Pilot is enabled' });
  }

  if ((enabled || false) && !String(image_provider || '').trim()) {
    return res.status(400).json({ error: 'Image AI provider is required when Auto Pilot is enabled' });
  }

  try {
    const result = await db.query(
      `INSERT INTO ai_autopilot_configs
       (user_id, enabled, topic, niche, category, tone, posts_per_day, platforms, text_provider, image_provider, selected_template_id, facebook_page_ids, linkedin_target_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (user_id)
       DO UPDATE SET
         enabled=EXCLUDED.enabled,
         topic=EXCLUDED.topic,
         niche=EXCLUDED.niche,
         category=EXCLUDED.category,
         tone=EXCLUDED.tone,
         posts_per_day=EXCLUDED.posts_per_day,
         platforms=EXCLUDED.platforms,
         text_provider=EXCLUDED.text_provider,
         image_provider=EXCLUDED.image_provider,
         selected_template_id=EXCLUDED.selected_template_id,
         facebook_page_ids=EXCLUDED.facebook_page_ids,
         linkedin_target_ids=EXCLUDED.linkedin_target_ids,
         updated_at=NOW()
       RETURNING *`,
      [
        userId,
        Boolean(enabled),
        String(topic || '').trim(),
        String(niche || '').trim(),
        String(category || '').trim(),
        String(tone || 'professional').trim(),
        safePostsPerDay,
        safePlatforms,
        String(text_provider || '').trim() || null,
        String(image_provider || '').trim() || null,
        selected_template_id ? String(selected_template_id).trim() : null,
        Array.isArray(facebook_page_ids) ? facebook_page_ids : [],
        Array.isArray(linkedin_target_ids) ? linkedin_target_ids : [],
      ]
    );

    return res.json({ success: true, config: result.rows[0] });
  } catch (error) {
    console.error('Save autopilot config error:', error);
    return res.status(500).json({ error: 'Failed to save Auto Pilot config' });
  }
});

router.post('/run-now', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;

  try {
    const summary = await runAutoPilotForUser(db, userId, { force: true });
    return res.json({ success: true, summary });
  } catch (error) {
    console.error('Auto Pilot run-now error:', error);
    return res.status(500).json({ error: error.message || 'Auto Pilot run failed' });
  }
});

router.get('/runs', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT id, run_date, generated_count, scheduled_count, duplicate_count, status, error_message, created_at
       FROM ai_autopilot_runs
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT 15`,
      [userId]
    );

    return res.json({ runs: result.rows });
  } catch (error) {
    console.error('Get Auto Pilot runs error:', error);
    return res.status(500).json({ error: 'Failed to load Auto Pilot runs' });
  }
});

router.get('/posts', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT p.*,
       json_agg(json_build_object(
         'platform', pp.platform,
         'status', pp.status,
         'platform_post_url', pp.platform_post_url,
         'error_message', pp.error_message,
         'posted_at', pp.posted_at
       )) FILTER (WHERE pp.id IS NOT NULL) as platform_results
       FROM posts p
       LEFT JOIN platform_posts pp ON p.id = pp.post_id
       WHERE p.user_id=$1 AND COALESCE(p.autopilot_generated, false)=true
       GROUP BY p.id
       ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
       LIMIT 100`,
      [userId]
    );

    return res.json({ posts: result.rows });
  } catch (error) {
    console.error('Get Auto Pilot posts error:', error);
    return res.status(500).json({ error: 'Failed to load Auto Pilot posts' });
  }
});

module.exports = router;
