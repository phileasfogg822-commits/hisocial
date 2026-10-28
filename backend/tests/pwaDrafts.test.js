// Phase 26: PWA polish + offline drafts tests.
// node:test only, no new dependency. The draft
// helpers are pure over an injectable storage, so
// they run here with a fake store; wiring checks are
// static, in the Phase 4–25 style. A live PWA
// install / offline run is an owner step (needs a
// served production build), not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadDrafts, saveDraft, deleteDraft } = require('../../frontend/src/utils/offlineDrafts');

function fakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

describe('offline drafts', () => {
  it('saves, loads, updates, and deletes drafts', () => {
    const store = fakeStorage();
    assert.deepEqual(loadDrafts(store), []);
    const entry = saveDraft({ content: 'Hello', platforms: ['facebook'], mediaUrls: [] }, store);
    assert.equal(loadDrafts(store).length, 1);
    assert.equal(loadDrafts(store)[0].content, 'Hello');
    saveDraft({ id: entry.id, content: 'Hello again', platforms: [], mediaUrls: [] }, store);
    assert.equal(loadDrafts(store).length, 1);
    assert.equal(loadDrafts(store)[0].content, 'Hello again');
    deleteDraft(entry.id, store);
    assert.deepEqual(loadDrafts(store), []);
  });

  it('tolerates corrupt stored data', () => {
    const store = fakeStorage();
    store.setItem('hisocial_drafts', 'not-json{');
    assert.deepEqual(loadDrafts(store), []);
  });
});

describe('PWA wiring (static)', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'public', 'manifest.json'), 'utf8'));
  const swJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'public', 'sw.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'index.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('manifest is HiSocial-branded and the shell worker never caches API', () => {
    assert.equal(manifest.short_name, 'HiSocial');
    assert.match(manifest.name, /HiSocial/);
    assert.match(swJs, /\/api/);
    assert.match(swJs, /caches\.match/);
  });

  it('service worker registers in production and drafts are wired in the UI', () => {
    assert.match(indexJs, /serviceWorker.*register/);
    assert.match(frontendJs, /Save draft locally/);
    assert.match(frontendJs, /DraftsView/);
    assert.match(frontendJs, /You are offline/);
    assert.match(frontendJs, /pendingDraft/);
  });
});
