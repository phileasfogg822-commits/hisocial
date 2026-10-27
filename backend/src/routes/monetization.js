// Phase 24: monetization ledger endpoints.
const express = require('express');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const params = [req.user.id];
  let filters = '';
  if (req.query.platform) {
    params.push(req.query.platform);
    filters += ` AND platform = $${params.length}`;
  }
  if (req.query.kind) {
    params.push(req.query.kind);
    filters += ` AND kind = $${params.length}`;
  }
  try {
    const result = await db.query(
      `SELECT id, kind, category, amount, currency, platform, post_id, note, entry_date, created_at
       FROM monetization_entries WHERE user_id=$1${filters}
       ORDER BY entry_date DESC NULLS LAST, created_at DESC LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { validateEntryInput } = require('../utils/monetization');
  const { errors, entry } = validateEntryInput(req.body || {});
  if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });
  try {
    if (entry.post_id) {
      const own = await db.query(`SELECT id FROM posts WHERE id=$1 AND user_id=$2`, [entry.post_id, req.user.id]);
      if (!own.rows[0]) return res.status(404).json({ error: 'Post not found' });
    }
    const result = await db.query(
      `INSERT INTO monetization_entries (user_id, kind, category, amount, currency, platform, post_id, note, entry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, CURRENT_DATE)) RETURNING *`,
      [req.user.id, entry.kind, entry.category, entry.amount, entry.currency, entry.platform, entry.post_id, entry.note, entry.entry_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `DELETE FROM monetization_entries WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Entry not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT kind, category, amount, currency, platform, entry_date
       FROM monetization_entries WHERE user_id=$1 ORDER BY entry_date DESC LIMIT 1000`,
      [req.user.id]
    );
    const { summarizeEntries } = require('../utils/monetization');
    res.json(summarizeEntries(result.rows));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
