// Phase 25: weekly report endpoints (JSON + CSV).
const express = require('express');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

async function loadReportData(db, userId, endDate) {
  const { periodFor, parseEndDate, buildWeeklyReport } = require('../utils/reports');
  const end = parseEndDate(endDate);
  const period = periodFor(end);
  const snapshotsRes = await db.query(
    `SELECT platform, published_count, failed_count, posts_created
     FROM analytics_daily_snapshots
     WHERE user_id=$1 AND snapshot_date BETWEEN $2 AND $3`,
    [userId, period.start, period.end]
  );
  const monetizationRes = await db.query(
    `SELECT kind, category, amount, currency, platform, entry_date
     FROM monetization_entries WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3`,
    [userId, period.start, period.end]
  );
  const alertsRes = await db.query(
    `SELECT type, severity, message FROM monitoring_alerts
     WHERE user_id=$1 AND status='open' ORDER BY created_at DESC`,
    [userId]
  );
  return buildWeeklyReport({
    endDate: end,
    snapshots: snapshotsRes.rows,
    monetizationEntries: monetizationRes.rows,
    openAlerts: alertsRes.rows,
  });
}

router.get('/weekly', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    res.json(await loadReportData(db, req.user.id, req.query.end));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/weekly.csv', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const report = await loadReportData(db, req.user.id, req.query.end);
    const { reportToCsv } = require('../utils/reports');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-report-${report.period.start}-to-${report.period.end}.csv"`);
    res.send(reportToCsv(report));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
