// Phase 16: templates + duplicate detection tests.
// node:test only, no new dependency. Template rules and
// similarity are pure; wiring checks are static, in the
// Phase 4–15 style. Live generation with templates is
// an owner step, not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateTemplateInput,
  normalizeText,
  textSimilarity,
  findDuplicates,
} = require('../src/utils/contentTemplates');

describe('template validation', () => {
  it('accepts a full template and defaults language/format', () => {
    const r = validateTemplateInput({ name: 'Punchy', tone: 'casual', style_notes: 'short sentences' });
    assert.equal(r.ok, true);
    assert.equal(r.template.language, 'en');
    assert.equal(r.template.format, 'post');
  });

  it('rejects missing names, long notes, and unknown languages', () => {
    assert.equal(validateTemplateInput({ tone: 'casual' }).ok, false);
    assert.equal(validateTemplateInput({ name: 'x', tone: 'casual', style_notes: 'y'.repeat(501) }).ok, false);
    assert.equal(validateTemplateInput({ name: 'x', tone: 'casual', language: 'fr' }).ok, false);
  });
});

describe('duplicate detection', () => {
  it('normalization drops hashtags and punctuation', () => {
    assert.equal(normalizeText('Hello, World! #growth'), 'hello world');
  });

  it('identical text scores 1, unrelated text scores low', () => {
    assert.equal(textSimilarity('the quick brown fox', 'the quick brown fox'), 1);
    assert.ok(textSimilarity('cats sleep all day', 'stocks rally on earnings') < 0.3);
  });

  it('flags batch duplicates and history matches, not fresh text', () => {
    const found = findDuplicates({
      candidates: ['fresh post about gardens', 'fresh post about gardens!', 'something entirely different'],
      existing: ['something entirely different indeed here'],
    });
    assert.equal(found.length, 1);
    assert.equal(found[0].post_index, 1);
    assert.equal(found[0].match, 'batch');
    const history = findDuplicates({
      candidates: ['our summer sale starts monday'],
      existing: ['our summer sale starts monday today'],
    });
    assert.equal(history.length, 1);
    assert.equal(history[0].match, 'history');
  });
});

describe('templates wiring (static)', () => {
  const aiJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'ai.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('templates CRUD, style notes, and duplicate flagging exist', () => {
    assert.match(aiJs, /\/templates/);
    assert.match(aiJs, /style_notes/);
    assert.match(aiJs, /findDuplicates/);
    assert.match(aiJs, /duplicates/);
  });

  it('table exists in init.sql and runMigrations', () => {
    assert.match(initSql, /CREATE TABLE IF NOT EXISTS ai_templates/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS ai_templates/);
  });

  it('compose manages templates and warns on duplicates', () => {
    assert.match(frontendJs, /api\/ai\/templates/);
    assert.match(frontendJs, /Save current setup as template/);
    assert.match(frontendJs, /Near-duplicate warning/);
  });
});
