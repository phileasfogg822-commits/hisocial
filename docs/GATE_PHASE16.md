# Gate — Phase 16: Templates / style / duplicate detection

## Scope (from the agreed 0–29 roadmap, AI)

Phase 16 is the fifth and last AI item:
"templates/style/duplicate detection". It follows
Phase 15 (generation packs) and closes the AI
block (Phases 12–16).

Branch: `phase-16-templates-style-duplicates`,
cut from Phase 15 closed head `c7c8a30`. PR base:
`phase-15-generation-packs`.

## What Phase 16 adds

1. **Templates.** Table `ai_templates` (user-owned,
   unique by name) and CRUD at `/api/ai/templates`.
   A template saves a generation setup — tone,
   language, format, and style notes. Applying one
   in Compose fills tone, language, and format and
   loads the style notes; saving captures the
   current setup under a name. Templates are
   user-level, not per-group — group-level style
   belongs to later Scheduling work if wanted.
2. **Style.** Style notes are the style mechanism:
   one free-form voice instruction ("short
   sentences, no jargon, always end with a
   question") that travels into the prompt as a
   "Style guidance" line. `/generate` accepts
   `style_notes` (max 500 chars, else 400) and
   passes it through.
3. **Duplicate detection.** `utils/
   contentTemplates.js`: normalization (lowercase,
   hashtags dropped, punctuation stripped),
   Jaccard word-set similarity, threshold 0.8.
   `/generate` compares each generated body against
   earlier bodies in the same batch and against the
   user's 50 most recent posts, and returns a
   `duplicates` array (`post_index`, `match`:
   batch/history, `similarity`). Compose shows a
   near-duplicate warning naming the matches.
   Detection is flagging, NOT blocking: a
   near-duplicate the user actually wants (a repost,
   a series) must still be generatable.

## What Phase 16 deliberately does NOT do

- No template sharing between users, no per-group
  templates, no versioning — one flat user list.
- No automatic regeneration on duplicate detection
  — the user decides (regenerate or edit).
- No image duplicate detection — text bodies only.

## Local evidence

- `npm test` in `backend/`: **147 pass, 0 fail**
  (139 Phase 2–15 tests + 8 new Phase 16 tests:
  template validation ×2, duplicate detection ×3,
  wiring ×3).
- `node --check` passes on `ai.js` and
  `contentTemplates.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–15.

## NOT proven yet — honest limits

- Live generation with a template applied, and a
  real duplicate flag against post history, are NOT
  proven in GitHub-only dev (no provider keys, no
  post history in CI). Owner steps: save a
  template, apply it, generate, confirm the fields
  fill and the style shows; generate the same topic
  twice and confirm the warning appears.
- CI verdict on the Phase 16 head is pending at the
  time of this gate-doc write; Phase 16 is accepted
  ONLY on a green run on the exact head, including
  the new tests.

## CI verdict (added after the run)

- Run `40514159859` on head `65f7726` (the code
  head): **SUCCESS** — all steps green, including
  Test backend and the frontend Docker build.
  **Phase 16 ACCEPTED on `65f7726`.** Draft PR #16
  created and verified (the first creation attempt
  died on a runtime restart; the open-PR list was
  re-checked and the PR was created cleanly, no
  duplicate). The confirmatory run on this gate
  head follows the Phase 1–15 pattern.
