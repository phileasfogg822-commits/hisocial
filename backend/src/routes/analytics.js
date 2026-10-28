const express = require('express');
const { decryptToken } = require('../utils/tokenCrypto');
const axios = require('axios');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseFacebookPageIdFromPostId(postId = '') {
  const value = String(postId || '');
  if (!value.includes('_')) return null;
  return value.split('_')[0] || null;
}

async function listFacebookPages(userAccessToken) {
  const response = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
    params: {
      fields: 'id,name,access_token',
      limit: 100,
      access_token: userAccessToken,
    },
    timeout: 20000,
  });

  return Array.isArray(response.data?.data) ? response.data.data : [];
}

async function getFacebookEngagement(platformPostId, userAccessToken, pageTokenMap) {
  const pageId = parseFacebookPageIdFromPostId(platformPostId);
  const token = (pageId && pageTokenMap.get(pageId)) || userAccessToken;

  const response = await axios.get(`https://graph.facebook.com/v18.0/${encodeURIComponent(platformPostId)}`, {
    params: {
      fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),likes.summary(true).limit(0)',
      access_token: token,
    },
    timeout: 20000,
  });

  const data = response.data || {};
  const reactions = safeNumber(data.reactions?.summary?.total_count);
  const comments = safeNumber(data.comments?.summary?.total_count);
  const likes = safeNumber(data.likes?.summary?.total_count);

  return { reactions, comments, likes };
}

async function getInstagramEngagement(platformPostId, accessToken) {
  const response = await axios.get(`https://graph.facebook.com/v18.0/${encodeURIComponent(platformPostId)}`, {
    params: {
      fields: 'like_count,comments_count',
      access_token: accessToken,
    },
    timeout: 20000,
  });

  const likes = safeNumber(response.data?.like_count);
  const comments = safeNumber(response.data?.comments_count);
  return {
    reactions: likes,
    comments,
    likes,
  };
}

async function getLinkedInEngagement(platformPostId, accessToken) {
  const encoded = encodeURIComponent(String(platformPostId || '').trim());
  const response = await axios.get(`https://api.linkedin.com/v2/socialActions/${encoded}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    timeout: 20000,
  });

  const data = response.data || {};
  const likes = safeNumber(data.likesSummary?.totalLikes);
  const comments = safeNumber(data.commentsSummary?.totalFirstLevelComments);

  return {
    reactions: likes,
    comments,
    likes,
  };
}

router.get('/engagement', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);

  try {
    const postsRes = await db.query(
      `SELECT p.id AS post_id,
              p.content,
              p.created_at,
              p.generation_source,
              p.generation_batch_id,
              p.generation_index,
              p.generation_total,
              pp.id AS platform_post_row_id,
              pp.platform,
              pp.platform_post_id,
              pp.platform_post_url,
              pp.status,
              pp.error_message,
              pp.posted_at
       FROM platform_posts pp
       JOIN posts p ON p.id = pp.post_id
       WHERE p.user_id = $1
         AND pp.platform IN ('facebook', 'instagram', 'linkedin')
         AND pp.status = 'success'
         AND pp.posted_at >= NOW() - ($2::text || ' days')::interval
       ORDER BY pp.posted_at DESC
       LIMIT 200`,
      [req.user.id, days]
    );

    const tokenRes = await db.query(
      `SELECT platform, access_token
       FROM social_accounts
       WHERE user_id = $1
         AND platform IN ('facebook', 'instagram', 'linkedin')
         AND is_active = true`,
      [req.user.id]
    );

    const tokens = new Map(tokenRes.rows.map((row) => [row.platform, decryptToken(row.access_token)]));

    let facebookPageTokenMap = new Map();
    const facebookToken = tokens.get('facebook');
    if (facebookToken) {
      try {
        const pages = await listFacebookPages(facebookToken);
        facebookPageTokenMap = new Map(pages.map((page) => [String(page.id), page.access_token]));
      } catch {
        facebookPageTokenMap = new Map();
      }
    }

    const items = await Promise.all(
      postsRes.rows.map(async (row) => {
        const platform = row.platform;
        const base = {
          platform,
          post_id: row.post_id,
          platform_post_id: row.platform_post_id,
          platform_post_url: row.platform_post_url,
          posted_at: row.posted_at,
          content_preview: String(row.content || '').slice(0, 220),
          generation_source: row.generation_source || null,
          generation_batch_id: row.generation_batch_id || null,
          generation_index: row.generation_index || null,
          generation_total: row.generation_total || null,
          reactions: 0,
          comments: 0,
          likes: 0,
          unavailable_reason: null,
        };

        if (!row.platform_post_id) {
          return {
            ...base,
            unavailable_reason: 'Missing platform_post_id',
          };
        }

        const token = tokens.get(platform);
        if (!token) {
          return {
            ...base,
            unavailable_reason: `${platform} account not connected`,
          };
        }

        try {
          let metrics;
          if (platform === 'facebook') {
            metrics = await getFacebookEngagement(row.platform_post_id, token, facebookPageTokenMap);
          } else if (platform === 'instagram') {
            metrics = await getInstagramEngagement(row.platform_post_id, token);
          } else {
            metrics = await getLinkedInEngagement(row.platform_post_id, token);
          }

          return {
            ...base,
            ...metrics,
          };
        } catch (e) {
          const message = axios.isAxiosError(e)
            ? (e.response?.data?.error?.message || e.response?.statusText || e.message)
            : (e?.message || 'Failed to fetch metrics');

          return {
            ...base,
            unavailable_reason: message,
          };
        }
      })
    );

    const totals = items.reduce((acc, item) => {
      acc.reactions += safeNumber(item.reactions);
      acc.comments += safeNumber(item.comments);
      acc.likes += safeNumber(item.likes);
      acc.posts += 1;
      return acc;
    }, { reactions: 0, comments: 0, likes: 0, posts: 0 });

    const byPlatform = ['facebook', 'instagram', 'linkedin'].map((platform) => {
      const platformItems = items.filter((item) => item.platform === platform);
      return {
        platform,
        posts: platformItems.length,
        reactions: platformItems.reduce((sum, item) => sum + safeNumber(item.reactions), 0),
        comments: platformItems.reduce((sum, item) => sum + safeNumber(item.comments), 0),
        likes: platformItems.reduce((sum, item) => sum + safeNumber(item.likes), 0),
      };
    });

    res.json({
      days,
      generated_at: new Date().toISOString(),
      totals,
      by_platform: byPlatform,
      items,
    });
  } catch (e) {
    console.error('Analytics engagement error:', e.message);
    res.status(500).json({ error: 'Failed to load analytics engagement' });
  }
});

// Phase 21: daily snapshots. Built from the app's own
// tables (no platform calls). Build is idempotent;
// yesterday's build is also triggered automatically by
// the scheduler tick (see posts.js).
router.get('/snapshots', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const params = [req.user.id, days];
  let platformFilter = '';
  if (req.query.platform) {
    params.push(req.query.platform);
    platformFilter = ` AND platform = $${params.length}`;
  }
  try {
    const result = await db.query(
      `SELECT snapshot_date, platform, published_count, failed_count, posts_created
       FROM analytics_daily_snapshots
       WHERE user_id=$1 AND snapshot_date >= CURRENT_DATE - ($2::text || ' days')::interval${platformFilter}
       ORDER BY snapshot_date DESC, platform ASC`,
      params
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/snapshots/build', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { buildSnapshotsForUser, yesterdayStr } = require('../services/snapshotBuilder');
  const dateStr = req.body?.date || yesterdayStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  try {
    const rows = await buildSnapshotsForUser(db, req.user.id, dateStr);
    res.json({ date: dateStr, rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Phase 22: insights comparisons. One dimension at
// a time — language, group, or platform — over the
// user's own posting record. Platform demographics
// (age/gender/location) are NOT here: no platform
// Insights API is wired in this codebase, so none
// are claimed.
router.get('/compare', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const dimension = req.query.dimension || 'platform';
  if (!['language', 'group', 'platform'].includes(dimension)) {
    return res.status(400).json({ error: 'dimension must be language, group, or platform' });
  }
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  try {
    const result = await db.query(
      `SELECT p.id AS post_id, p.language, g.name AS group_name, p.platforms,
              pp.platform AS pp_platform, pp.status AS pp_status
       FROM posts p
       LEFT JOIN account_groups g ON g.id = p.group_id
       LEFT JOIN platform_posts pp ON pp.post_id = p.id
       WHERE p.user_id=$1 AND p.created_at >= NOW() - ($2::text || ' days')::interval`,
      [req.user.id, days]
    );
    const { comparePosts } = require('../utils/insights');
    res.json({ dimension, days, rows: comparePosts(result.rows, dimension) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Phase 22: audience overview from stored accounts
// only — connected accounts per platform and per
// group. No follower counts: social_accounts has no
// follower column, and none is invented.
router.get('/audience', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const byPlatform = await db.query(
      `SELECT platform, COUNT(*)::int AS accounts FROM social_accounts
       WHERE user_id=$1 AND is_active = true GROUP BY platform ORDER BY platform`,
      [req.user.id]
    );
    const byGroup = await db.query(
      `SELECT COALESCE(g.name, 'ungrouped') AS group_name, COUNT(*)::int AS accounts
       FROM social_accounts sa LEFT JOIN account_groups g ON g.id = sa.group_id
       WHERE sa.user_id=$1 AND sa.is_active = true GROUP BY g.name ORDER BY g.name`,
      [req.user.id]
    );
    res.json({ by_platform: byPlatform.rows, by_group: byGroup.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
