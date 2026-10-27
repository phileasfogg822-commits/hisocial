# Gate — Phase 10: X / Reddit / Pinterest repair

## Scope (from the agreed 0–29 roadmap, Connections)

Phase 10 is the last of the Connections items before
the AI phases: "X/Reddit/Pinterest repair". It
follows Phase 9 (TikTok). These three platforms had
working connects but posting defects that silently
misdirected or dropped content.

Branch: `phase-10-xrp-repair`, cut from Phase 9
closed head `1fb0669`. PR base: `phase-9-tiktok`.

## What Phase 10 fixes

1. **X dropped all media.** `postToTwitter` never
   looked at `mediaUrls`, so every image/video
   attached to an X post was silently discarded.
   Media is now uploaded first (up to 4 images, or a
   single video) and attached to the tweet; text over
   280 chars fails visibly with the limit named,
   instead of failing at the API with a cryptic
   error.
2. **Reddit posted to r/test.** `postToReddit`
   hardcoded `sr: 'test'` with a comment admitting
   users "should configure this" — but there was
   nothing to configure. A subreddit is now required
   per post: stored on the post (`posts.reddit_
   subreddit`, in `init.sql` + `runMigrations`
   ALTERs), entered in Compose (r/ input), validated
   server-side on create and on scheduled-post edit
   (400 on a bad value), and validated again at
   publish time. Without a valid subreddit the
   attempt fails visibly — it never falls back to
   any default subreddit.
3. **Reddit tokens expired after 1 hour.** Posting
   never refreshed Reddit tokens. Refresh is now
   wired into both posting paths (permanent refresh
   token, 1-hour access token); pre-Phase-10 rows
   never stored an expiry, so missing expiry
   refreshes once and then stores one. On failure
   the old token is kept and the attempt fails
   visibly.
4. **Pinterest always used the first board.** A
   board is now selectable per post in Compose
   (radio list from new `GET /api/pinterest/boards`,
   which returns id + name only, never tokens),
   stored on the post (`posts.pinterest_board_id`),
   and used at publish time. The first board remains
   only as a documented fallback when none is
   chosen. Video URLs fail visibly: video pins need
   a different media_source flow, and sending one as
   image_url would fail confusingly at the API.
   Descriptions are capped at Pinterest's 800 chars.
5. Reddit's User-Agent is now `HiSocial/1.0`
   (was the pre-rename `SocialHub/1.0`) on all four
   Reddit call sites.

## What Phase 10 deliberately does NOT do

- No Pinterest video-pin upload flow and no
  Pinterest token refresh (its token lifecycle was
  not verified from docs in this phase; guessing
  would be worse than documenting the gap).
- No CalendarView edit UI for the new fields:
  Compose carries them and scheduled-post edits
  keep them, but the calendar edit form does not
  yet expose subreddit/board inputs.
- The AI-generation post path does not carry the
  new fields (it carries no target fields at all —
  same as Facebook pages / LinkedIn targets), so an
  AI-generated Reddit post fails visibly at publish
  with the subreddit error instead of silently
  landing in r/test. That is strictly better than
  before, and wiring AI targets is later work.
- No live posting is proven by CI (no X/Reddit/
  Pinterest credentials in GitHub-only dev).

## Local evidence

- `npm test` in `backend/`: **96 pass, 0 fail, 31
  suites** (85 Phase 2–9 tests + 11 new Phase 10
  tests: X length ×1, subreddit validation ×2,
  submit payload ×1, Reddit refresh ×1, Pinterest
  helpers ×2, wiring ×4).
- `node --check` passes on `posts.js`,
  `pinterest.js`, `xrp.js`, and `index.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–9.

## Fixes found by CI on the first heads (added after the runs)

- **First head `79772b4`: CI failed in "Wait for
  services to be ready".** The new `routes/
  pinterest.js` required `../middleware/auth`, a
  module that does not exist — this codebase defines
  `requireProfile` locally in each route. The backend
  crashed at startup and never became healthy. Fixed
  on `9ebdae2` (local guard like meta.js) plus a
  regression test asserting every relative require in
  backend routes resolves to a real file.
- **That regression test then exposed a latent
  defect from Phases 7–9:** `routes/posts.js`
  required `./utils/...` from inside `src/routes/`,
  which resolves to a nonexistent `routes/utils/`
  directory. The requires are lazy (inside posting
  functions), so CI — which never posts live — never
  executed them, and every real LinkedIn/YouTube/
  TikTok/XRP posting attempt would have crashed with
  MODULE_NOT_FOUND. All 15 sites in `posts.js` were
  corrected to `../utils/` on the fix head.
  (`passport.js` sits at `src/`, so its `./utils/`
  paths were already correct.)

## NOT proven yet — honest limits

- Live X media upload, Reddit subreddit posting,
  and Pinterest board pinning are NOT proven in
  GitHub-only dev. Owner steps: post an image to X,
  post to a chosen subreddit, pin to a chosen board
  — each should land where chosen, and a Reddit post
  with no subreddit should fail visibly.
- CI verdict on the Phase 10 head is pending at the
  time of this gate-doc write; Phase 10 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
