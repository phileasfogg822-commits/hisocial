// Phase 17: durable scheduler tests.
// node:test only, no new dependency. Retry/stuck rules
// are pure; wiring checks are static, in the Phase 4–16
// style. A live publish/retry cycle is an owner step
// (needs a running instance + platform tokens), not
// something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_ATTEMPTS,
  STUCK_AFTER_MS,
  computeBackoffMs,
  isDue,
  isStuckPost,
  nextAttemptAfterFailure,
} = require('../src/utils/scheduler');

describe('retry backoff', () => {
  it('doubles from 60s and caps at one hour', () => {
    assert.equal(computeBackoffMs(1), 60 * 1000);
    assert.equal(computeBackoffMs(2), 2 * 60 * 1000);
    assert.equal(computeBackoffMs(3), 4 * 60 * 1000);
    assert.equal(computeBackoffMs(10), 60 * 60 * 1000);
  });

  it('retries until MAX_ATTEMPTS, then goes terminal', () => {
    assert.equal(nextAttemptAfterFailure(1).terminal, false);
    assert.equal(nextAttemptAfterFailure(MAX_ATTEMPTS - 1).terminal, false);
    assert.equal(nextAttemptAfterFailure(MAX_ATTEMPTS).terminal, true);
    assert.equal(MAX_ATTEMPTS, 5);
  });
});

describe('due and stuck rules', () => {
  const now = Date.now();
  const past = new Date(now - 60000).toISOString();
  const future = new Date(now + 60000).toISOString();

  it('due only when scheduled, time reached, and no retry delay running', () => {
    assert.equal(isDue({ status: 'scheduled', scheduled_at: past }, now), true);
    assert.equal(isDue({ status: 'scheduled', scheduled_at: future }, now), false);
    assert.equal(isDue({ status: 'scheduled', scheduled_at: past, next_attempt_at: future }, now), false);
    assert.equal(isDue({ status: 'scheduled', scheduled_at: past, next_attempt_at: past }, now), true);
    assert.equal(isDue({ status: 'published', scheduled_at: past }, now), false);
  });

  it('stuck only for posting posts older than the window', () => {
    assert.equal(STUCK_AFTER_MS, 10 * 60 * 1000);
    assert.equal(isStuckPost({ status: 'posting', updated_at: new Date(now - 11 * 60 * 1000).toISOString() }, now), true);
    assert.equal(isStuckPost({ status: 'posting', updated_at: new Date(now - 60 * 1000).toISOString() }, now), false);
    assert.equal(isStuckPost({ status: 'scheduled', updated_at: past }, now), false);
  });
});

describe('scheduler wiring (static)', () => {
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('scheduler retries, recovers stuck posts, and never retries partial', () => {
    assert.match(postsJs, /recoverStuckPosts/);
    assert.match(postsJs, /next_attempt_at/);
    assert.match(postsJs, /failAttempt/);
    assert.match(postsJs, /finalStatus === 'failed'/);
  });

  it('posts carry group + attempt columns in init.sql and runMigrations', () => {
    assert.match(initSql, /group_id UUID REFERENCES account_groups/);
    assert.match(initSql, /attempts INTEGER/);
    assert.match(indexJs, /ADD COLUMN IF NOT EXISTS group_id/);
    assert.match(indexJs, /ADD COLUMN IF NOT EXISTS attempts/);
  });

  it('calendar filters by group and drafts can be group-tagged', () => {
    assert.match(postsJs, /group_id/);
    assert.match(frontendJs, /calendarGroupId/);
    assert.match(frontendJs, /draftGroupId/);
    assert.match(frontendJs, /All groups/);
  });
});
