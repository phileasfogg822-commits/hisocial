// Phase 26: offline drafts (localStorage only).
//
// Drafts live in the browser, never on the server:
// they are the offline story. When the network is
// down, the user can still write and keep a post;
// when it returns, they load the draft into Compose
// and post normally. No sync, no conflict
// resolution — a draft is a local snapshot, and
// loading one overwrites the current compose fields.
//
// Storage is injectable so the helpers are testable
// without a browser: pass a fake {getItem, setItem,
// removeItem} in tests; in the app the default is
// window.localStorage.
const DRAFTS_KEY = 'hisocial_drafts';

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

function loadDrafts(storage) {
  const store = getStorage(storage);
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(DRAFTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDraft(draft, storage) {
  const store = getStorage(storage);
  const drafts = loadDrafts(store);
  const entry = {
    id: draft.id || `draft-${Date.now()}`,
    content: draft.content || '',
    heading: draft.heading || '',
    hashtags: draft.hashtags || '',
    platforms: Array.isArray(draft.platforms) ? draft.platforms : [],
    mediaUrls: Array.isArray(draft.mediaUrls) ? draft.mediaUrls : [],
    language: draft.language || 'en',
    format: draft.format || 'post',
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const existing = drafts.findIndex((d) => d.id === entry.id);
  if (existing >= 0) drafts[existing] = entry;
  else drafts.unshift(entry);
  if (store) store.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  return entry;
}

function deleteDraft(id, storage) {
  const store = getStorage(storage);
  const drafts = loadDrafts(store).filter((d) => d.id !== id);
  if (store) store.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  return drafts;
}

module.exports = { DRAFTS_KEY, loadDrafts, saveDraft, deleteDraft };
