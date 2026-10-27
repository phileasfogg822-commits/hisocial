# Gate — Phase 2: Test harness + CI gate

## Scope (from the agreed 0–29 roadmap, Foundations)

Phase 2 is the second Foundations item: "add a real test harness and
CI gate". It follows Phase 1 (fix broken base) and, by the
2026-10-27 GitHub-only decision, it is GitHub-only — no VPS, no
tunnel, no domain work in this phase. The later "stable domain +
named tunnel" foundation item is deferred to the final VPS
migration, not done here.

Branch: `phase-2-test-harness`, cut from Phase 1 head `cbb7478`.
PR base: `phase-1-fix-broken-base` (the Lubric chaining pattern),
so this branch includes Phase 1's fixes. If PR #2 merges first,
this PR's base can move to main; if this PR merges first, PR #2
becomes redundant — that choice is the owner's, recorded here
rather than silently resolved.

## What was wrong before Phase 2

- The backend had NO test script (`package.json` had only
  `start`/`dev`), and CI never ran any test. The two existing
  `*.test.js` files in `backend/src/services/` are demo scripts
  (console output, no assertions, no exit code on failure) —
  they are NOT run by the harness and were deliberately left
  untouched, so this phase does not pretend they are tests.
- The CI "Lint" steps were not lint: they ran `npm ls`, which
  only lists installed packages.
- The CI triggers only ran for pushes/PRs to `main`, so a phase
  branch — and a PR chained onto another phase branch — never
  got a CI verdict at all.

## What Phase 2 adds

1. Backend test harness, `backend/tests/`, run by
   `npm test` → `node --test tests/*.test.js`:
   - `oauthState.test.js` (6 tests): encode/decode round-trip,
     tampered body rejected, tampered signature rejected,
     malformed input → null, signed state userId preferred over
     session user, session fallback when state is absent/invalid.
   - `deduplication.test.js` (10 tests): normalizeText,
     tokenize length rule, Jaccard 1 / 0 / 0.5 cases,
     extractContact email-over-URL, fingerprint stability and
     field sensitivity, duplicate by text similarity (≥0.8),
     by company+role, by external contact, and the
     not-duplicate case.
   - `schemaParity.test.js` (4 tests): init.sql and
     runMigrations() both create all 8 base tables, both use
     `CREATE EXTENSION "uuid-ossp"` and neither uses pgcrypto
     (the exact Phase 1 bug, as a regression test), and
     init.sql's posts table has every column runMigrations()
     ALTERs.
   - Total: 20 tests, 3 suites. Runner is Node's built-in
     `node:test` — NO new dependency, so no lockfile change.
     Tests are pure (no database, Redis, or network), so they
     run before Docker and fail fast.
2. CI gate, `.github/workflows/ci.yml`:
   - New `Test backend` step (`npm test`) BEFORE the Docker
     build, so a failing unit test stops the run instead of a
     broken image being built and started.
   - Triggers widened: pushes to `main` and `phase-*`, and
     every PR regardless of base branch.
   - "Lint" steps renamed honestly to "Verify backend/frontend
     dependencies" (still `npm ls`); no lint tool is claimed.
3. `backend/package.json` gains only the `test` script. No
   dependency, version, or lockfile change.

## Local evidence

- `npm test` in `backend/`: **20 pass, 0 fail, 3 suites**
  (Node v24.22.1 in the Muse VM; CI runs Node 20 — the harness
  uses only stable `node:test` APIs available in both).
- `node --check` passes on all 3 test files.
- Gotcha found and fixed during this phase: `node --test
  tests/` (directory form) FAILS on Node 24 — it treats the
  directory as a module to load. The script therefore uses the
  explicit glob `tests/*.test.js`, which passes on both
  Node 20 and 24. Do not "simplify" it back to a directory.

## NOT proven yet — honest limits

- Frontend has NO unit-test harness in this phase: the frontend
  is a single ~5,800-line `App.js` with no testable pure units
  extracted, and `react-scripts test` (jest, watch mode) is not
  wired. The frontend's CI gate remains the Docker build +
  compile, which Phase 1 already proves. Extracting frontend
  units is later work, not claimed here.
- The two demo `*.test.js` scripts in `backend/src/services/`
  are still not real tests and are still not run by CI.
- No integration test against live Postgres/Redis in this
  phase: the Docker `/health` check (Phase 1) remains the
  integration proof, and it runs after the unit tests.
- CI verdict on the Phase 2 head is pending at the time of
  this gate-doc write; Phase 2 is accepted ONLY on a green
  run on the exact head, including the new `Test backend` step.

## CI GREEN on the Phase 2 head — Phase 2's proof

- Run `40413275910` on head `b9ea3e8` completed with
  conclusion `success`. Every step succeeded, including the
  new `Test backend` step and the Docker `/health` check.
  This proves the harness runs in CI (not just locally) and
  that the widened push trigger works: the run fired on the
  `phase-2-test-harness` push itself, before any PR existed.
- Phase 2 is therefore ACCEPTED on `b9ea3e8` for its scope.
  The gate-doc update itself is the only change after this
  head, and its CI run must also go green before the phase
  is called fully closed.
- Note: the earlier CI watch for this run was lost to a
  runtime restart, so the verdict was re-read directly from
  the Actions API on 2026-10-27 ~06:08 PKT — the run id,
  head, and step list above are that re-read, not the lost
  watch's output.
