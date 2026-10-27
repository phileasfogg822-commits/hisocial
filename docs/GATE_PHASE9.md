# Gate — Phase 9: TikTok

## Scope (from the agreed 0–29 roadmap, Connections)

Phase 9 is the fifth Connections item: "TikTok". It
follows Phase 8 (YouTube). Before this phase TikTok
had never been tested and had no routes at all.

Branch: `phase-9-tiktok`, cut from Phase 8 closed
head `3a57dfc`. PR base: `phase-8-youtube`.

## What Phase 9 adds

1. TikTok OAuth connect, `backend/src/routes/
   auth.js`: `/auth/tiktok` + `/auth/tiktok/callback`
   (Login Kit + Content Posting API, scopes
   `user.info.basic` + `video.publish` for direct
   post — `video.upload` would only reach the
   creator's inbox and is deliberately NOT requested).
   The callback fetches the creator (`user/info`)
   and stores one `social_accounts` row (platform
   `'tiktok'`, open_id, access + refresh tokens,
   expiry, scope). A re-connect never wipes an
   existing refresh token, as in Phase 8.
2. Direct-post upload, `backend/src/utils/tiktok.js`
   + `posts.js`: the post's first video URL is
   fetched server-side, init'd (`video/init` with
   post_info + FILE_UPLOAD source_info), uploaded in
   10 MB chunks with Content-Range headers, then
   polled (`status/fetch`) until PUBLISH_COMPLETE.
   Title is the post content capped at TikTok's 2200
   chars; privacy defaults to SELF_ONLY.
3. Refresh: both posting paths refresh an expired
   TikTok token before posting and persist the new
   token (and a rotated refresh token when TikTok
   returns one). This is mandatory, not polish:
   TikTok access tokens live only 24 hours.
4. Platform surface: TikTok added to `/api/platforms`
   (configured = client key present), to the frontend
   platform meta (icon + name), to `.env.example`
   (`TIKTOK_CLIENT_KEY/SECRET/CALLBACK_URL`), and to
   the Phase 5 onboarding wizard specs (portal, audit
   warning, exact-match redirect note).
5. Two older tests were updated for legitimate growth:
   the Phase 4 upsert count 8 → 9 (TikTok insert is
   the ninth site), and the Phase 5 "unknown platform"
   example changed from `tiktok` (now a real
   platform) to `snapchat`.

## What Phase 9 deliberately does NOT do

- No public posting by default: until the app passes
  TikTok's Content Posting audit, TikTok forces every
  post to SELF_ONLY anyway. A public default would be
  rejected for an unaudited app and would mislead the
  user about what will happen. Public posting is an
  owner audit step (2–6 weeks per TikTok's docs), not
  a code change.
- No PULL_FROM_URL: it needs a verified domain in the
  developer portal, so this phase uses FILE_UPLOAD.
- No photo posts, no inbox/draft flow, no duet/stitch
  toggles per post: video direct post only.
- No chunk retry: a failed chunk PUT fails the post
  visibly rather than resuming mid-upload (TikTok does
  not support resuming across sessions).

## Publishing status, stated plainly

If TikTok is still processing after ~2 minutes of
polling, the attempt is recorded as `'processing'`
with the publish_id — NOT as success. The record says
TikTok accepted the upload and is still processing
it, and warns against retrying before checking
TikTok, to avoid a duplicate. Claiming success at
that point would be fabrication; claiming failure
would be wrong too, since the video may complete.

## Local evidence

- `npm test` in `backend/`: **85 pass, 0 fail, 27 suites**
  (74 Phase 2–8 tests + 11 new Phase 9 tests: post
  info ×2, chunk planning ×1, token flows ×2, init/
  status ×3, wiring ×3).
- `node --check` passes on `tiktok.js`, `auth.js`,
  `posts.js`, and `platforms.js`.
- Frontend compile is NOT proven locally; it is proven
  by the CI Docker build, as in Phases 1–8.
- The Content Posting API flow (init → chunked PUT →
  status poll, 24-hour tokens, SELF_ONLY audit gate)
  was verified against TikTok's developer docs via
  web search before implementation, since the codebase
  had no prior TikTok reference to check against.

## NOT proven yet — honest limits

- A live TikTok connect and upload are NOT proven by
  tests or CI (no TikTok developer app, creator
  account, or credentials in GitHub-only dev). The
  owner step is: create the app, request video.publish,
  connect once, and post a video — expecting a private
  upload until audit passes.
- CI verdict on the Phase 9 head is pending at the time
  of this gate-doc write; Phase 9 is accepted ONLY on a
  green run on the exact head, including the new tests.

## CI verdict (added after the run)

- Run `40478637512` on head `41a0d15` (the code head):
  **SUCCESS** — all steps green, including Test backend
  and the frontend Docker build. **Phase 9 ACCEPTED on
  `41a0d15`.** Draft PR #9 created and verified. The
  confirmatory run on this gate head follows the
  Phase 1–8 pattern.
