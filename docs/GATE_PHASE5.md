# Gate — Phase 5: Developer onboarding wizard

## Scope (from the agreed 0–29 roadmap, Connections)

Phase 5 is the first Connections item: "developer
onboarding wizard". It follows Phase 4 (groups) and opens
the Connections group (5–11). The agreed decision it
implements: developer-account hassle should be minimized
(wizard, pre-generated redirect URLs, generated .env
validation) but cannot be fully automated — creating a
developer app and approving a consent screen stay owner
actions, and official posting cannot skip one developer
app per platform family.

Branch: `phase-5-onboarding-wizard`, cut from Phase 4
closed head `6a00377`. PR base: `phase-4-groups-multi-account`.

## The gap this phase closes

Before Phase 5, connecting a platform meant reading
`/api/platforms` (a bare `configured` boolean) and the
Settings connect buttons, with no guidance on what to
create, what URL to paste where, or which env var was
missing. A user facing "not configured" had nothing to
act on.

## What Phase 5 adds

1. Pure wizard data, `backend/src/utils/onboarding.js`:
   one spec per platform family (Facebook, Instagram,
   LinkedIn personal, LinkedIn company page, X, Reddit,
   Pinterest) with developer portal URL, product note,
   redirect-field note, and required env vars.
2. Redirect URI resolution that mirrors what the OAuth
   code itself uses: the platform's own `*_CALLBACK_URL`
   if set, then the code's existing fallbacks (Instagram
   falls back to the Facebook callback URL), then
   `PUBLIC_BACKEND_URL`, then the localhost default.
   The URI the wizard shows is the URI the code will
   actually use — a mismatch here is the classic reason
   a consent flow fails, so this is load-bearing.
3. Env-var checklist reporting only names and presence
   (set and not a `your_` placeholder). Values are never
   returned: a test asserts the wizard output contains
   neither a fake app id nor a fake secret.
4. API `GET /api/onboarding` (unauthenticated, like
   `/api/platforms` and `/auth/status`, which already
   expose the same presence level) returning all specs
   with redirect URIs, checklists, and configured flags.
5. Frontend "Setup Wizard" sidebar view: platform picker
   with configured badges, numbered steps (create app at
   the portal, paste the redirect URI with a copy button,
   set the env vars with a present/missing checklist,
   restart the backend, connect), and the existing
   Connect flow at the end — disabled with an
   explanation while variables are missing.

## What Phase 5 deliberately does NOT do

- It does not write `.env`, create a developer app, or
  approve a consent screen. Those stay owner actions by
  design; a wizard that pretended otherwise would be
  fabricating capability.
- It does not change any OAuth flow, scope, or token
  handling. The per-platform repair work (Meta refresh,
  LinkedIn company fix, YouTube, TikTok, X/Reddit/
  Pinterest repair) is Phases 6–10, not this one.
- It does not validate that a developer app actually
  exists at the portal — only that the local env vars
  are present. A wrong app id still fails at consent
  time, and the wizard says so by gating Connect on
  presence only.

## Local evidence

- `npm test` in `backend/`: **46 pass, 0 fail, 10 suites**
  (37 Phase 2–4 tests + 9 new Phase 5 tests: redirect
  resolution ×4, checklist ×1, specs ×4).
- `node --check` passes on `onboarding.js` (util and
  route) and `index.js`.
- Frontend compile is NOT proven locally; it is proven
  by the CI Docker build, as in Phases 1–4.

## NOT proven yet — honest limits

- Live OAuth against a real developer app is NOT proven
  by tests or CI (no developer app, credentials, or
  callback domain in GitHub-only dev). The wizard's
  steps are instructions for an owner step, not a
  tested integration.
- CI verdict on the Phase 5 head is pending at the time
  of this gate-doc write; Phase 5 is accepted ONLY on a
  green run on the exact head, including the new tests.
