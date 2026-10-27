# Gate — Phase 8: YouTube

## Scope (from the agreed 0–29 roadmap, Connections)

Phase 8 is the fourth Connections item: "YouTube". It
follows Phase 7 (LinkedIn fix). Before this phase
there were NO YouTube routes at all, and YouTube had
never been tested — while Phase 3 deliberately kept
the Google app login to identity scopes only, with a
note that YouTube upload needs a separate scope in
this phase.

Branch: `phase-8-youtube`, cut from Phase 7 closed
head `8110e12`. PR base: `phase-7-linkedin-fix`.

## What Phase 8 adds

1. A SEPARATE YouTube consent, `backend/src/routes/
   auth.js`: `/auth/youtube` + `/auth/youtube/callback`,
   using the same Google Cloud project and credentials
   as the app login but requesting `youtube.upload` +
   `youtube.readonly` — never added to the app-login
   scopes. `access_type=offline` + `prompt=consent`
   are load-bearing: without them Google may not
   return a refresh token. The callback fetches the
   channel (`channels?mine=true`) and stores one
   `social_accounts` row (platform `'youtube'`,
   channel id, access + refresh tokens, expiry,
   scope). A re-connect never wipes an existing refresh
   token: the upsert keeps the stored one when Google
   omits a new one.
2. Upload, `backend/src/utils/youtube.js` + `posts.js`:
   the post's first video URL is fetched server-side
   and uploaded via the YouTube Data API v3 resumable
   protocol (plain HTTP, no new dependency). Title is
   the post's first line (capped at YouTube's 100
   chars), description is the post content (capped at
   5000), privacy defaults to `'private'`.
3. Refresh: both posting paths (immediate and
   scheduled) refresh an expired YouTube token via the
   stored refresh token before posting, and persist
   the new token + expiry. Refresh failure keeps the
   old token and the upload fails visibly.
4. Platform surface: YouTube added to `/api/platforms`
   (configured = Google credentials present), to the
   frontend platform meta (icon + name, so compose
   and settings render it), to `.env.example`
   (`YOUTUBE_CALLBACK_URL`), and to the Phase 5
   onboarding wizard specs (Cloud Console, API enable
   + scopes + channel prerequisite notes).
5. The Phase 4 upsert-count test was updated 7 → 8:
   the YouTube insert is a legitimate eighth site
   using the new conflict target, not a regression.

## What Phase 8 deliberately does NOT do

- No public/unlisted choice per post: privacy is
  always private for now. An upload the user did not
  explicitly publish must not go public by accident;
  per-post privacy is later work.
- No Shorts-specific handling, no thumbnail upload,
  no playlist assignment, no analytics: upload only.
- No video file upload endpoint: the video must
  already be at a fetchable URL in the post's media
  URLs. A post with no video URL fails with a plain
  message, not a silent skip.
- Google app login scopes are UNCHANGED (profile +
  email). A Google app login does not connect YouTube.

## Local evidence

- `npm test` in `backend/`: **74 pass, 0 fail, 22 suites**
  (62 Phase 2–7 tests + 12 new Phase 8 tests:
  metadata ×2, URL picking ×2, scopes ×1, token
  flows ×2, resumable upload ×2, wiring ×3).
- `node --check` passes on `youtube.js`, `auth.js`,
  `posts.js`, and `platforms.js`.
- Frontend compile is NOT proven locally; it is proven
  by the CI Docker build, as in Phases 1–7.

## NOT proven yet — honest limits

- A live YouTube connect and upload are NOT proven by
  tests or CI (no Google Cloud app, channel, or
  credentials in GitHub-only dev). The owner step is:
  enable YouTube Data API v3 in the same project,
  connect YouTube once, confirm the channel appears,
  and post a video — expecting a private upload.
- Large-video uploads (multi-GB) are untested: the
  resumable session is created, but chunked retry
  on a dropped connection is not implemented — a
  failed PUT fails the post visibly rather than
  resuming.
- CI verdict on the Phase 8 head is pending at the time
  of this gate-doc write; Phase 8 is accepted ONLY on a
  green run on the exact head, including the new tests.
