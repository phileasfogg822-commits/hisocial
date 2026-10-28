# Gate — Phase 27: APK client

## Scope (from the agreed 0–29 roadmap,
## Clients/hardening)

Phase 27 is the second Clients/hardening item:
the Android client, using the same backend as
the PWA.

Branch: `phase-27-apk-client`, cut from Phase
26 closed head `044e5ce`. PR base:
`phase-26-pwa-offline-drafts`.

## What Phase 27 adds

1. **The Android project (`android/`).** A
   WebView shell, not a second app: applicationId
   `com.hisocial.app`, version 1.0.0, minSdk 24,
   targetSdk 34. MainActivity enables JavaScript
   + DOM storage (the web app needs both),
   supports file picking for media uploads,
   navigates back inside the WebView, and hands
   off-site links to the system browser. The
   backend URL is a buildConfigField
   (`HISOCIAL_BASE_URL`, defaulting to the
   emulator address `http://10.0.2.2:4000`).
2. **Backend handshake.** `GET /api/client/info`
   (unauthenticated, no user data): app name,
   backend version from `package.json`, minimum
   client version, API version, and the feature
   list — so a future shell can show a
   compatibility notice instead of failing
   against an old backend.
3. **Docs.** `docs/APK_CLIENT.md`: what the shell
   is, how to build it in Android Studio, what to
   change at VPS migration (the URL), and what is
   not claimed.

## What Phase 27 deliberately does NOT do

- **No built APK is delivered.** CI has no
  Android SDK (Docker + tests only), so no APK
  is compiled or verified here. The project
  source is the deliverable; the first real APK
  comes from an Android Studio build, an owner
  step. Claiming otherwise would be fabrication.
- No native features: no push, no camera capture
  beyond file picking, no biometric login, no
  offline queue beyond Phase 26 drafts.
- No Play Store listing, no signing key (never
  committed), no production URL baked in, no
  branded launcher icon yet (placeholder system
  icon in the manifest, flagged in the docs).

## Local evidence

- `npm test` in `backend/`: **203 pass, 0 fail**
  (200 Phase 2–26 tests + 3 new Phase 27 tests:
  handshake ×1, project wiring ×2).
- `node --check` passes on `client.js` and
  `index.js`. Kotlin/Gradle are NOT compiled
  here — no Android SDK in this environment —
  and are proven only by the Android Studio
  import, an owner step.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–26
  (this phase touches no frontend code).

## NOT proven yet — honest limits

- An Android Studio import + debug APK build is
  NOT proven (owner step with the SDK).
- CI verdict on the Phase 27 head is pending at the
  time of this gate-doc write; Phase 27 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
