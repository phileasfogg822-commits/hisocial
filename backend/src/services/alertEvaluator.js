// Phase 23: monitoring alert evaluator.
//
// evaluateAlertsForUser(db, userId) gathers the
// signals, runs the pure rules, opens alerts that
// are not already open, and resolves open alerts
// whose condition cleared. It never throws — the
// scheduler tick calls it and must not break on
// an alert failure.
const { evaluateAlerts } = require('../utils/alertRules');

async function evaluateAlertsForUser(db, userId) {
  try {
    const failedRes = await db.query(
      `SELECT COUNT(*)::int AS n FROM platform_posts pp
       JOIN posts p ON p.id = pp.post_id
       WHERE p.user_id=$1 AND pp.status='failed' AND pp.posted_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    const tokensRes = await db.query(
      `SELECT platform, token_expires_at FROM social_accounts
       WHERE user_id=$1 AND is_active = true AND token_expires_at IS NOT NULL`,
      [userId]
    );
    const autopilotRes = await db.query(
      `SELECT disabled_reason FROM ai_autopilot_configs WHERE user_id=$1`,
      [userId]
    );
    const awaitingRes = await db.query(
      `SELECT COUNT(*)::int AS n FROM posts WHERE user_id=$1 AND status='awaiting_approval'`,
      [userId]
    );
    const candidates = evaluateAlerts({
      failedRecent: failedRes.rows[0]?.n || 0,
      tokens: tokensRes.rows,
      autopilotDisabledReason: autopilotRes.rows[0]?.disabled_reason || null,
      awaitingApproval: awaitingRes.rows[0]?.n || 0,
    });
    const candidateKeys = new Set(candidates.map((c) => c.dedup_key));
    for (const candidate of candidates) {
      const existing = await db.query(
        `SELECT id FROM monitoring_alerts WHERE user_id=$1 AND dedup_key=$2 AND status='open' LIMIT 1`,
        [userId, candidate.dedup_key]
      );
      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO monitoring_alerts (user_id, type, severity, message, dedup_key, status)
           VALUES ($1,$2,$3,$4,$5,'open')`,
          [userId, candidate.type, candidate.severity, candidate.message, candidate.dedup_key]
        );
      }
    }
    // Resolve open alerts whose condition cleared.
    const openRes = await db.query(
      `SELECT id, dedup_key FROM monitoring_alerts WHERE user_id=$1 AND status='open'`,
      [userId]
    );
    for (const row of openRes.rows) {
      if (!candidateKeys.has(row.dedup_key)) {
        await db.query(
          `UPDATE monitoring_alerts SET status='resolved', resolved_at=NOW() WHERE id=$1`,
          [row.id]
        );
      }
    }
    return candidates;
  } catch (e) {
    console.error('🔔 Alert evaluation failed (scheduling unaffected):', e.message);
    return [];
  }
}

async function evaluateAllUsers(db) {
  try {
    const usersRes = await db.query(`SELECT DISTINCT user_id FROM posts`);
    for (const { user_id: userId } of usersRes.rows) {
      await evaluateAlertsForUser(db, userId);
    }
  } catch (e) {
    console.error('🔔 Alert evaluation failed (scheduling unaffected):', e.message);
  }
}

module.exports = { evaluateAlertsForUser, evaluateAllUsers };
