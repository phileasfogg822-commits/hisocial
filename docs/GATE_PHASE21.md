# Gate — Phase 21: Daily snapshots

## Scope (from the agreed 0–29 roadmap,
## Analytics/money)

Phase 21 is the first Analytics/money item:
"daily snapshots". It follows Phase 20 (Scheduling
block complete) and opens the Analytics/money
block (Phases 21–25).

Branch: `phase-21-daily-snapshots`, cut from Phase
20 closed head `e22ef54`. PR base:
`phase-20-video-pipeline`.

## What Phase 21 adds

1. **The snapshot table.** `analytics_daily_
   snapshots`: one row per user, per day, per
   platform — published_count, failed_count,
   posts_created — with a uniqueness constraint
   on (user, date, platform). Built from the app's
   own tables only: platform_posts for publish
   outcomes, posts (unnested platforms) for
   creation counts.
2. **Builder + automation.** `services/
   snapshotBuilder.js`: `buildSnapshotsForUser`
   (idempotent upsert — rebuilding a day
   overwrites, never duplicates) and
   `ensureYesterdaySnapshots`, which the
   scheduler tick calls on every run and which
   builds yesterday's snapshots only for users
   who have none yet. The builder never throws
   into scheduling: any failure is logged and
   scheduling continues.
3. **Endpoints.** `GET /api/analytics/snapshots`
   (days up to 365, optional platform filter) and
   `POST /api/analytics/snapshots/build` (explicit
   date, default yesterday, YYYY-MM-DD validated).
4. **Analytics view section.** A Daily Snapshots
   card: last 30 days per platform with published
   / failed / created counts, plus a rebuild
   button.

## What Phase 21 deliberately does NOT do

- No engagement in snapshots: likes, comments,
  and reactions stay live in `/engagement` only.
  Snapshot engagement columns are Phase 22 work —
  inventing engagement numbers from counts would
  be fabrication.
- No demographics, comparisons, or reports
  (Phases 22–25) — this phase is the time-series
  spine those build on.
- No separate snapshot cron: automation rides the
  existing scheduler tick, which is already
  always-on in a running instance. A dedicated
  cron is a VPS-migration detail, not a Phase 21
  requirement.

## Local evidence

- `npm test` in `backend/`: **176 pass, 0 fail**
  (172 Phase 2–20 tests + 4 new Phase 21 tests:
  aggregation ×2, wiring ×2).
- `node --check` passes on `analytics.js`,
  `posts.js`, `index.js`, and `snapshotBuilder.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–20.

## NOT proven yet — honest limits

- A live snapshot build over real post history is
  NOT proven in GitHub-only dev (no running
  instance, no post history in CI). Owner steps:
  run the app, publish a few posts, wait for the
  next scheduler tick, confirm yesterday's rows
  appear in the Analytics view with correct counts.
- CI verdict on the Phase 21 head is pending at the
  time of this gate-doc write; Phase 21 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
