// Phase 3: Google app-login configuration tests.
// node:test only, no new dependency. The config helper is pure,
// so these run without a database, Redis, or a Google account.
// Live Google OAuth (a real Google Cloud app, a real callback
// domain, a real consent screen) is NOT proven by these tests —
// that is an owner step, recorded in the gate doc.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GOOGLE_SCOPES,
  isGoogleConfigured,
  googleCallbackUrl,
} = require('../src/utils/googleLogin');

describe('googleLogin config', () => {
  it('is configured only when both id and secret are present', () => {
    assert.equal(isGoogleConfigured({ GOOGLE_CLIENT_ID: 'abc', GOOGLE_CLIENT_SECRET: 'def' }), true);
    assert.equal(isGoogleConfigured({ GOOGLE_CLIENT_ID: 'abc' }), false);
    assert.equal(isGoogleConfigured({ GOOGLE_CLIENT_SECRET: 'def' }), false);
    assert.equal(isGoogleConfigured({}), false);
  });

  it('treats placeholder values as not configured', () => {
    assert.equal(isGoogleConfigured({ GOOGLE_CLIENT_ID: 'your_google_client_id', GOOGLE_CLIENT_SECRET: 'def' }), false);
    assert.equal(isGoogleConfigured({ GOOGLE_CLIENT_ID: 'abc', GOOGLE_CLIENT_SECRET: 'your_google_client_secret' }), false);
  });

  it('uses the configured callback URL, or the localhost default', () => {
    assert.equal(
      googleCallbackUrl({ GOOGLE_CALLBACK_URL: 'https://example.test/auth/google/callback' }),
      'https://example.test/auth/google/callback',
    );
    assert.equal(googleCallbackUrl({}), 'http://localhost:4000/auth/google/callback');
  });

  it('requests identity scopes only — never a YouTube scope', () => {
    assert.deepEqual([...GOOGLE_SCOPES].sort(), ['email', 'profile']);
    assert.ok(!GOOGLE_SCOPES.some((scope) => scope.includes('youtube')));
  });
});

describe('googleLogin wiring (static parity)', () => {
  const passportJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'passport.js'), 'utf8');
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf8');
  const userJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'user.js'), 'utf8');

  it('passport registers the google strategy only when configured', () => {
    assert.match(passportJs, /passport\.use\('google', new GoogleStrategy/);
    assert.match(passportJs, /if \(isGoogleConfigured\(process\.env\)\)/);
  });

  it('auth routes expose /google and /google/callback without the app-login guard', () => {
    assert.match(authJs, /router\.get\('\/google', \(req, res, next\)/);
    assert.match(authJs, /router\.get\('\/google\/callback'/);
    assert.doesNotMatch(authJs, /router\.get\('\/google', requireAppProfile/);
    assert.doesNotMatch(authJs, /router\.get\('\/google\/callback', requireAppProfile/);
  });

  it('the local admin login fallback is still present and untouched in shape', () => {
    assert.match(userJs, /router\.post\('\/login'/);
    assert.match(userJs, /APP_LOGIN_USERNAME/);
    assert.match(userJs, /APP_LOGIN_PASSWORD/);
    assert.match(userJs, /req\.session\.appAuthenticated = true/);
  });

  it('auth status reports google configuration', () => {
    assert.match(authJs, /google: isGoogleConfigured\(process\.env\)/);
  });
});
