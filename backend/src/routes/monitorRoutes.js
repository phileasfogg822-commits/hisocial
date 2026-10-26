const express = require('express');
const { enqueueScan } = require('../services/monitorWorker');
const { scrapeLinkedInPosts, captureLinkedInPreview } = require('../services/linkedinScraper');
const { scoreOpportunity, isActionableOpportunityCandidate } = require('../services/aiAnalyzer');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function sanitizeJob(job = {}) {
  const clone = { ...job };
  delete clone.linkedin_session_cookie;
  clone.has_linkedin_session_cookie = Boolean(job.linkedin_session_cookie);
  return clone;
}

router.post('/create', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const {
    id,
    name,
    keywords = [],
    platform = 'linkedin',
    includeWords = [],
    excludeWords = [],
    context = '',
    autoRun = false,
    runEveryMinutes = 15,
    linkedinSessionCookie,
  } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: 'Job name is required' });
  const cleanKeywords = (keywords || []).map((k) => String(k).trim()).filter(Boolean);
  if (cleanKeywords.length === 0) return res.status(400).json({ error: 'Add at least one keyword' });

  try {
    if (id) {
      const updated = await db.query(
        `UPDATE monitor_jobs
         SET name = $1,
             keywords = $2,
             platform = $3,
             include_words = $4,
             exclude_words = $5,
             context = $6,
             auto_run = $7,
             run_every_minutes = $8,
             linkedin_session_cookie = COALESCE($11, linkedin_session_cookie),
             updated_at = NOW()
         WHERE id = $9 AND user_id = $10
         RETURNING *`,
        [
          name.trim(),
          cleanKeywords,
          platform,
          (includeWords || []).map((w) => String(w).trim()).filter(Boolean),
          (excludeWords || []).map((w) => String(w).trim()).filter(Boolean),
          context,
          !!autoRun,
          Math.max(parseInt(runEveryMinutes, 10) || 15, 1),
          id,
          req.user.id,
          typeof linkedinSessionCookie === 'string' ? (linkedinSessionCookie.trim() || null) : null,
        ]
      );

      if (!updated.rows[0]) return res.status(404).json({ error: 'Monitor job not found' });
      return res.json(sanitizeJob(updated.rows[0]));
    }

    const created = await db.query(
      `INSERT INTO monitor_jobs (
        user_id, name, keywords, platform, include_words, exclude_words,
        context, auto_run, run_every_minutes
      , linkedin_session_cookie
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.id,
        name.trim(),
        cleanKeywords,
        platform,
        (includeWords || []).map((w) => String(w).trim()).filter(Boolean),
        (excludeWords || []).map((w) => String(w).trim()).filter(Boolean),
        context,
        !!autoRun,
        Math.max(parseInt(runEveryMinutes, 10) || 15, 1),
        typeof linkedinSessionCookie === 'string' ? (linkedinSessionCookie.trim() || null) : null,
      ]
    );

    res.status(201).json(sanitizeJob(created.rows[0]));
  } catch (e) {
    console.error('Create monitor job failed:', e.message);
    res.status(500).json({ error: 'Failed to save monitor job' });
  }
});

router.get('/jobs', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const rows = await db.query(
      `SELECT mj.*,
              msr.id AS last_run_id,
              msr.status AS last_run_status,
              msr.started_at AS last_run_started_at,
              msr.finished_at AS last_run_finished_at,
              msr.scanned_count AS last_run_scanned_count,
              msr.inserted_count AS last_run_inserted_count,
              msr.deduped_count AS last_run_deduped_count,
              msr.filtered_intent_count AS last_run_filtered_intent_count,
              msr.filtered_score_count AS last_run_filtered_score_count,
              msr.error_message AS last_run_error_message
       FROM monitor_jobs
       mj
       LEFT JOIN LATERAL (
         SELECT *
         FROM monitor_scan_runs sr
         WHERE sr.job_id = mj.id
         ORDER BY sr.started_at DESC
         LIMIT 1
       ) msr ON TRUE
       WHERE mj.user_id = $1
       ORDER BY mj.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows.rows.map((row) => sanitizeJob(row)));
  } catch (e) {
    console.error('Load monitor jobs failed:', e.message);
    res.status(500).json({ error: 'Failed to load monitor jobs' });
  }
});

router.post('/session-cookie', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { jobId, linkedinSessionCookie } = req.body || {};

  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const updated = await db.query(
      `UPDATE monitor_jobs
       SET linkedin_session_cookie = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [typeof linkedinSessionCookie === 'string' ? (linkedinSessionCookie.trim() || null) : null, jobId, req.user.id]
    );

    if (!updated.rows[0]) return res.status(404).json({ error: 'Monitor job not found' });
    res.json({ ok: true, job: sanitizeJob(updated.rows[0]) });
  } catch (e) {
    console.error('Save monitor session cookie failed:', e.message);
    res.status(500).json({ error: 'Failed to save LinkedIn session cookie' });
  }
});

router.get('/scan-runs', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { jobId, limit } = req.query;

  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const ownCheck = await db.query(
      `SELECT id FROM monitor_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, req.user.id]
    );
    if (!ownCheck.rows[0]) return res.status(404).json({ error: 'Monitor job not found' });

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const runs = await db.query(
      `SELECT *
       FROM monitor_scan_runs
       WHERE user_id = $1 AND job_id = $2
       ORDER BY started_at DESC
       LIMIT $3`,
      [req.user.id, jobId, safeLimit]
    );

    res.json(runs.rows);
  } catch (e) {
    console.error('Load monitor scan runs failed:', e.message);
    res.status(500).json({ error: 'Failed to load monitor scan runs' });
  }
});

router.get('/posts', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { jobId } = req.query;

  try {
    const params = [req.user.id];
    let whereClause = 'mp.user_id = $1 AND mp.duplicate_of IS NULL';
    if (jobId) {
      params.push(jobId);
      whereClause += ` AND mp.job_id = $${params.length}`;
    }

    const rows = await db.query(
      `SELECT
          mp.*,
          ar.comment,
          ar.dm,
          ar.proposal,
          mj.name AS job_name
       FROM monitor_posts mp
       LEFT JOIN ai_responses ar ON ar.post_id = mp.id
       LEFT JOIN monitor_jobs mj ON mj.id = mp.job_id
       WHERE ${whereClause}
       ORDER BY mp.relevance_score DESC, mp.created_at DESC
       LIMIT 200`,
      params
    );

    res.json(rows.rows);
  } catch (e) {
    console.error('Load monitor posts failed:', e.message);
    res.status(500).json({ error: 'Failed to load monitor posts' });
  }
});

router.post('/scan', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const ownCheck = await db.query(
      `SELECT id FROM monitor_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, req.user.id]
    );
    if (!ownCheck.rows[0]) return res.status(404).json({ error: 'Monitor job not found' });

    const queued = await enqueueScan({ jobId, trigger: 'manual' });
    res.json({ queued: true, queueJobId: queued.id });
  } catch (e) {
    console.error('Queue monitor scan failed:', e.message);
    res.status(500).json({ error: 'Failed to queue monitor scan' });
  }
});

router.get('/live-feed', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { jobId, limit } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const jobRes = await db.query(
      `SELECT * FROM monitor_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, req.user.id]
    );
    const job = jobRes.rows[0];
    if (!job) return res.status(404).json({ error: 'Monitor job not found' });

    const scanned = await scrapeLinkedInPosts({
      keywords: job.keywords || [],
      includeWords: job.include_words || [],
      excludeWords: job.exclude_words || [],
      linkedInSessionCookie: job.linkedin_session_cookie || '',
    });

    const totalExamined = scanned.length;
    const actionableScanned = scanned.filter((candidate) => isActionableOpportunityCandidate(candidate));
    const filteredNoiseCount = Math.max(totalExamined - actionableScanned.length, 0);

    const analyzed = actionableScanned.map((candidate) => {
      const score = scoreOpportunity({
        post: candidate,
        job: {
          keywords: job.keywords || [],
          includeWords: job.include_words || [],
          excludeWords: job.exclude_words || [],
        }
      });

      const decision = !score.hasHiringIntent
        ? 'filtered_intent'
        : score.score < 50
          ? 'filtered_score'
          : 'collectable';

      return {
        author: candidate.author || null,
        company: candidate.company || null,
        url: candidate.url || null,
        preview: String(candidate.content || '').slice(0, 220),
        matched_keywords: score.keywordHits || [],
        has_hiring_intent: score.hasHiringIntent,
        score: score.score,
        decision,
        scanned_at: candidate.scannedAt || new Date().toISOString(),
      };
    });

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const collectableCount = analyzed.filter((row) => row.decision === 'collectable').length;

    res.json({
      total_examined: totalExamined,
      filtered_noise_count: filteredNoiseCount,
      analyzed_count: analyzed.length,
      collectable_count: collectableCount,
      items: analyzed.slice(0, safeLimit),
    });
  } catch (e) {
    console.error('Load live feed failed:', e.message);
    res.status(500).json({ error: 'Failed to load live feed from LinkedIn scan' });
  }
});

router.get('/preview', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const jobRes = await db.query(
      `SELECT * FROM monitor_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, req.user.id]
    );
    const job = jobRes.rows[0];
    if (!job) return res.status(404).json({ error: 'Monitor job not found' });

    const keyword = Array.isArray(job.keywords) && job.keywords.length > 0
      ? String(job.keywords[0]).trim()
      : 'hiring';

    const preview = await captureLinkedInPreview({
      keyword,
      linkedInSessionCookie: job.linkedin_session_cookie || '',
    });
    res.json({
      keyword,
      source_url: preview.sourceUrl,
      captured_at: preview.capturedAt,
      image_data_url: preview.imageDataUrl,
      unavailable: false,
    });
  } catch (e) {
    console.error('Load monitor preview failed:', e.message);
    res.json({
      unavailable: true,
      keyword: null,
      source_url: null,
      captured_at: null,
      image_data_url: null,
      message: 'Puppeteer preview is unavailable in this environment right now. LinkedIn preview cannot be captured yet.',
    });
  }
});

router.post('/action', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { postId, action, comment, dm, proposal } = req.body || {};
  if (!postId || !action) return res.status(400).json({ error: 'postId and action are required' });

  const allowed = new Set(['save', 'approve', 'copy_comment', 'copy_dm', 'copy_proposal']);
  if (!allowed.has(action)) return res.status(400).json({ error: 'Unsupported action' });

  try {
    const postRes = await db.query(
      `SELECT id FROM monitor_posts WHERE id = $1 AND user_id = $2`,
      [postId, req.user.id]
    );
    if (!postRes.rows[0]) return res.status(404).json({ error: 'Post not found' });

    if (comment || dm || proposal) {
      await db.query(
        `INSERT INTO ai_responses (post_id, comment, dm, proposal)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (post_id) DO UPDATE SET
            comment = COALESCE($2, ai_responses.comment),
            dm = COALESCE($3, ai_responses.dm),
            proposal = COALESCE($4, ai_responses.proposal),
            updated_at = NOW()`,
        [postId, comment || null, dm || null, proposal || null]
      );
    }

    const nextStatus = action === 'approve' ? 'approved' : action === 'save' ? 'saved' : 'new';
    if (nextStatus !== 'new') {
      await db.query(
        `UPDATE monitor_posts SET status = $1, updated_at = NOW() WHERE id = $2`,
        [nextStatus, postId]
      );
    }

    res.json({ ok: true, action, status: nextStatus });
  } catch (e) {
    console.error('Monitor action failed:', e.message);
    res.status(500).json({ error: 'Failed to save action' });
  }
});

module.exports = router;
