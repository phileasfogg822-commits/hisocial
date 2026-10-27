// Phase 23: monitoring alert tests.
// node:test only, no new dependency. Rules are pure;
// wiring checks are static, in the Phase 4–22 style.
// A live alert cycle is an owner step (needs a
// running instance with failing posts or expiring
// tokens), not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { evaluateAlerts } = require('../src/utils/alertRules');

describe('alert rules', () => {
  it('fires a failure spike at 3 failures in 24h, not at 2', () => {
    assert.equal(evaluateAlerts({ failedRecent: 2 }).length, 0);
    const out = evaluateAlerts({ failedRecent: 3 });
    assert.equal(out.length, 1);
    assert.equal(out[0].type, 'failure_spike');
    assert.equal(out[0].severity, 'warning');
  });

  it('fires token expiry warnings and expired criticals, ignores dateless tokens', () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const out = evaluateAlerts({
      tokens: [
        { platform: 'facebook', token_expires_at: soon },
        { platform: 'instagram', token_expires_at: past },
        { platform: 'linkedin', token_expires_at: null },
      ],
    });
    assert.equal(out.find((a) => a.type === 'token_expiring').severity, 'warning');
    assert.equal(out.find((a) => a.type === 'token_expired').severity, 'critical');
    assert.equal(out.length, 2);
  });

  it('fires autopilot-disabled and approval backlog at threshold', () => {
    const out = evaluateAlerts({ autopilotDisabledReason: 'auto-disabled after 3 consecutive failed runs', awaitingApproval: 5 });
    assert.equal(out.find((a) => a.type === 'autopilot_disabled').severity, 'warning');
    assert.equal(out.find((a) => a.type === 'approval_backlog').severity, 'info');
    assert.equal(evaluateAlerts({ awaitingApproval: 4 }).length, 0);
  });
});

describe('alert wiring (static)', () => {
  const alertsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'alerts.js'), 'utf8');
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('alert endpoints, table, mount, and scheduler hook exist', () => {
    assert.match(alertsJs, /acknowledge/);
    assert.match(alertsJs, /\/evaluate/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS monitoring_alerts/);
    assert.match(indexJs, /api\/alerts/);
    assert.match(postsJs, /evaluateAllUsers/);
  });

  it('alerts view is reachable from the nav', () => {
    assert.match(frontendJs, /api\/alerts/);
    assert.match(frontendJs, /Monitoring Alerts/);
    assert.match(frontendJs, /AlertsView/);
  });
});
