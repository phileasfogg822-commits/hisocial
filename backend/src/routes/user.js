const express = require('express');
const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

router.get('/session', (req, res) => {
  res.json({
    authenticated: Boolean(req.session?.appAuthenticated || req.user),
    hasSelectedProfile: Boolean(req.user),
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatar_url: req.user.avatar_url,
      created_at: req.user.created_at,
    } : null,
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const expectedUsername = String(process.env.APP_LOGIN_USERNAME || 'admin').trim();
  const expectedPassword = String(process.env.APP_LOGIN_PASSWORD || 'change_me_now');

  if (String(username || '').trim() !== expectedUsername || String(password || '') !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.appAuthenticated = true;
  return req.session.save((err) => {
    if (err) return res.status(500).json({ error: 'Failed to start session' });
    return res.json({ success: true, authenticated: true });
  });
});

// Get current user with connected platforms
router.get('/me', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const accounts = await db.query(
      `SELECT id, platform, platform_username, platform_display_name, platform_avatar_url, 
       is_active, connected_at, token_expires_at
       FROM social_accounts WHERE user_id=$1 AND is_active=true`,
      [req.user.id]
    );
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar_url: req.user.avatar_url,
        created_at: req.user.created_at
      },
      connectedPlatforms: accounts.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update current user profile (name/avatar)
router.put('/me', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { name, avatar_url } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const result = await db.query(
      `UPDATE users
       SET name = $1,
           avatar_url = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, name, avatar_url, created_at`,
      [String(name).trim(), avatar_url || null, req.user.id]
    );

    const updatedUser = result.rows[0];
    req.login(updatedUser, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ user: updatedUser });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get post history
router.get('/posts', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const posts = await db.query(
      `SELECT p.*, 
       json_agg(json_build_object(
         'platform', pp.platform,
         'status', pp.status,
         'platform_post_url', pp.platform_post_url,
         'error_message', pp.error_message,
         'posted_at', pp.posted_at
       )) as platform_results
       FROM posts p
       LEFT JOIN platform_posts pp ON p.id = pp.post_id
       WHERE p.user_id=$1
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(posts.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
