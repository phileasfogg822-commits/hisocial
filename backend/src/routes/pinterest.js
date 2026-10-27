// Phase 10: Pinterest board listing for Compose.
// Returns the user's boards (id + name only — never
// tokens) so a post can target a chosen board instead
// of always landing on the first one.
const express = require('express');
const axios = require('axios');
const { requireProfile } = require('../middleware/auth');

const router = express.Router();

router.get('/boards', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const row = await db.query(
    `SELECT access_token FROM social_accounts
     WHERE user_id=$1 AND platform='pinterest' AND is_active=true
     ORDER BY created_at DESC LIMIT 1`,
    [req.user.id]
  );
  if (!row.rows[0]) return res.status(400).json({ error: 'Pinterest is not connected' });
  try {
    const boardsRes = await axios.get('https://api.pinterest.com/v5/boards', {
      headers: { Authorization: `Bearer ${row.rows[0].access_token}` },
    });
    const boards = (boardsRes.data.items || []).map((b) => ({ id: b.id, name: b.name }));
    res.json({ boards });
  } catch (e) {
    res.status(502).json({ error: e.response?.data?.message || 'Could not load Pinterest boards' });
  }
});

module.exports = router;
