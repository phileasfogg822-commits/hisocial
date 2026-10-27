// Phase 15: generation language packs + formats.
//
// Before this phase /generate wrote English only, with
// one fixed output shape. A "pack" is a language plus a
// format: it tells the model what language and script to
// write in, and how the body should be shaped. Packs are
// prompt text only — they never change parsing: every
// format still returns HEADING / BODY / HASHTAGS
// separated by |||, so the existing parser keeps working.
//
// Urdu rule, stated plainly: Urdu output is written in
// the Urdu (Arabic) script itself. It is NOT romanized
// and NOT transliterated — transliteration was a TTS
// input trick on another project, and it has no place in
// generated post text.
const PACKS = {
  en: {
    id: 'en',
    name: 'English',
    languageInstruction: 'Write entirely in English.',
    hashtagNote: 'Hashtags in English, relevant to the topic.',
  },
  ur: {
    id: 'ur',
    name: 'Urdu',
    languageInstruction: 'Write entirely in Urdu, using the Urdu (Arabic) script. Do not write in Roman Urdu and do not transliterate.',
    hashtagNote: 'Hashtags may be in Urdu script or English, whichever fits the topic, each starting with #.',
  },
};

const FORMATS = {
  post: {
    id: 'post',
    name: 'Post',
    bodySpec: 'BODY should flow naturally and include the offer, value proposition, benefits, call-to-action',
  },
  caption: {
    id: 'caption',
    name: 'Caption',
    bodySpec: 'BODY is a short caption, not an article: one or two punchy sentences, at most 150 characters, written to sit under a photo or video',
  },
  script: {
    id: 'script',
    name: 'Script',
    bodySpec: 'BODY is a spoken video script: open with a single spoken hook line, then 3-5 beats, each on its own line starting with "Beat:", then close with a spoken call-to-action line',
  },
};

function getPack(language) {
  return PACKS[String(language || 'en').toLowerCase()] || null;
}

function getFormat(format) {
  return FORMATS[String(format || 'post').toLowerCase()] || null;
}

// Validate the request's language + format. Unknown
// values are a 400, not a silent fallback to English:
// silently ignoring a requested language would produce
// posts in the wrong language with no error.
function validateGenerationOptions({ language = 'en', format = 'post' } = {}) {
  if (!getPack(language)) {
    return { ok: false, error: `Unknown language: ${language}. Supported: ${Object.keys(PACKS).join(', ')}` };
  }
  if (!getFormat(format)) {
    return { ok: false, error: `Unknown format: ${format}. Supported: ${Object.keys(FORMATS).join(', ')}` };
  }
  return { ok: true, pack: getPack(language), formatSpec: getFormat(format) };
}

module.exports = { PACKS, FORMATS, getPack, getFormat, validateGenerationOptions };
