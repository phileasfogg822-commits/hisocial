# Gate — Phase 6: Meta FB + IG repair / refresh

## Scope (from the agreed 0–29 roadmap, Connections)

Phase 6 is the second Connections item: "Meta FB + IG
repair / refresh". It follows Phase 5 (onboarding wizard).

Branch: `phase-6-meta-repair-refresh`, cut from Phase 5
closed head `98caaf9`. PR base: `phase-5-onboarding-wizard`.

## The defect this phase fixes

Facebook and Instagram connections stored the SHORT-lived
token from the OAuth callback as-is, with no expiry
recorded. A short-lived user token lasts hours, so a
connection that worked at setup silently broke
afterwards, and nothing could tell the user why or fix
it. Instagram page tokens were fetched from that
short-lived user token, so they inherited the same
short life.

## What Phase 6 adds

1. Long-lived exchange on connect, `backend/src/utils/
   metaTokens.js` (injectable HTTP, unit-tested without
   Meta): `GET /oauth/access_token?grant_type=
   fb_exchange_token` turns a short-lived user token
   into a long-lived one (~60 days). Page tokens derived
   from a long-lived user token do not expire.
2. Wired into both connect paths, best-effort:
   - Facebook (passport verify): exchange before
     storing; on exchange failure the short-lived token
     is stored as before rather than failing the connect.
   - Instagram callback: exchange BEFORE `/me/accounts`,
     so the page tokens fetched are long-lived; the
     expiry is carried through the multi-account pending
     map into the confirm insert too.
   - `linkAccount` gained an optional `tokenExpiry`
     parameter and now stores `token_expires_at`; both
     Instagram inserts store it as well.
3. Token health, pure and honest: `tokenStatus` returns
   ok / expiring_soon (under 7 days) / expired /
   unknown. Connections made before Phase 6 have no
   recorded expiry and report unknown — never a guessed
   date.
4. API `GET /api/meta/status` (current profile's
   Facebook + Instagram connections, health + expiry,
   never a token value) and `POST /api/meta/refresh`
   (Facebook only: re-exchange the stored user token,
   which resets the ~60-day clock; healthy tokens are
   left alone).
5. Frontend "Meta Token Health" block in Settings:
   health per connection, a Refresh button for
   Facebook, and a Reconnect button for Instagram when
   it is expired or unknown.

## What Phase 6 deliberately does NOT do

- Instagram page tokens cannot be refreshed by API —
  they are not user tokens. The refresh endpoint says
  so and reports `needs_reconnect` instead of
  pretending. An already-expired Facebook token also
  cannot be exchanged; that case reports
  `needs_reconnect` too.
- No token encryption: tokens are still stored as the
  original code stored them. Encryption / rotation is
  Phase 28 (security hardening), not smuggled in here.
- No change to posting logic, scopes, or the Facebook
  page picker. Refresh only fixes token life.

## Local evidence

- `npm test` in `backend/`: **54 pass, 0 fail, 13 suites**
  (46 Phase 2–5 tests + 8 new Phase 6 tests: exchange
  ×2, health ×2, wiring ×4).
- `node --check` passes on `metaTokens.js`, `meta.js`,
  `index.js`, `passport.js`, and `auth.js`.
- Frontend compile is NOT proven locally; it is proven
  by the CI Docker build, as in Phases 1–5.

## NOT proven yet — honest limits

- A live exchange against Meta is NOT proven by tests
  or CI (no developer app or credentials in GitHub-only
  dev). The exchange code path runs only when a real
  user connects with a real app; the owner step is to
  reconnect Facebook/Instagram once and confirm the
  health block shows a ~60-day expiry.
- Pre-Phase-6 connections keep reporting unknown until
  they are reconnected — that is by design, not a bug
  to fix by backfilling invented expiries.
- CI verdict on the Phase 6 head is pending at the time
  of this gate-doc write; Phase 6 is accepted ONLY on a
  green run on the exact head, including the new tests.

## CI verdict (added after the run)

- Run `40454712107` on head `2262e60` (the code head):
  **SUCCESS** — all steps green, including Test backend
  and the frontend Docker build. **Phase 6 ACCEPTED on
  `2262e60`.** Draft PR #6 created and verified (the
  original watch was killed by a runtime restart; the
  verdict was re-read directly from the API, as in
  Phase 2). The confirmatory run on this gate head
  follows the Phase 1–5 pattern.
