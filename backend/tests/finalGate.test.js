// Phase 29: final regression gate tests.
// node:test only. The full suite (Phases 2–28) is
// the regression proof; these tests pin the Phase 29
// changes and the audit's headline findings: one
// source of security headers, a rate limit on auth,
// and a complete .env.example.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('final gate wiring (static)', () => {
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const exampleEnv = fs.readFileSync(path.join(__dirname, '..', '..', '.env.example'), 'utf8');

  it('helmet is applied exactly once and auth is rate-limited', () => {
    const helmetUses = (indexJs.match(/app\.use\(helmet\(/g) || []).length;
    assert.equal(helmetUses, 1);
    assert.match(indexJs, /app\.use\('\/auth', authLimiter\)/);
    assert.match(indexJs, /max: 300/);
    // No hand-rolled duplicate header middleware remains.
    assert.doesNotMatch(indexJs, /X-Content-Type-Options/);
  });

  it('.env.example documents the security and platform keys', () => {
    for (const key of ['ENCRYPTION_KEY', 'FACEBOOK_APP_ID', 'REDDIT_CLIENT_ID', 'PINTEREST_APP_ID', 'OPENAI_API_KEY', 'MUSE_BRIDGE_TOKEN', 'DATABASE_URL', 'REDIS_URL']) {
      assert.ok(exampleEnv.includes(`${key}=`), `missing ${key}`);
    }
  });

  it('every phase gate doc exists', () => {
    for (let n = 1; n <= 29; n++) {
      const p = path.join(__dirname, '..', '..', 'docs', `GATE_PHASE${n}.md`);
      assert.ok(fs.existsSync(p), `missing GATE_PHASE${n}.md`);
    }
  });
});
