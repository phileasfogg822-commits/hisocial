// Phase 6: Meta token repair/refresh tests.
// node:test only, no new dependency. Exchange and health
// logic are pure or injected, so these run without Meta
// and without a database; wiring checks are static, in
// the Phase 4–5 style. A live exchange against Meta is an
// owner step, not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  exchangeForLongLivedToken,
  tokenStatus,
  canAttemptRefresh,
} = require('../src/utils/metaTokens');

describe('long-lived exchange', () => {
  it('calls fb_exchange_token with the app credentials and returns token + expiry', async () => {
    let seenUrl;
    let seenParams;
    const fakeGet = async (url, params) => {
      seenUrl = url;
      seenParams = params;
      return { data: { access_token: 'long-lived-abc', expires_in: 5184000 } };
    };
    const before = Date.now();
    const out = await exchangeForLongLivedToken({
      token: 'short-lived-xyz', appId: 'app-1', appSecret: 'secret-1', httpGet: fakeGet,
    });
    assert.equal(seenUrl, 'https://graph.facebook.com/v18.0/oauth/access_token');
    assert.equal(seenParams.grant_type, 'fb_exchange_token');
    assert.equal(seenParams.fb_exchange_token, 'short-lived-xyz');
    assert.equal(seenParams.client_id, 'app-1');
    assert.equal(seenParams.client_secret, 'secret-1');
    assert.equal(out.accessToken, 'long-lived-abc');
    assert.ok(out.expiresAt.getTime() - before >= 5184000 * 1000 - 5000);
  });

  it('throws when Meta returns no access_token', async () => {
    await assert.rejects(
      exchangeForLongLivedToken({
        token: 'bad', appId: 'a', appSecret: 's',
        httpGet: async () => ({ data: { error: { message: 'invalid' } } }),
      }),
      /no access_token/,
    );
  });
});

describe('token health', () => {
  const now = new Date('2026-10-27T10:00:00Z');
  it('classifies ok, expiring soon (<7 days), expired, and unknown', () => {
    assert.equal(tokenStatus(new Date('2026-12-27T10:00:00Z'), now), 'ok');
    assert.equal(tokenStatus(new Date('2026-11-01T10:00:00Z'), now), 'expiring_soon');
    assert.equal(tokenStatus(new Date('2026-10-27T09:00:00Z'), now), 'expired');
    assert.equal(tokenStatus(null, now), 'unknown');
    assert.equal(tokenStatus('not-a-date', now), 'unknown');
  });

  it('refresh is attempted only for expiring soon or expired', () => {
    assert.equal(canAttemptRefresh('expiring_soon'), true);
    assert.equal(canAttemptRefresh('expired'), true);
    assert.equal(canAttemptRefresh('ok'), false);
    assert.equal(canAttemptRefresh('unknown'), false);
  });
});

describe('meta wiring (static)', () => {
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const passportJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'passport.js'), 'utf8');
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf8');

  it('meta routes are mounted', () => {
    assert.match(indexJs, /app\.use\('\/api\/meta', require\('\.\/routes\/meta'\)\)/);
  });

  it('facebook connect exchanges for a long-lived token before storing', () => {
    assert.match(passportJs, /exchangeForLongLivedToken/);
    assert.match(passportJs, /storing short-lived token/);
  });

  it('instagram callback exchanges before fetching pages, and both inserts record expiry', () => {
    const exchangeAt = authJs.indexOf('exchangeForLongLivedToken');
    const pagesAt = authJs.indexOf("me/accounts");
    assert.ok(exchangeAt > 0 && exchangeAt < pagesAt, 'exchange must happen before /me/accounts');
    const igInserts = (authJs.match(/token_expires_at\)/g) || []).length;
    assert.ok(igInserts >= 2, 'both instagram inserts should store token_expires_at');
  });

  it('linkAccount stores expiry', () => {
    assert.match(passportJs, /tokenExpiry = null/);
    assert.match(passportJs, /token_expires_at/);
  });
});
