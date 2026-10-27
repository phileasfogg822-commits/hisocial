# Gate — Phase 13: Per-group / per-account / per-task AI assignment

## Scope (from the agreed 0–29 roadmap, AI)

Phase 13 is the second AI item: "per-group /
per-account / per-task AI assignment". It follows
Phase 12 (provider registry). It does NOT build the
Muse queue — that is Phase 14.

Branch: `phase-13-ai-assignment`, cut from Phase 12
closed head `8e3105e`. PR base:
`phase-12-ai-registry`.

## What Phase 13 adds

1. **Assignment model.** Table `ai_assignments`
   (in `init.sql` + `runMigrations`, UNIQUE per
   user per scope per task kind). A row names a
   provider for one scope — `global`, one account
   group, or one connected account — and one task
   kind — `text` or `image`. Scope keys are stored
   as text (`'global'` for the global scope, else
   the group/account id), so the uniqueness
   constraint works for the global row too (NULL
   keys would silently defeat it in Postgres).
2. **Resolution precedence.** `utils/
   aiAssignments.js`, pure and tested: an explicit
   provider on the request wins outright, then the
   account assignment, then the account's group
   assignment, then the global assignment, then
   null (the caller falls back to its registry
   default). `/generate` now accepts `group_id` /
   `account_id`, looks up the account's group when
   only the account is given, and uses the chain
   when no explicit provider is given.
3. **Two deliberate rules.**
   - Muse may be assigned: it records the user's
     preference for the Phase 14 queue, and
     generation refuses it plainly (Phase 12
     behavior) until the queue lands — so Phase 14
     honors it without a reconfiguration step.
   - An assignment naming an unconfigured provider
     is skipped (fall through), not an error: keys
     change at deploy time, and a stale assignment
     must not break generation.
4. **API + UI.** `GET /api/ai/assignments`,
   `POST /api/ai/assignments` (upsert, with
   ownership checks — a group/account assignment
   must name one of the user's own), `DELETE
   /api/ai/assignments/:id`, and `GET /api/ai/
   assignment-options` (the user's groups +
   accounts for the pickers). Settings gains an AI
   assignments section: scope / task-kind /
   provider form plus the current assignment list
   with removal.

## What Phase 13 deliberately does NOT do

- No Muse queue, bridge, or fallback (Phase 14) —
  assigning Muse today only records preference.
- No wiring into the separate creative-engine
  endpoint (`/api/ai/creative/generate`, which
  validates its own gemini/bigmodel-only list) or
  the autopilot worker's image-provider list —
  those keep their existing behavior. Assignment
  applies to the main `/generate` text path; image
  assignments are recorded now and honored by image
  paths as they adopt resolution.
- Compose does not yet pass a group/account
  context to `/generate` (it has no group picker);
  assignment context reaches generation via the
  request's `group_id` / `account_id` fields.
- No live generation with assignments is proven by
  CI (no API keys in GitHub-only dev).

## Local evidence

- `npm test` in `backend/`: **124 pass, 0 fail**
  (114 Phase 2–12 tests + 10 new Phase 13 tests:
  precedence ×5, validation ×2, wiring ×3).
- `node --check` passes on `ai.js`,
  `aiAssignments.js`, and `index.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–12.

## NOT proven yet — honest limits

- Generation actually using an account/group/global
  assignment against a live provider is NOT proven
  in GitHub-only dev. Owner steps: set a global
  text assignment, generate without choosing a
  provider, confirm the assigned provider is used.
- CI verdict on the Phase 13 head is pending at the
  time of this gate-doc write; Phase 13 is accepted
  ONLY on a green run on the exact head, including
  the new tests.

## CI verdict (added after the run)

- Run `40502107022` on head `a66a1c1` (the code
  head): **SUCCESS** — all steps green, including
  Test backend and the frontend Docker build.
  **Phase 13 ACCEPTED on `a66a1c1`.** Draft PR #13
  created and verified. The confirmatory run on
  this gate head follows the Phase 1–12 pattern.
