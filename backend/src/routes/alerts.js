// Phase 23: monitoring alerts endpoints.
const express = require('express');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT id, type, severity, message, dedup_key, status, created_at, acknowledged_at, resolved_at
       FROM monitoring_alerts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/evaluate', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { evaluateAlertsForUser } = require('../services/alertEvaluator');
    const candidates = await evaluateAlertsForUser(db, req.user.id);
    res.json({ evaluated: true, candidates: candidates.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/acknowledge', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `UPDATE monitoring_alerts SET status='acknowledged', acknowledged_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='open' RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Open alert not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
