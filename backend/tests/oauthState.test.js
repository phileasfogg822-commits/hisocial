// Phase 2: real unit tests for the OAuth state helper.
// node:test only, no new dependency. The helper is pure except for
// the signing secret, which the tests pin via env so a tampered
// token from one secret cannot validate under another.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_SECRET = 'phase2-test-secret';
const {
  encodeOauthState,
  decodeOauthState,
  getOauthLinkedUserId,
} = require('../src/utils/oauthState');

describe('oauthState', () => {
  it('round-trips a payload through encode/decode', () => {
    const token = encodeOauthState({ userId: 'user-123', provider: 'facebook' });
    const decoded = decodeOauthState(token);
    assert.equal(decoded.userId, 'user-123');
    assert.equal(decoded.provider, 'facebook');
    assert.equal(typeof decoded.ts, 'number');
  });

  it('rejects a tampered body', () => {
    const token = encodeOauthState({ userId: 'user-123' });
    const [body] = token.split('.');
    const tamperedBody = Buffer.from(
      JSON.stringify({ userId: 'attacker', ts: Date.now() }),
      'utf8',
    ).toString('base64url');
    assert.notEqual(tamperedBody, body);
    assert.equal(decodeOauthState(`${tamperedBody}.${token.split('.')[1]}`), null);
  });

  it('rejects a tampered signature', () => {
    const token = encodeOauthState({ userId: 'user-123' });
    const [body] = token.split('.');
    assert.equal(decodeOauthState(`${body}.invalidsignature`), null);
  });

  it('returns null for malformed input', () => {
    assert.equal(decodeOauthState(''), null);
    assert.equal(decodeOauthState('no-dot-here'), null);
    assert.equal(decodeOauthState(null), null);
    assert.equal(decodeOauthState(undefined), null);
  });

  it('prefers the signed state userId over the session user', () => {
    const token = encodeOauthState({ userId: 'state-user' });
    const req = { query: { state: token }, user: { id: 'session-user' } };
    assert.equal(getOauthLinkedUserId(req), 'state-user');
  });

  it('falls back to the session user when state is absent or invalid', () => {
    assert.equal(getOauthLinkedUserId({ query: {}, user: { id: 'session-user' } }), 'session-user');
    assert.equal(getOauthLinkedUserId({ query: { state: 'bad' }, user: { id: 'session-user' } }), 'session-user');
    assert.equal(getOauthLinkedUserId({ query: {} }), null);
  });
});
