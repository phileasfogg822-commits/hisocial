# Gate — Phase 23: Monitoring alerts

## Scope (from the agreed 0–29 roadmap,
## Analytics/money)

Phase 23 is the third Analytics/money item. It
watches the numbers Phases 21–22 now produce and
flags when something goes wrong.

Branch: `phase-23-monitoring-alerts`, cut from
Phase 22 closed head `f133792`. PR base:
`phase-22-insights-comparisons`.

## What Phase 23 adds

1. **Rules (pure, `utils/alertRules.js`).**
   Thresholds are constants, visible and tested:
   - `failure_spike`: 3+ failed platform_posts
     in the last 24 hours (warning).
   - `token_expiring`: a connected account's
     token expires within 7 days (warning);
     `token_expired`: past expiry (critical).
     Accounts with no expiry recorded never
     alert — absence of data is not a warning.
   - `autopilot_disabled`: the Phase 19
     auto-disable fired, with its recorded reason
     (warning).
   - `approval_backlog`: 5+ posts awaiting
     approval (info).
2. **Evaluator (`services/alertEvaluator.js`).**
   Gathers the signals from the app's own tables,
   opens one alert per (user, dedup_key), never
   duplicates an open one — so a persistent
   condition does not spam every scheduler tick —
   and resolves open alerts whose condition
   cleared. It never throws into scheduling.
3. **Automation + endpoints.** The scheduler tick
   evaluates all users (guarded, like snapshots).
   `GET /api/alerts` (latest 100),
   `POST /api/alerts/evaluate` (manual trigger),
   `POST /api/alerts/:id/acknowledge` (open only,
   own alerts only).
4. **Alerts view.** A 🔔 nav item + AlertsView:
   severity-colored cards, acknowledge button,
   re-evaluate button, and an honest note that
   the view is the inbox for now.

## What Phase 23 deliberately does NOT do

- **No delivery channels.** No push notification,
  email, SMS, or WhatsApp delivery — those need
  a delivery surface (Phase 28's notification
  work / the VPS migration) and are not faked by
  calling the view a notification system.
- No new signal sources: alerts read only tables
  that already exist (platform_posts, posts,
  social_accounts, autopilot configs). No platform
  API polling for health.
- No auto-remediation: an alert never retries a
  post, refreshes a token, or re-enables the
  autopilot on its own. Acknowledgement is the
  only action.

## Local evidence

- `npm test` in `backend/`: **185 pass, 0 fail**
  (180 Phase 2–22 tests + 5 new Phase 23 tests:
  rules ×3, wiring ×2).
- `node --check` passes on `alerts.js`,
  `posts.js`, `index.js`, and `alertEvaluator.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–22.

## NOT proven yet — honest limits

- A live alert cycle is NOT proven in GitHub-only
  dev (no running instance, no failing posts or
  expiring tokens in CI). Owner steps: fail 3
  publishes, wait for a scheduler tick, confirm
  one failure_spike alert appears and no second
  one follows; fix the cause, confirm it resolves.
- CI verdict on the Phase 23 head is pending at the
  time of this gate-doc write; Phase 23 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
