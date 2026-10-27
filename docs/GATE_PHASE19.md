# Gate — Phase 19: Autopilot with caps, failure handling, kill switch

## Scope (from the agreed 0–29 roadmap,
## Scheduling/autopilot)

Phase 19 is the third Scheduling item: "autopilot
with caps/failure handling/kill switch". It
follows Phase 18 (approval inbox).

Branch: `phase-19-autopilot-safety`, cut from
Phase 18 closed head `51c18d2`. PR base:
`phase-18-approval-inbox`.

## What Phase 19 adds

1. **Kill switch.** New `autopilot_control` table
   (single row, id=1) with a `killed` flag, plus
   `GET /api/autopilot/status`, `POST /api/
   autopilot/kill`, and `POST /api/autopilot/
   resume`. When killed, NO run starts — not the
   10-minute sweep, not a manual run-now, not even
   a forced run. Kill outranks everything,
   including force, by design: it is the emergency
   stop. The Auto Pilot view shows the state and
   carries Kill / Resume buttons.
2. **Daily cap, enforced.** Before scheduling, the
   worker counts the day's autopilot posts from
   the posts table and schedules only up to
   `posts_per_day` (itself clamped 1–5). A force
   run can no longer push the day past the cap;
   when the cap is reached the run skips with
   reason `daily-cap-reached`.
3. **Failure handling.** Three changes:
   - One bad generation inside a run fails that
     post, not the whole run (per-post try/catch).
     The run reports `success`, `partial` (some
     scheduled, some failed), or `failed`.
   - A run that throws increments the config's
     `consecutive_failures`; a successful or
     partial run resets it to zero.
   - At 3 consecutive failed runs the config
     auto-disables with `disabled_reason` recorded
     ("auto-disabled after 3 consecutive failed
     runs"). It takes an explicit re-enable to run
     again — a failing autopilot must not burn
     provider quota daily. The view surfaces the
     reason.
4. **Unchanged behavior, kept.** The once-per-day
   gate, the 10-minute sweep cadence, the
   Karachi-slot scheduling, and the duplicate
   filter are untouched. Supervised posts (Phase
   18) are a separate path — autopilot schedules
   directly, as before; a supervised autopilot is
   later work if wanted.

## What Phase 19 deliberately does NOT do

- No per-platform caps (one daily cap across all
  platforms, per the original 1–5/day design).
- No in-flight cancellation: kill stops new runs
  from starting; a run already executing finishes
  its current post loop. True mid-run abort is a
  later hardening item.
- No supervised autopilot (autopilot posts do not
  route through the approval inbox).

## Local evidence

- `npm test` in `backend/`: **166 pass, 0 fail**
  (160 Phase 2–18 tests + 6 new Phase 19 tests:
  kill precedence ×1, cap/failure ×2, wiring ×3).
- `node --check` passes on `autoPilotWorker.js`,
  `autopilot.js`, `index.js`, and
  `autopilotSafety.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–18.

## NOT proven yet — honest limits

- A live kill/cap/failure cycle is NOT proven in
  GitHub-only dev (no running instance, no
  provider keys in CI). Owner steps: enable
  autopilot, kill it, confirm no run starts
  (including run-now); resume; force a failing
  configuration three days running and confirm
  auto-disable with the recorded reason.
- CI verdict on the Phase 19 head is pending at the
  time of this gate-doc write; Phase 19 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
