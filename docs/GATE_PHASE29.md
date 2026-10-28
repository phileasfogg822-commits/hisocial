# Gate — Phase 29: Final regression gate + docs

## Scope (from the agreed 0–29 roadmap)

Phase 29 is the final roadmap phase: a full
regression pass over Phases 0–28, a documentation
audit, and the handoff documents for the VPS
migration. It adds no new user features.

Branch: `phase-29-final-gate`, cut from Phase
28 closed head `2506a4d`. PR base:
`phase-28-security-backup-rotation`.

## What Phase 29 adds

1. **One real code change from the audit.**
   Rate limiting on auth routes: `express-
   rate-limit`, 300 attempts per 15 minutes per
   IP, applied to `/auth` only — enough to blunt
   credential stuffing, far above any human
   login/OAuth retry pattern. One new dependency
   (`express-rate-limit ^8.7.1`, lockfile updated
   surgically: 46 lines).
2. **An audit correction, not a feature.**
   Phase 28 added hand-rolled security headers,
   but this codebase already applies helmet (line
   51, `crossOriginEmbedderPolicy: false`) with
   defaults covering nosniff, same-origin
   framing, and no-referrer. The duplicate
   middleware is removed so there is one source
   of headers. Phase 28's "no CSP" reasoning is
   corrected in the code comment: helmet's
   default CSP applies to API JSON responses,
   and the frontend HTML is served by the
   frontend container, so it never governed the
   React app's inline styles. The Phase 28 test
   that asserted the hand-rolled headers is
   updated to assert helmet-once instead — a
   refactor accompaniment, not a weakening.
   (The npm install also bumped helmet ^7.0.0 →
   ^7.2.0; same major, kept.)
3. **`.env.example` completed.** The audit found
   the example listed only 33 variables while the
   code reads 58. The 25 missing variables are
   now documented with placeholders and one-line
   notes (platform app credentials, AI keys,
   infra, monitoring, cloudflared metrics). The
   file still must never be committed filled in.
4. **Handoff documents.**
   - `docs/ROADMAP_COMPLETE.md`: all 30 phases
     with heads, test counts, and the honest
     carryover list (see below).
   - `docs/VPS_MIGRATION.md`: the owner checklist
     for the final move — named tunnel, stable
     domain, fresh secrets (including
     ENCRYPTION_KEY, set once and never casually
     changed), re-OAuth on the VPS domain, and
     the live verification cycle per surface.
5. **README corrected.** The root README's clone
   URL still pointed at a different org
   (`hrperalglobalcity-spec`); it now points at
   `phileasfogg822-commits/hisocial`, and a
   roadmap-complete section points to the two
   handoff documents.

## Audit findings with no code change

- No TODO/FIXME/XXX markers remain in
  `backend/src` — the codebase carries no
  admitted-unfinished markers; the unfinished
  items live in gate docs and the carryover list
  instead, which is where they belong.
- Gate docs exist for every phase 1–29 (pinned
  by a new test; Phase 0's gate record lives in
  the instance template, as it always has).
- The full suite is the regression proof: every
  earlier phase's tests still run and pass.

## Carryovers (unchanged by this phase,
## carried into the migration document)

- Phase 2 has NO PR (known since Phase 2; the
  chain PRs #1, #3–#28 exist, so the chain has a
  gap if merges ever run in order — flagged in
  the migration document, not fixed unilaterally
  here).
- Posting account selection when several accounts
  exist on one platform is still undefined
  (Phase 4).
- Pinterest token refresh + video pins, readonly
  custom-platform fetch, editing awaiting-approval
  posts, Compose group/approval pickers, AI-path
  language stamping and video validation, and
  platform demographics are all still open as
  documented in their phase gate docs.
- Every live proof (platform connects, Muse
  worker cycle, scheduler/autopilot/snapshot/
  alert/report live cycles, first APK build) is
  an owner step at/after VPS migration — none is
  claimed by CI.

## Local evidence

- `npm test` in `backend/`: **212 pass, 0 fail**
  (209 Phase 2–28 tests + 3 new Phase 29 tests:
  helmet-once + auth limit, .env.example keys,
  gate docs 1–29; plus the updated Phase 28
  header assertion, which is a modification, not
  a new test).
- `node --check` passes on every touched backend
  file. Frontend compile is NOT proven locally;
  it is proven by the CI Docker build, as in
  Phases 1–28 (this phase touches no frontend
  logic, only README/docs).

## NOT proven yet — honest limits

- CI verdict on the Phase 29 head is pending at the
  time of this gate-doc write; Phase 29 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
- The VPS migration itself is NOT part of this
  phase and has not started: no tunnel, no domain,
  no live instance exists yet.

## CI verdict (added after the run)

- First head `8d014e1` FAILED twice at the same
  step ("Wait for services to be ready", backend
  never answering /health): push run #119
  attempt 2 and PR run #120 attempt 2, both
  failure. Two identical failures ruled out a
  flake.
- Root cause (found by audit, not by re-running):
  the Phase 29 `.env.example` completion wrote
  `DATABASE_URL` with password `socialhub`, but
  the compose Postgres service runs with
  `socialhub_secret` and the backend entry
  interpolates `${DATABASE_URL}` from that file.
  CI copies `.env.example` to `.env`, so the
  wrong password overrode the correct default —
  the backend failed database auth on every
  start and never became healthy. Unit tests
  never caught it (no database) and the Docker
  build passed (the image builds fine).
- Fix head `56615ad`: correct password with a
  comment tying it to `POSTGRES_PASSWORD`, plus
  the missing `INSTAGRAM_APP_SECRET` line. All
  other added values were verified against their
  compose defaults — this was the only mismatch.
- Push run #121 (`40750471977`) on `56615ad`:
  **SUCCESS**. PR run #122 (`40750484706`) on
  `56615ad`: **SUCCESS**. **Phase 29 ACCEPTED
  on `56615ad`.** The confirmatory run on this
  gate head follows the Phase 1–28 pattern.
