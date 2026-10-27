// Phase 16: generation templates + duplicate detection.
//
// A template is a saved generation setup: a tone, a
// language, a format, and free-form style notes (the
// voice instruction — e.g. "short sentences, no
// jargon, always end with a question"). Applying a
// template fills the Compose fields; the style notes
// travel into the prompt as one guidance line.
//
// Duplicate detection is flagging, not blocking: a
// generated post that closely matches an earlier post
// in the same batch, or one of the user's recent
// posts, is reported in the response so the user can
// regenerate or edit. Blocking would surprise — a
// near-duplicate the user actually wants (a repost,
// a series) must still be generatable.
const { validateGenerationOptions } = require('./languagePacks');

const DUPLICATE_THRESHOLD = 0.8;

function validateTemplateInput(input) {
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, error: 'Template name is required' };
  if (name.length > 80) return { ok: false, error: 'Template name is too long (max 80 chars)' };
  const tone = String(input.tone || '').trim();
  if (!tone || tone.length > 30) return { ok: false, error: 'Template tone is required (max 30 chars)' };
  const checked = validateGenerationOptions({ language: input.language || 'en', format: input.format || 'post' });
  if (!checked.ok) return checked;
  const styleNotes = String(input.style_notes || input.styleNotes || '').trim();
  if (styleNotes.length > 500) return { ok: false, error: 'Style notes are too long (max 500 chars)' };
  return {
    ok: true,
    template: {
      name,
      tone,
      language: checked.pack.id,
      format: checked.formatSpec.id,
      style_notes: styleNotes || null,
    },
  };
}

// Normalization for comparison: lowercase, hashtags
// dropped (they must not mask a duplicate body),
// punctuation stripped, whitespace collapsed.
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaccard similarity over word sets. Identical
// normalized text scores 1; empty-vs-empty scores 1
// (two empty posts are duplicates of each other).
function textSimilarity(a, b) {
  const wordsA = new Set(normalizeText(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / (wordsA.size + wordsB.size - shared);
}

// candidates: generated bodies (strings). existing:
// recent post contents (strings). Returns one entry
// per duplicate candidate, with the first match found
// (batch first, then history) and its similarity.
function findDuplicates({ candidates = [], existing = [], threshold = DUPLICATE_THRESHOLD } = {}) {
  const found = [];
  for (let i = 0; i < candidates.length; i += 1) {
    let match = null;
    for (let j = 0; j < i; j += 1) {
      const sim = textSimilarity(candidates[i], candidates[j]);
      if (sim >= threshold) { match = { match: 'batch', similarity: sim }; break; }
    }
    if (!match) {
      for (const old of existing) {
        const sim = textSimilarity(candidates[i], old);
        if (sim >= threshold) { match = { match: 'history', similarity: sim }; break; }
      }
    }
    if (match) found.push({ post_index: i, ...match });
  }
  return found;
}

module.exports = {
  DUPLICATE_THRESHOLD,
  validateTemplateInput,
  normalizeText,
  textSimilarity,
  findDuplicates,
};
