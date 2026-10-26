// Phase 0 unit tests for museQueueLogic.js. No Express, no Postgres needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LEASE_MS, isClaimable, isLeaseExpired, validateJobInput, tokensMatch,
} = require('../backend/museQueueLogic');

const NOW = Date.now();
const liveLease = {
  status: 'leased',
  lease_expires_at: new Date(NOW + 60000).toISOString(),
};
const expiredLease = {
  status: 'leased',
  lease_expires_at: new Date(NOW - 1000).toISOString(),
};

test('lease is 15 minutes', () => {
  assert.equal(LEASE_MS, 15 * 60 * 1000);
});

test('queued job is claimable, live lease is not, expired lease is', () => {
  assert.equal(isClaimable({ status: 'queued' }, NOW), true);
  assert.equal(isClaimable(liveLease, NOW), false);
  assert.equal(isClaimable(expiredLease, NOW), true);
  assert.equal(isClaimable({ status: 'done' }, NOW), false);
  assert.equal(isClaimable({ status: 'error' }, NOW), false);
  assert.equal(isClaimable(null, NOW), false);
});

test('isLeaseExpired only applies to leased jobs', () => {
  assert.equal(isLeaseExpired({ status: 'queued' }, NOW), false);
  assert.equal(isLeaseExpired(liveLease, NOW), false);
  assert.equal(isLeaseExpired(expiredLease, NOW), true);
});

test('job input validation', () => {
  assert.equal(validateJobInput({ kind: 'image', prompt: 'a cat' }), null);
  assert.equal(validateJobInput({ kind: 'video', prompt: 'x' }), 'kind must be image or text');
  assert.equal(validateJobInput({ kind: 'image', prompt: '  ' }), 'prompt is required');
  assert.equal(validateJobInput({ kind: 'image' }), 'prompt is required');
  assert.equal(validateJobInput(null), 'body is required');
});

test('token comparison is exact and safe on mismatch', () => {
  assert.equal(tokensMatch('abc123', 'abc123'), true);
  assert.equal(tokensMatch('abc123', 'abc124'), false);
  assert.equal(tokensMatch('abc123', 'short'), false);
  assert.equal(tokensMatch('', 'abc'), false);
  assert.equal(tokensMatch('abc', ''), false);
});
