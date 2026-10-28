# Gate — Phase 26: PWA polish + offline drafts

## Scope (from the agreed 0–29 roadmap,
## Clients/hardening)

Phase 26 is the first Clients/hardening item. It
opens the final block (Phases 26–29).

Branch: `phase-26-pwa-offline-drafts`, cut from
Phase 25 closed head `714636c`. PR base:
`phase-25-weekly-report`.

## What Phase 26 adds

1. **PWA polish.** The manifest is rebranded
   from the leftover "SocialHub" name to
   HiSocial, with a description. A service worker
   (`public/sw.js`) caches the app shell (index
   + manifest) so the app opens offline; it never
   caches API responses — a stale /api answer is
   worse than an offline error. Registration in
   `index.js` runs in production only and fails
   silently on insecure origins.
2. **Offline drafts.** `utils/offlineDrafts.js`
   (localStorage, injectable storage for tests):
   save / load / delete. Compose gains a "Save
   draft locally" button next to Post/Schedule;
   a 🗒️ Drafts view lists drafts with Load into
   Compose (which fills content, heading,
   hashtags, platforms, media, language, format)
   and Delete. An offline banner appears above
   the nav while `navigator.onLine` is false.
3. **Honest boundaries, stated in the UI.**
   Drafts live in this browser only — never sent
   to the server, not synced to another device.
   The service worker caches the shell, not the
   data.

## What Phase 26 deliberately does NOT do

- No background sync, no push notifications, no
  offline posting queue: a draft loaded into
  Compose posts normally once back online. An
  offline queue would need conflict handling and
  is not claimed.
- No server-side draft storage or cross-device
  sync (a backup/restore concern, Phase 28
  territory, not this phase).
- No install-prompt customization: the browser's
  own install flow is untouched.

## Local evidence

- `npm test` in `backend/`: **200 pass, 0 fail**
  (196 Phase 2–25 tests + 4 new Phase 26 tests:
  draft helpers ×2, PWA wiring ×2).
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–25.
  (App.js JSX cannot be `node --check`ed; the
  build is the proof.)

## NOT proven yet — honest limits

- A live PWA install and offline run are NOT
  proven in GitHub-only dev (no served production
  build in CI). Owner steps: serve the production
  build over HTTPS, install the app, go offline,
  confirm the shell opens, save a draft, reload,
  load it into Compose, and post once back online.
- CI verdict on the Phase 26 head is pending at the
  time of this gate-doc write; Phase 26 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
