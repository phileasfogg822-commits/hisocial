// Phase 19: autopilot safety tests.
// node:test only, no new dependency. Safety rules are
// pure; wiring checks are static, in the Phase 4–18
// style. A live kill/cap/failure cycle is an owner step
// (needs a running instance), not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_CONSECUTIVE_FAILURES,
  shouldSkipRun,
  remainingForToday,
  afterFailure,
} = require('../src/utils/autopilotSafety');

describe('kill switch precedence', () => {
  it('kill beats everything, including force', () => {
    assert.equal(shouldSkipRun({ killed: true, enabled: true, force: true, lastRunOn: null, today: '2026-10-27' }), 'killed');
    assert.equal(shouldSkipRun({ killed: false, enabled: false, force: false, lastRunOn: null, today: '2026-10-27' }), 'disabled');
    assert.equal(shouldSkipRun({ killed: false, enabled: false, force: true, lastRunOn: null, today: '2026-10-27' }), null);
    assert.equal(shouldSkipRun({ killed: false, enabled: true, force: false, lastRunOn: '2026-10-27', today: '2026-10-27' }), 'already-ran-today');
    assert.equal(shouldSkipRun({ killed: false, enabled: true, force: false, lastRunOn: '2026-10-26', today: '2026-10-27' }), null);
  });
});

describe('daily cap and failure accounting', () => {
  it('remaining counts down to zero and never goes negative', () => {
    assert.equal(remainingForToday(0, 3), 3);
    assert.equal(remainingForToday(3, 3), 0);
    assert.equal(remainingForToday(9, 3), 0);
    assert.equal(remainingForToday(0, 99), 5);
  });

  it('auto-disables exactly at the failure threshold', () => {
    assert.equal(MAX_CONSECUTIVE_FAILURES, 3);
    assert.equal(afterFailure(0).shouldDisable, false);
    assert.equal(afterFailure(2).shouldDisable, true);
    assert.equal(afterFailure(2).consecutiveFailures, 3);
  });
});

describe('autopilot safety wiring (static)', () => {
  const workerJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'autoPilotWorker.js'), 'utf8');
  const routesJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'autopilot.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('worker enforces kill, daily cap, per-post tolerance, and failure accounting', () => {
    assert.match(workerJs, /isAutopilotKilled/);
    assert.match(workerJs, /remainingForToday/);
    assert.match(workerJs, /failedPosts/);
    assert.match(workerJs, /noteAutopilotFailure/);
    assert.match(workerJs, /daily-cap-reached/);
  });

  it('kill/resume/status routes and control table exist', () => {
    assert.match(routesJs, /\/kill/);
    assert.match(routesJs, /\/resume/);
    assert.match(routesJs, /\/status/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS autopilot_control/);
    assert.match(indexJs, /consecutive_failures/);
  });

  it('Auto Pilot view carries the kill switch', () => {
    assert.match(frontendJs, /api\/autopilot\/status/);
    assert.match(frontendJs, /Kill Auto Pilot/);
    assert.match(frontendJs, /Resume Auto Pilot/);
  });
});
