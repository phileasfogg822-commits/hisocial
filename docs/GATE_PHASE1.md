# Gate — Phase 1: Fix broken base and CI (GitHub-only)

Branch: `phase-1-fix-broken-base`, cut from `main` at `0efa4c6`.
Scope: the four defects that made the repo's own CI red, plus the
`.gitignore` defects that hid them. No new features, no VPS work, no
change to app behaviour except the one duplicate-route removal below
(which preserves the live handler).

## 1.1 CI Node / lockfile — FIXED (root cause, not just the symptom)

- Before: CI failed at `Set up Node.js` on PR #1 (run `40400125785`),
  every later step skipped. Two causes, both found:
  1. `setup-node` used `cache: "npm"` but the repo has no root
     lockfile (locks live in `backend/` and `frontend/`), so the
     cache step itself failed.
  2. `.gitignore` ignored `package-lock.json` globally, so lockfiles
     could never be committed — and CI's `npm ci` requires them.
- Fix: removed the cache line from `.github/workflows/ci.yml`
  (with a comment explaining why), removed `package-lock.json`
  from `.gitignore`, and committed freshly generated lockfiles:
  `backend/package-lock.json` (lockfileVersion 3, 354 packages,
  includes `twitter-api-v2@1.31.0`) and `frontend/package-lock.json`
  (lockfileVersion 3, 1315 packages). Local check: backend
  `npm ci --dry-run` succeeds (353 packages); frontend lock was
  generated from the same `package.json` by `npm install
  --package-lock-only` (its `npm ci --dry-run` flag is not supported
  by npm 10, so that check was not used as evidence).

## 1.2 `backend/init.sql` — CREATED (reconstructed, not copied)

- Before: `docker-compose.yml` mounted `./backend/init.sql` into
  Postgres, but the file did not exist in the repo.
- Fix: `backend/init.sql` now creates 8 tables the backend never
  creates itself: `users`, `social_accounts`, `posts`,
  `platform_posts`, `sessions`, `ai_creative_sessions`,
  `ai_phase_logs`, `ai_generated_content`, plus
  `CREATE EXTENSION pgcrypto` (required: `runMigrations()` uses
  `uuid_generate_v4()` but never enables the extension).
- Method: a read-only schema audit over every `INSERT` / `UPDATE` /
  `WHERE` / `JOIN` / `ON CONFLICT` reference in `backend/src/`.
  Tables already created by `runMigrations()` are deliberately NOT
  duplicated here (verified: zero overlap).
- Local checks: parentheses balanced (0), 16 statements, 8 tables.
  No live Postgres exists in the Muse VM, so the SQL was NOT
  executed locally — CI's Docker Postgres + backend `/health`
  check is the first live proof, and it is pending (see below).

## 1.3 `twitter-api-v2` — ADDED

- Before: `backend/src/routes/posts.js` required `twitter-api-v2`
  but it was absent from `backend/package.json`, so any Twitter
  post would crash at require time.
- Fix: `"twitter-api-v2": "^1.17.0"` added (resolves to 1.31.0
  in the lockfile). Usage is the standard `TwitterApi` OAuth 1.0a
  user-context client; no code change was needed in `posts.js`.

## 1.4 Duplicate LinkedIn-org callback — REMOVED, behaviour preserved

- Before: `backend/src/routes/auth.js` defined
  `GET /linkedin-org/callback` twice. Express uses the later
  registration, so the first handler was dead code.
- Fix: the first (dead) handler was deleted (89 lines removed, 5
  lines added including an explanatory comment). The retained
  handler is the one that was live, so callback behaviour is
  unchanged. The deleted handler's `LINKEDIN_COMPANY_ID` approach
  is recorded as a candidate for the dedicated LinkedIn phase —
  it was NOT silently adopted, because Umar previously reported
  company-page posting failing and we have no live test to prove
  which variant fixes it.
- Check: `node --check` passes on `auth.js` and `posts.js`, and
  on every backend `src/**/*.js` file; only one
  `/linkedin-org/callback` route remains.

## 1.5 Other CI fixes in the same package

- `docker-compose` → `docker compose` in the workflow (Compose v2
  on current runners), and the backend readiness check now hits
  `/health` (a real endpoint that queries the DB) instead of `/`
  with a silent fallback. Frontend check keeps its fallback.
- `.gitignore`: `*.sql` still ignores dumps, but
  `!backend/init.sql` explicitly un-ignores the one intentional
  SQL file (verified with `git check-ignore`).

## NOT proven yet — honest limits

- CI on this branch is pending at push time. Phase 1 is NOT
  accepted until a CI run on the exact pushed head is green.
  If CI then fails on a later step (Docker build, service start),
  that failure will be fixed in this phase, not claimed away.
- Auxiliary tables (`platform_posts`, `ai_creative_sessions`,
  `ai_phase_logs`, `ai_generated_content`) are code-derived, not
  live-proven: CI exercises `users` / `posts` / `sessions` at
  backend startup, but no CI step inserts into the auxiliary
  tables. Their guessed parts, in order of risk:
  1. `ai_phase_logs.input_data / output_data / scores` as JSONB
     (code passes `JSON.stringify(...)`; JSONB follows the
     codebase pattern, but a live insert is the real proof).
  2. `ai_phase_logs.phase_number` as `NUMERIC(5,1)` — load-bearing
     and deliberate: phases 17.1 and 18.1 exist, so INTEGER would
     break those inserts.
  3. `id` PKs as UUID for `social_accounts`, `platform_posts`,
     `ai_phase_logs`, `ai_generated_content` — convention, not
     proof (nothing joins on those ids, so the choice is
     code-compatible either way).
  4. SELECT-only columns (`is_active` default true is the one
     exception: it is load-bearing, because every account query
     filters `is_active = true`).
- No social posting, OAuth, or Muse image job was tested in this
  phase. Those belong to their own phases, on test accounts.

## Files changed

- `.github/workflows/ci.yml` (modified)
- `.gitignore` (modified)
- `backend/package.json` (modified, +twitter-api-v2)
- `backend/package-lock.json` (new)
- `frontend/package-lock.json` (new)
- `backend/init.sql` (new)
- `backend/src/routes/auth.js` (modified, -89/+5)
- `docs/GATE_PHASE1.md` (this file, new)
