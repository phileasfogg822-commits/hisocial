const express = require('express');
const router = express.Router();

const requireAppLogin = (req, res, next) => {
  if (!req.session?.appAuthenticated) {
    return res.status(401).json({ error: 'Please log in to access the app' });
  }
  return next();
};

// List available app accounts.
router.get('/', requireAppLogin, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_url,
              COUNT(sa.id) FILTER (WHERE sa.is_active = true) AS connected_platforms
       FROM users u
       LEFT JOIN social_accounts sa ON sa.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at ASC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create a new app account.
router.post('/', requireAppLogin, async (req, res) => {
  const db = req.app.locals.db;
  const { name, email, avatarUrl } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  try {
    const created = await db.query(
      `INSERT INTO users (name, email, avatar_url)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, avatar_url, created_at`,
      [String(name).trim(), String(email).trim().toLowerCase(), avatarUrl || null]
    );

    res.status(201).json(created.rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: e.message });
  }
});

// Switch active session user to one of the app accounts.
router.post('/switch', requireAppLogin, async (req, res, next) => {
  const db = req.app.locals.db;
  const { accountId } = req.body || {};

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  try {
    const userResult = await db.query(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
      [accountId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const user = userResult.rows[0];
    req.login(user, async (err) => {
      if (err) return next(err);

      const accounts = await db.query(
        `SELECT platform, platform_username, platform_display_name, platform_avatar_url,
                is_active, connected_at, token_expires_at
         FROM social_accounts
         WHERE user_id = $1 AND is_active = true`,
        [user.id]
      );

      res.json({
        user,
        connectedPlatforms: accounts.rows
      });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
