# Gate — Phase 25: Weekly report + export

## Scope (from the agreed 0–29 roadmap,
## Analytics/money)

Phase 25 is the fifth and last Analytics/money
item. It closes the Analytics/money block
(Phases 21–25) by reporting on everything the
block now tracks.

Branch: `phase-25-weekly-report`, cut from Phase
24 closed head `2dc27a8`. PR base:
`phase-24-monetization`.

## What Phase 25 adds

1. **Weekly report builder (pure, `utils/
   reports.js`).** One 7-day period, [end − 6
   days, end], end defaulting to today: snapshot
   totals and per-platform rollups (Phase 21),
   monetization nets per currency (Phase 24),
   and open alerts (Phase 23). It adds no new
   numbers — every figure traces to a row in one
   of those tables.
2. **Endpoints.** `GET /api/reports/weekly`
   (JSON, `?end=YYYY-MM-DD`) and `GET /api/reports/
   weekly.csv` (RFC 4180-escaped CSV download
   with period, platform, and currency sections).
3. **Reports view.** A 📋 nav item +
   ReportsView: end-date picker, totals cards,
   per-platform rows, monetization nets, and a
   Download CSV button.

## What Phase 25 deliberately does NOT do

- **No emailed or scheduled delivery.** The
  report is generated on demand and downloaded
  here. Scheduled delivery needs a delivery
  surface (same boundary as Phase 23's alerts)
  and is not faked by calling an on-demand
  download a scheduled report.
- No new metrics: engagement stays live-only
  (Phase 21), demographics stay unwired
  (Phase 22), and no figure is estimated to fill
  a gap.

## Local evidence

- `npm test` in `backend/`: **196 pass, 0 fail**
  (190 Phase 2–24 tests + 6 new Phase 25 tests:
  builder ×2, CSV ×2, wiring ×2).
- `node --check` passes on `reports.js`
  (route + util) and `index.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–24.

## NOT proven yet — honest limits

- A live report over real history is NOT proven
  in GitHub-only dev (no running instance, no
  snapshot history in CI). Owner steps: run a
  week of posts, open Reports, confirm the totals
  match the snapshots and the CSV downloads with
  the same figures.
- CI verdict on the Phase 25 head is pending at the
  time of this gate-doc write; Phase 25 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
