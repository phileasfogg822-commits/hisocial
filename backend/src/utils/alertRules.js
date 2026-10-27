// Phase 23: monitoring alert rules (pure).
//
// An alert is a fact about the app's own tables,
// not a platform claim. Thresholds are constants
// here so they are visible and testable:
// - FAILURE_SPIKE: 3+ failed platform_posts in the
//   last 24 hours.
// - TOKEN_EXPIRING: a connected account's token
//   expires within 7 days. TOKEN_EXPIRED: already
//   past expiry. Accounts with no expiry recorded
//   never alert — absence of data is not a warning.
// - AUTOPILOT_DISABLED: the autopilot config was
//   auto-disabled (Phase 19) with a reason.
// - APPROVAL_BACKLOG: 5+ posts awaiting approval.
//
// A candidate carries a dedup_key: the evaluator
// opens one alert per (user, dedup_key) and never
// duplicates an open one, so a persistent condition
// does not spam the inbox every scheduler tick.
// When a condition clears, its open alerts resolve.
const FAILURE_SPIKE_THRESHOLD = 3;
const TOKEN_EXPIRY_WINDOW_DAYS = 7;
const APPROVAL_BACKLOG_THRESHOLD = 5;

function evaluateAlerts(input = {}) {
  const alerts = [];
  const failedRecent = Number(input.failedRecent || 0);
  if (failedRecent >= FAILURE_SPIKE_THRESHOLD) {
    alerts.push({
      type: 'failure_spike',
      severity: 'warning',
      dedup_key: 'failure_spike',
      message: `${failedRecent} publish failures in the last 24 hours — check the failed posts before retrying.`,
    });
  }
  for (const token of (input.tokens || [])) {
    if (!token.token_expires_at) continue;
    const expires = new Date(token.token_expires_at);
    const daysLeft = (expires - new Date()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 0) {
      alerts.push({
        type: 'token_expired',
        severity: 'critical',
        dedup_key: `token_expired:${token.platform}`,
        message: `The ${token.platform} token has expired — reconnect it before the next publish.`,
      });
    } else if (daysLeft <= TOKEN_EXPIRY_WINDOW_DAYS) {
      alerts.push({
        type: 'token_expiring',
        severity: 'warning',
        dedup_key: `token_expiring:${token.platform}`,
        message: `The ${token.platform} token expires in ${Math.ceil(daysLeft)} day(s) — refresh or reconnect it soon.`,
      });
    }
  }
  if (input.autopilotDisabledReason) {
    alerts.push({
      type: 'autopilot_disabled',
      severity: 'warning',
      dedup_key: 'autopilot_disabled',
      message: `Auto Pilot was disabled: ${input.autopilotDisabledReason}`,
    });
  }
  const awaiting = Number(input.awaitingApproval || 0);
  if (awaiting >= APPROVAL_BACKLOG_THRESHOLD) {
    alerts.push({
      type: 'approval_backlog',
      severity: 'info',
      dedup_key: 'approval_backlog',
      message: `${awaiting} posts are awaiting your approval in the inbox.`,
    });
  }
  return alerts;
}

module.exports = {
  evaluateAlerts,
  FAILURE_SPIKE_THRESHOLD,
  TOKEN_EXPIRY_WINDOW_DAYS,
  APPROVAL_BACKLOG_THRESHOLD,
};
