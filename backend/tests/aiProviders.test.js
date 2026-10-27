// Phase 12: AI provider registry tests.
// node:test only, no new dependency. The registry is
// pure (env-injected); wiring checks are static, in the
// Phase 4–11 style. Live provider tests are owner steps,
// not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROVIDER_SPECS,
  isConfigured,
  listProviders,
  availableTextProviders,
  getProviderSpec,
} = require('../src/utils/aiProviders');

describe('registry completeness', () => {
  it('covers every known provider, with Muse preferred', () => {
    const ids = PROVIDER_SPECS.map((p) => p.id);
    for (const expected of ['muse', 'openai', 'gemini', 'bigmodel', 'alibaba', 'deapi', 'anthropic', 'grok']) {
      assert.ok(ids.includes(expected), `missing ${expected}`);
    }
    const muse = getProviderSpec('muse');
    assert.equal(muse.preferred, true);
    assert.equal(muse.hasText, true);
    assert.equal(muse.hasImage, true);
    assert.equal(muse.testKind, 'queue');
    assert.equal(muse.envVar, null);
  });

  it('image-only providers are marked image-manual, not text', () => {
    assert.equal(getProviderSpec('alibaba').testKind, 'image-manual');
    assert.equal(getProviderSpec('deapi').testKind, 'image-manual');
    assert.equal(getProviderSpec('alibaba').hasText, false);
  });
});

describe('presence and generation eligibility', () => {
  const env = {
    OPENAI_API_KEY: 'sk-real',
    GEMINI_API_KEY: 'your_gemini_key',
    GROK_API_KEY: '',
  };

  it('counts a real key as configured, placeholders and empties as not', () => {
    assert.equal(isConfigured(getProviderSpec('openai'), env), true);
    assert.equal(isConfigured(getProviderSpec('gemini'), env), false);
    assert.equal(isConfigured(getProviderSpec('grok'), env), false);
    assert.equal(isConfigured(getProviderSpec('muse'), env), false);
  });

  it('generation eligibility excludes Muse and unconfigured providers', () => {
    const available = availableTextProviders(env);
    assert.deepEqual(available.map((p) => p.id), ['openai']);
    assert.equal(listProviders(env).find((p) => p.id === 'muse').configured, false);
  });

  it('Alibaba name carries its region', () => {
    assert.equal(listProviders({ ALIBABA_REGION: 'london' }).find((p) => p.id === 'alibaba').name, 'Alibaba Wan2.7 (london)');
  });
});

describe('registry wiring (static)', () => {
  const aiJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'ai.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('ai.js uses the registry and records test status', () => {
    assert.match(aiJs, /utils\/aiProviders/);
    assert.match(aiJs, /recordTestStatus/);
    assert.match(aiJs, /ai_provider_tests/);
    assert.match(aiJs, /testKind === 'queue'/);
    assert.match(aiJs, /testKind === 'image-manual'/);
    assert.doesNotMatch(aiJs, /OPENAI_API_KEY.*startsWith\('your_'\)/);
  });

  it('test-status table exists in init.sql and runMigrations', () => {
    assert.match(initSql, /CREATE TABLE IF NOT EXISTS ai_provider_tests/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS ai_provider_tests/);
  });

  it('settings renders the registry with status, not a hardcoded short list', () => {
    assert.match(frontendJs, /lastTestStatus/);
    assert.match(frontendJs, /preferred/);
    assert.match(frontendJs, /task queue/);
  });
});
