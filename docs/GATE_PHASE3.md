# Gate — Phase 3: Google login, with local admin fallback

## Scope (from the agreed 0–29 roadmap, Foundations)

Phase 3 is the next Foundations item after Phase 2 (test
harness + CI gate): "add Google login with the local admin
login as fallback". The "stable domain + named tunnel"
Foundations item stays deferred to the final VPS migration
under the standing GitHub-only decision, and is NOT part of
this phase.

Branch: `phase-3-google-login`, cut from Phase 2 closed head
`74ca6b3`. PR base: `phase-2-test-harness` (the Lubric
chaining pattern). Phase 2's own draft PR still does not
exist (connector PR creation failed repeatedly); if PR #2
or a Phase 2 PR merges first, this PR's base can move —
that choice is the owner's, recorded here rather than
silently resolved.

## What Phase 3 adds

1. Google app-login, backend:
   - `backend/src/utils/googleLogin.js` (new, pure): config
     helper — configured only when both
     `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
     and are not `your_` placeholders; callback URL from
     `GOOGLE_CALLBACK_URL` or the localhost default;
     scopes are identity only: `['profile', 'email']`.
   - `backend/src/passport.js`: registers the `google`
     strategy (passport-google-oauth20) ONLY when
     configured, reusing the existing `findOrCreateUser` /
     `linkAccount` helpers. A checkout without Google
     credentials boots exactly as before.
   - `backend/src/routes/auth.js`: `GET /auth/google` and
     `GET /auth/google/callback`, deliberately NOT behind
     `requireAppProfile` (this IS the app login — requiring
     an app login first would be a chicken-and-egg).
     On success, the existing `finishOAuth` logs the user
     in and sets `appAuthenticated`. If Google is not
     configured, the start route redirects with
     `?error=google_not_configured` instead of calling
     passport on an unregistered strategy. `/auth/status`
     now reports `google` configuration.
2. Local admin fallback, untouched: `POST /api/user/login`
   (env username/password) and account switching in
   `routes/accounts.js` are unchanged. A static parity test
   guards the fallback against accidental removal.
3. Frontend: the login gate (`LoginGate` in `App.js`) now
   shows "Continue with Google" first (Google-first, as
   decided), with a note that Google sign-in needs backend
   credentials, then the unchanged local login form.
4. Config: `.env.example` gains `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET` (placeholders) and
   `GOOGLE_CALLBACK_URL`.
5. Dependency: `passport-google-oauth20@2.0.0` added to
   `backend/package.json`, lockfile regenerated
   (`+13 lines`, no new transitive packages — oauth and
   friends were already in the lock via the other passport
   strategies). Temp-copy `npm ci --ignore-scripts`
   succeeded and installed passport-google-oauth20 2.0.0.

## What Phase 3 deliberately does NOT do

- It does NOT grant YouTube upload or any other Google API
  scope. Google login here is identity only. A test asserts
  no scope contains 'youtube'. YouTube is a later
  Connections phase with its own scope decision.
- It does NOT log the user into Facebook, Instagram,
  LinkedIn, or TikTok. Each platform still needs its own
  OAuth consent, as established in Phase 0 decisions.
- It does NOT change the seeded-profile / account-switch
  flow: after Google login, the user still picks an
  internal profile, exactly as after local login (Google's
  own user row is created/linked by email via
  `findOrCreateUser`, so the Google identity appears as an
  app account).

## Local evidence

- `npm test` in `backend/`: **28 pass, 0 fail, 5 suites**
  (20 Phase 2 tests + 8 new Phase 3 tests: 4 config, 4
  wiring parity). Node v24.22.1 in the Muse VM; CI runs
  Node 20, using only stable `node:test` APIs.
- `node --check` passes on `googleLogin.js`, `passport.js`,
  and `auth.js`.
- Frontend compile is NOT proven locally (no frontend
  install in the Muse VM); it is proven by the CI Docker
  build, as in Phases 1–2.

## NOT proven yet — honest limits

- Live Google OAuth is NOT proven: no Google Cloud project,
  no real client id/secret, no stable callback domain, and
  no consent-screen approval exist in this GitHub-only
  phase. The routes, strategy registration guard, and
  config logic are tested; a real Google sign-in is an
  owner step (create the Google Cloud OAuth app, set the
  callback URL for the VPS domain, sign in once) and must
  be proven in the final VPS migration, not claimed here.
- CI verdict on the Phase 3 head is pending at the time of
  this gate-doc write; Phase 3 is accepted ONLY on a green
  run on the exact head, including the new tests.
