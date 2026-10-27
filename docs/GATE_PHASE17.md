# Gate — Phase 17: Durable scheduler + per-group calendar

## Scope (from the agreed 0–29 roadmap,
## Scheduling/autopilot)

Phase 17 is the first Scheduling item: "durable
scheduler + per-group calendar". It follows Phase
16 (AI block complete) and opens the Scheduling
block (Phases 17–20).

Branch: `phase-17-durable-scheduler`, cut from
Phase 16 closed head `a520a2d`. PR base:
`phase-16-templates-style-duplicates`.

## What Phase 17 adds

1. **Durable scheduler.** The old scheduler was a
   60-second in-memory loop with two holes: a
   failed post stayed `failed` forever with no
   retry, and a post stuck in `posting` (crash
   mid-publish) stayed there forever. Now:
   - Failed attempts retry with exponential
     backoff (60s, 2m, 4m, 8m, 16m, capped at 1h),
     up to 5 attempts, then terminal `failed`.
   - A `posting` post un-updated for over 10
     minutes is presumed crashed and returns to
     `scheduled` with backoff (or `failed` if
     attempts are spent), recovered on every tick.
   - All-failed publishes retry; `partial` stays
     terminal — retrying it would duplicate the
     platforms that already published.
   - Claiming stays atomic (`UPDATE ... WHERE
     status='scheduled'`), so two ticks or two
     workers cannot publish the same post twice.
   - New `posts` columns: `attempts`,
     `last_attempt_at`, `next_attempt_at` (in
     `init.sql` + `runMigrations` ALTERs).
2. **Per-group calendar.** New `posts.group_id`
   (FK to `account_groups`, ON DELETE SET NULL).
   The post create route accepts an optional
   `group_id` (ownership-checked, 404 otherwise)
   and stores it on scheduled posts. The calendar
   endpoint accepts `?group_id=` (same ownership
   check). The calendar view gains an "All groups"
   filter and a group picker on the draft form,
   which tags the draft and resets after saving.
   Calendar month loads pass the filter through.

## What Phase 17 deliberately does NOT do

- No approval inbox (Phase 18) — scheduled posts
  still publish directly when due.
- No autopilot changes (Phase 19) — the autopilot
  worker's own scheduling is untouched.
- No group pickers on Compose's six schedule
  paths — Compose scheduling stays ungrouped
  (null) until a later phase adds group context
  there. The calendar draft is the per-group
  scheduling entry point.
- No BullMQ/Redis queue: the durable rules land
  on the existing Postgres-backed loop, which is
  enough for 2–3 users and avoids a new moving
  part. A real queue is a later scaling decision,
  not a Phase 17 requirement.

## Local evidence

- `npm test` in `backend/`: **154 pass, 0 fail**
  (147 Phase 2–16 tests + 7 new Phase 17 tests:
  backoff ×2, due/stuck ×2, wiring ×3).
- `node --check` passes on `posts.js`,
  `index.js`, and `scheduler.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–16.

## NOT proven yet — honest limits

- A live retry cycle (fail → backoff → publish)
  and stuck-post recovery are NOT proven in
  GitHub-only dev (no running instance, no
  platform tokens in CI). Owner steps: schedule a
  post against a failing platform, confirm it
  retries with backoff and eventually publishes or
  fails terminally; kill the backend mid-posting
  and confirm recovery on restart.
- CI verdict on the Phase 17 head is pending at the
  time of this gate-doc write; Phase 17 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
