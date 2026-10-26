const express = require('express');
const { scrapeLinkedInHomeFeed } = require('../services/linkedinFeedScraper');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  return next();
}

const runningByUser = new Map();

router.get('/posts', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));

  try {
    const result = await db.query(
      `SELECT id, author, profile_link, post_text, post_link, image_url, comments, posted_time, mentions, created_at
       FROM linkedin_feed_posts
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({ posts: result.rows });
  } catch (e) {
    console.error('LinkedIn feed posts error:', e);
    res.status(500).json({ error: 'Failed to load LinkedIn feed posts' });
  }
});

router.get('/runs', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT id, status, max_posts, captured_posts, error_message, created_at, finished_at
       FROM linkedin_feed_runs
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({ runs: result.rows, running: Boolean(runningByUser.get(userId)) });
  } catch (e) {
    console.error('LinkedIn feed runs error:', e);
    res.status(500).json({ error: 'Failed to load LinkedIn feed runs' });
  }
});

router.post('/scrape', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;

  if (runningByUser.get(userId)) {
    return res.status(409).json({ error: 'A LinkedIn feed run is already in progress' });
  }

  const maxPosts = Math.max(1, Math.min(100, Number(req.body?.maxPosts) || 30));
  const chromeProfilePath = String(req.body?.chromeProfilePath || '').trim();
  const profileDirectory = String(req.body?.profileDirectory || 'Default').trim() || 'Default';

  if (!chromeProfilePath) {
    return res.status(400).json({ error: 'Chrome profile path is required' });
  }

  runningByUser.set(userId, true);

  try {
    const runRow = await db.query(
      `INSERT INTO linkedin_feed_runs (user_id, status, max_posts)
       VALUES ($1, 'running', $2)
       RETURNING id`,
      [userId, maxPosts]
    );

    const runId = runRow.rows[0].id;

    const posts = await scrapeLinkedInHomeFeed({ maxPosts, chromeProfilePath, profileDirectory });

    for (const post of posts) {
      await db.query(
        `INSERT INTO linkedin_feed_posts
         (user_id, run_id, author, profile_link, post_text, post_link, image_url, comments, posted_time, mentions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          userId,
          runId,
          String(post.author || '').trim(),
          String(post.profileLink || '').trim(),
          String(post.postText || '').trim(),
          String(post.postLink || '').trim(),
          String(post.imageUrl || '').trim() || null,
          String(post.comments || '').trim(),
          String(post.postedTime || '').trim(),
          Array.isArray(post.mentions) ? post.mentions : [],
        ]
      );
    }

    await db.query(
      `UPDATE linkedin_feed_runs
       SET status='success', captured_posts=$2, finished_at=NOW()
       WHERE id=$1`,
      [runId, posts.length]
    );

    res.json({ success: true, runId, captured: posts.length });
  } catch (e) {
    console.error('LinkedIn feed scrape error:', e);

    await db.query(
      `INSERT INTO linkedin_feed_runs (user_id, status, max_posts, captured_posts, error_message, finished_at)
       VALUES ($1, 'failed', $2, 0, $3, NOW())`,
      [userId, maxPosts, e.message]
    ).catch(() => {});

    res.status(500).json({ error: e.message || 'LinkedIn feed scrape failed' });
  } finally {
    runningByUser.delete(userId);
  }
});

router.delete('/posts/:postId', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;
  const { postId } = req.params;

  try {
    const result = await db.query(
      `DELETE FROM linkedin_feed_posts
       WHERE id=$1 AND user_id=$2
       RETURNING id`,
      [postId, userId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (e) {
    console.error('LinkedIn feed delete post error:', e);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
