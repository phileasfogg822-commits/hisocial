// Phase 14: Muse bridge queue tests.
// node:test only, no new dependency. The queue helpers
// are pure; wiring checks are static, in the Phase 4–13
// style. A live worker claim/submit cycle is an owner
// step (scheduled dev window), not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  LEASE_MS,
  isClaimable,
  isLeaseExpired,
  validateJobInput,
  canApprove,
  canRequestFallback,
  tokensMatch,
} = require('../src/utils/museQueueLogic');

describe('lease and claiming', () => {
  it('lease is 15 minutes', () => {
    assert.equal(LEASE_MS, 15 * 60 * 1000);
  });

  it('queued jobs are claimable, live leases are not, expired leases are', () => {
    const now = Date.now();
    assert.equal(isClaimable({ status: 'queued' }, now), true);
    assert.equal(isClaimable({ status: 'leased', lease_expires_at: new Date(now + 60000).toISOString() }, now), false);
    assert.equal(isClaimable({ status: 'leased', lease_expires_at: new Date(now - 1000).toISOString() }, now), true);
    assert.equal(isClaimable({ status: 'done' }, now), false);
    assert.equal(isClaimable({ status: 'error' }, now), false);
    assert.equal(isLeaseExpired({ status: 'leased' }, now), true);
  });

  it('validates job input', () => {
    assert.equal(validateJobInput({ kind: 'image', prompt: 'a cat' }), null);
    assert.equal(validateJobInput({ kind: 'video', prompt: 'x' }), 'kind must be image or text');
    assert.equal(validateJobInput({ kind: 'image', prompt: '  ' }), 'prompt is required');
  });

  it('compares bridge tokens without throwing on length mismatch', () => {
    assert.equal(tokensMatch('abc', 'abc'), true);
    assert.equal(tokensMatch('abc', 'abd'), false);
    assert.equal(tokensMatch('abc', 'ab'), false);
    assert.equal(tokensMatch('', 'abc'), false);
  });
});

describe('approval and fallback transitions', () => {
  it('only done + pending-approval jobs can be approved', () => {
    assert.equal(canApprove({ status: 'done', approval: 'pending' }), true);
    assert.equal(canApprove({ status: 'done', approval: 'approved' }), false);
    assert.equal(canApprove({ status: 'queued', approval: 'pending' }), false);
    assert.equal(canApprove({ status: 'error', approval: 'pending' }), false);
  });

  it('fallback is only for jobs Muse did not deliver', () => {
    assert.equal(canRequestFallback({ status: 'error' }), true);
    assert.equal(canRequestFallback({ status: 'done', approval: 'rejected' }), true);
    assert.equal(canRequestFallback({ status: 'done', approval: 'pending' }), false);
    assert.equal(canRequestFallback({ status: 'queued' }), false);
    assert.equal(canRequestFallback({ status: 'leased' }), false);
  });
});

describe('muse queue wiring (static)', () => {
  const queueJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'museQueue.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('bridge endpoints, approval, and fallback all exist', () => {
    assert.match(queueJs, /\/next/);
    assert.match(queueJs, /heartbeat/);
    assert.match(queueJs, /\/asset/);
    assert.match(queueJs, /\/result/);
    assert.match(queueJs, /\/approve/);
    assert.match(queueJs, /\/reject/);
    assert.match(queueJs, /\/fallback/);
    assert.match(queueJs, /MUSE_BRIDGE_TOKEN/);
  });

  it('table exists in init.sql and runMigrations, route is mounted', () => {
    assert.match(initSql, /CREATE TABLE IF NOT EXISTS muse_jobs/);
    assert.match(initSql, /approval VARCHAR/);
    assert.match(initSql, /fallback_provider/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS muse_jobs/);
    assert.match(indexJs, /routes\/museQueue/);
  });

  it('compose requests, approves, and falls back on Muse jobs', () => {
    assert.match(frontendJs, /api\/muse-queue\/jobs/);
    assert.match(frontendJs, /Request Muse Image/);
    assert.match(frontendJs, /Approve & Use/);
    assert.match(frontendJs, /Fall back to API provider/);
  });
});
