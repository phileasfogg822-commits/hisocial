// Phase 13: per-scope AI assignment tests.
// node:test only, no new dependency. Resolution and
// validation are pure; wiring checks are static, in the
// Phase 4–12 style. Live generation with assignments is
// an owner step, not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateAssignmentInput,
  resolveAiProvider,
} = require('../src/utils/aiAssignments');

const ROWS = [
  { scope_type: 'global', scope_key: 'global', task_kind: 'text', provider_id: 'gemini' },
  { scope_type: 'group', scope_key: 'g1', task_kind: 'text', provider_id: 'openai' },
  { scope_type: 'account', scope_key: 'a1', task_kind: 'text', provider_id: 'anthropic' },
  { scope_type: 'global', scope_key: 'global', task_kind: 'image', provider_id: 'openai' },
];

describe('resolution precedence', () => {
  const configured = new Set(['gemini', 'openai', 'anthropic']);

  it('account beats group beats global', () => {
    assert.equal(resolveAiProvider({ assignments: ROWS, taskKind: 'text', accountScopeKey: 'a1', groupScopeKey: 'g1', configuredIds: configured }), 'anthropic');
    assert.equal(resolveAiProvider({ assignments: ROWS, taskKind: 'text', groupScopeKey: 'g1', configuredIds: configured }), 'openai');
    assert.equal(resolveAiProvider({ assignments: ROWS, taskKind: 'text', configuredIds: configured }), 'gemini');
  });

  it('an explicit request wins outright, and no match returns null', () => {
    assert.equal(resolveAiProvider({ assignments: ROWS, taskKind: 'text', requested: 'grok', accountScopeKey: 'a1', configuredIds: configured }), 'grok');
    assert.equal(resolveAiProvider({ assignments: [], taskKind: 'text', configuredIds: configured }), null);
  });

  it('unconfigured assignments fall through instead of breaking generation', () => {
    assert.equal(resolveAiProvider({ assignments: ROWS, taskKind: 'text', accountScopeKey: 'a1', configuredIds: new Set(['gemini']) }), 'gemini');
  });

  it('Muse resolves so generation can refuse it plainly (Phase 12 rule)', () => {
    const rows = [{ scope_type: 'global', scope_key: 'global', task_kind: 'text', provider_id: 'muse' }];
    assert.equal(resolveAiProvider({ assignments: rows, taskKind: 'text', configuredIds: new Set(['muse']) }), 'muse');
  });

  it('kinds do not leak across text and image', () => {
    assert.equal(resolveAiProvider({ assignments: ROWS, taskKind: 'image', accountScopeKey: 'a1', configuredIds: configured }), 'openai');
  });
});

describe('assignment validation', () => {
  it('accepts valid assignments, including Muse', () => {
    assert.equal(validateAssignmentInput({ scope_type: 'global', task_kind: 'text', provider_id: 'muse' }).ok, true);
    assert.equal(validateAssignmentInput({ scope_type: 'group', scope_key: 'g1', task_kind: 'image', provider_id: 'openai' }).ok, true);
  });

  it('rejects bad scopes, kinds, unknown providers, and incapable providers', () => {
    assert.equal(validateAssignmentInput({ scope_type: 'team', task_kind: 'text', provider_id: 'gemini' }).ok, false);
    assert.equal(validateAssignmentInput({ scope_type: 'group', task_kind: 'text', provider_id: 'gemini' }).ok, false);
    assert.equal(validateAssignmentInput({ scope_type: 'global', task_kind: 'text', provider_id: 'nope' }).ok, false);
    assert.equal(validateAssignmentInput({ scope_type: 'global', task_kind: 'text', provider_id: 'deapi' }).ok, false);
    assert.equal(validateAssignmentInput({ scope_type: 'global', task_kind: 'image', provider_id: 'gemini' }).ok, false);
  });
});

describe('assignment wiring (static)', () => {
  const aiJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'ai.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('generate resolves assignments and keeps the Muse refusal', () => {
    assert.match(aiJs, /resolveAiProvider/);
    assert.match(aiJs, /resolvedProvider === 'muse'/);
    assert.match(aiJs, /\/assignments/);
    assert.match(aiJs, /assignment-options/);
  });

  it('table exists in init.sql and runMigrations', () => {
    assert.match(initSql, /CREATE TABLE IF NOT EXISTS ai_assignments/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS ai_assignments/);
  });

  it('settings manages assignments per scope', () => {
    assert.match(frontendJs, /AiAssignmentsSection/);
    assert.match(frontendJs, /api\/ai\/assignments/);
    assert.match(frontendJs, /api\/ai\/assignment-options/);
  });
});
