// Phase 5: developer onboarding wizard tests.
// node:test only, no new dependency. The wizard data is
// pure, so these run without a database; the mount check is
// static, in the Phase 4 style. Live OAuth against a real
// developer app is an owner step, not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildRedirectUri,
  checkVars,
  SPECS,
  buildOnboarding,
} = require('../src/utils/onboarding');

describe('redirect URI resolution', () => {
  it('prefers the platform callback env var when set', () => {
    assert.equal(
      buildRedirectUri({ FACEBOOK_CALLBACK_URL: 'https://example.com/auth/facebook/callback' }, 'facebook'),
      'https://example.com/auth/facebook/callback',
    );
  });

  it('falls back to PUBLIC_BACKEND_URL, then localhost', () => {
    assert.equal(
      buildRedirectUri({ PUBLIC_BACKEND_URL: 'https://hisocial.example.com/' }, 'twitter'),
      'https://hisocial.example.com/auth/twitter/callback',
    );
    assert.equal(
      buildRedirectUri({}, 'reddit'),
      'http://localhost:4000/auth/reddit/callback',
    );
  });

  it('instagram falls back to the facebook callback URL, mirroring auth.js', () => {
    assert.equal(
      buildRedirectUri({ FACEBOOK_CALLBACK_URL: 'https://example.com/auth/instagram/callback' }, 'instagram'),
      'https://example.com/auth/instagram/callback',
    );
  });

  it('ignores placeholder values and returns null for unknown platforms', () => {
    assert.equal(
      buildRedirectUri({ FACEBOOK_CALLBACK_URL: 'your_facebook_callback' }, 'facebook'),
      'http://localhost:4000/auth/facebook/callback',
    );
    assert.equal(buildRedirectUri({}, 'tiktok'), null);
  });
});

describe('env-var checklist', () => {
  it('marks placeholders as missing', () => {
    assert.deepEqual(
      checkVars({ FACEBOOK_APP_ID: '123', FACEBOOK_APP_SECRET: 'your_facebook_secret' }, ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']),
      [
        { name: 'FACEBOOK_APP_ID', present: true },
        { name: 'FACEBOOK_APP_SECRET', present: false },
      ],
    );
  });
});

describe('onboarding specs', () => {
  it('covers every platform in /api/platforms, plus the LinkedIn company variant', () => {
    const ids = SPECS.map((s) => s.id);
    for (const expected of ['facebook', 'instagram', 'linkedin', 'linkedin_page', 'twitter', 'reddit', 'pinterest']) {
      assert.ok(ids.includes(expected), `missing spec for ${expected}`);
    }
  });

  it('every spec has the fields the wizard renders', () => {
    for (const spec of SPECS) {
      for (const field of ['id', 'name', 'connectId', 'portalUrl', 'portalName', 'productNote', 'redirectFieldNote']) {
        assert.ok(spec[field], `${spec.id} missing ${field}`);
      }
      assert.ok(Array.isArray(spec.requiredVars) && spec.requiredVars.length > 0, `${spec.id} needs requiredVars`);
    }
  });

  it('buildOnboarding never leaks secret values, only names and presence', () => {
    const env = {
      FACEBOOK_APP_ID: 'fb-id-123',
      FACEBOOK_APP_SECRET: 'fb-secret-xyz',
      PUBLIC_BACKEND_URL: 'https://hisocial.example.com',
    };
    const out = buildOnboarding(env);
    const text = JSON.stringify(out);
    assert.ok(!text.includes('fb-secret-xyz'), 'secret value leaked into wizard output');
    assert.ok(!text.includes('fb-id-123'), 'id value leaked into wizard output');
    const facebook = out.find((e) => e.id === 'facebook');
    assert.equal(facebook.configured, true);
    assert.equal(facebook.redirectUri, 'https://hisocial.example.com/auth/facebook/callback');
    const twitter = out.find((e) => e.id === 'twitter');
    assert.equal(twitter.configured, false);
  });

  it('the route is mounted at /api/onboarding', () => {
    const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
    assert.match(indexJs, /app\.use\('\/api\/onboarding', require\('\.\/routes\/onboarding'\)\)/);
  });
});
