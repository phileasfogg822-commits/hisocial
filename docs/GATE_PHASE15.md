# Gate — Phase 15: Text / caption / script generation (English + Urdu packs)

## Scope (from the agreed 0–29 roadmap, AI)

Phase 15 is the fourth AI item: "text/caption/
script generation (English + Urdu packs)". It
follows Phase 14 (Muse queue) and makes the AI
block useful for actual posts. Before this phase
`/generate` wrote English only, in one fixed shape.

Branch: `phase-15-generation-packs`, cut from
Phase 14 closed head `452db65`. PR base:
`phase-14-muse-queue`.

## What Phase 15 adds

1. **Language packs.** `utils/languagePacks.js`:
   `en` and `ur`. The pack's language instruction
   is injected into the generation prompt, and its
   hashtag note adjusts hashtag guidance. Unknown
   languages are a 400, not a silent fallback to
   English — silently ignoring a requested language
   would produce posts in the wrong language with
   no error.
2. **Urdu rule, stated plainly.** Urdu output is
   written in the Urdu (Arabic) script itself. It
   is NOT romanized and NOT transliterated —
   transliteration was a TTS input trick on another
   project, and it has no place in generated post
   text. The pack's instruction says so explicitly.
3. **Formats.** `post` (existing shape), `caption`
   (short caption, at most 150 characters, for
   sitting under a photo or video), and `script`
   (spoken video script: hook line, 3–5 beats each
   starting with "Beat:", closing CTA line).
   Formats are prompt text only — every format
   still returns HEADING / BODY / HASHTAGS
   separated by `|||`, so the existing parser keeps
   working with no change.
4. **Wiring.** `/generate` accepts `language` +
   `format`, validates them, passes them to
   `generatePosts`, and echoes them in the
   response. Compose's single-post area gains
   language + format selects (scripts get a larger
   1500-character budget); the workflow area gains
   a language select and passes it for bulk posts.
   Assignment resolution is unchanged: caption and
   script are text-kind work.

## What Phase 15 deliberately does NOT do

- No template/style system (Phase 16) — packs are
  language + shape, not saved templates.
- No translation of existing posts: packs apply at
  generation time only.
- No per-platform caption-length enforcement beyond
  the caption guidance — platform limits at publish
  time are unchanged.

## Local evidence

- `npm test` in `backend/`: **139 pass, 0 fail**
  (133 Phase 2–14 tests + 6 new Phase 15 tests:
  pack validation ×4, wiring ×2).
- `node --check` passes on `ai.js` and
  `languagePacks.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–14.

## NOT proven yet — honest limits

- Live generation in Urdu or as a caption/script
  is NOT proven in GitHub-only dev (no provider
  keys in CI). Owner steps: configure one text
  provider, generate once per language and once per
  format, confirm the language, script, and shape.
- CI verdict on the Phase 15 head is pending at the
  time of this gate-doc write; Phase 15 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
