// Phase 28: security hardening + backup + rotation tests.
// node:test only, no new dependency. Crypto is pure
// over process.env; wiring checks are static, in the
// Phase 4–27 style. A live encrypted connect +
// backup + rotation cycle is an owner step (needs a
// running instance with ENCRYPTION_KEY + platform
// credentials), not something CI proves.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { encryptToken, decryptToken, isEncrypted, encryptionEnabled } = require('../src/utils/tokenCrypto');

describe('token encryption', () => {
  const OLD_KEY = process.env.ENCRYPTION_KEY;
  beforeEach(() => { process.env.ENCRYPTION_KEY = 'test-key-for-phase-28-only'; });
  afterEach(() => {
    if (OLD_KEY === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = OLD_KEY;
  });

  it('round-trips a token and marks it encrypted', () => {
    const stored = encryptToken('secret-token-123');
    assert.ok(isEncrypted(stored));
    assert.notEqual(stored, 'secret-token-123');
    assert.equal(decryptToken(stored), 'secret-token-123');
  });

  it('passes legacy plaintext through and leaves empties alone', () => {
    assert.equal(decryptToken('plain-old-token'), 'plain-old-token');
    assert.equal(decryptToken(null), null);
    assert.equal(encryptToken(null), null);
  });

  it('fails closed without a key', () => {
    delete process.env.ENCRYPTION_KEY;
    assert.equal(encryptionEnabled(), false);
    assert.throws(() => encryptToken('x'), /ENCRYPTION_KEY/);
    assert.throws(() => decryptToken('v1:AAAA:BBBB:CCCC'), /ENCRYPTION_KEY/);
  });
});

describe('security wiring (static)', () => {
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const backupJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'backup.js'), 'utf8');
  const rotationJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'tokenRotation.js'), 'utf8');
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('encryption is wired at writes and reads, headers + routes mounted', () => {
    assert.match(authJs, /encryptToken\(accessToken\)/);
    assert.match(postsJs, /decryptToken\(r\.access_token\)/);
    assert.match(indexJs, /X-Content-Type-Options/);
    assert.match(indexJs, /api\/backup/);
    assert.match(indexJs, /api\/tokens/);
  });

  it('backup never exports secrets and import is insert-or-skip', () => {
    assert.match(backupJs, /Secrets are NOT included/);
    const socialLine = backupJs.split('\n').find((l) => l.includes('social_accounts:'));
    const customLine = backupJs.split('\n').find((l) => l.includes('custom_platforms:'));
    assert.ok(socialLine && !socialLine.includes('access_token') && !socialLine.includes('refresh_token'));
    assert.ok(customLine && !customLine.includes('api_key'));
    assert.match(backupJs, /ON CONFLICT \(id\) DO NOTHING/);
  });

  it('rotation covers refreshable platforms and refuses the rest', () => {
    assert.match(rotationJs, /exchangeForLongLivedToken/);
    assert.match(rotationJs, /rotation is not supported for/);
    assert.match(frontendJs, /Rotate token/);
    assert.match(frontendJs, /Backup & Restore/);
    assert.match(frontendJs, /api\/backup\/export/);
  });
});
