// Phase 15: generation language packs + formats.
// node:test only, no new dependency. Pack rules are
// pure; wiring checks are static, in the Phase 4–14
// style. Live Urdu/English generation is an owner step
// (needs a configured provider), not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateGenerationOptions,
  getPack,
  getFormat,
} = require('../src/utils/languagePacks');

describe('pack validation', () => {
  it('accepts English and Urdu, post/caption/script', () => {
    assert.equal(validateGenerationOptions({ language: 'en', format: 'post' }).ok, true);
    assert.equal(validateGenerationOptions({ language: 'ur', format: 'script' }).ok, true);
    assert.equal(validateGenerationOptions({}).ok, true);
  });

  it('rejects unknown languages and formats instead of silently falling back', () => {
    assert.equal(validateGenerationOptions({ language: 'fr' }).ok, false);
    assert.equal(validateGenerationOptions({ format: 'story' }).ok, false);
  });

  it('Urdu pack requires Urdu script, never romanization', () => {
    const urdu = getPack('ur');
    assert.match(urdu.languageInstruction, /Urdu \(Arabic\) script/);
    assert.match(urdu.languageInstruction, /Do not write in Roman Urdu/);
  });

  it('formats shape the body differently', () => {
    assert.match(getFormat('caption').bodySpec, /at most 150 characters/);
    assert.match(getFormat('script').bodySpec, /Beat:/);
    assert.notEqual(getFormat('caption').bodySpec, getFormat('post').bodySpec);
  });
});

describe('generation wiring (static)', () => {
  const aiJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'ai.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('generate passes language + format into the prompt and echoes them', () => {
    assert.match(aiJs, /languageNote/);
    assert.match(aiJs, /formatSpec\.bodySpec/);
    assert.match(aiJs, /language, format \}/);
    assert.match(aiJs, /validateGenerationOptions/);
  });

  it('compose offers language and format, workflow offers language', () => {
    assert.match(frontendJs, /composeLanguage/);
    assert.match(frontendJs, /composeFormat/);
    assert.match(frontendJs, /value="ur">Urdu/);
    assert.match(frontendJs, /value="script">Script/);
  });
});
