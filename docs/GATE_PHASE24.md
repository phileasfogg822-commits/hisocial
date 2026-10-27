# Gate — Phase 24: Monetization tracking

## Scope (from the agreed 0–29 roadmap,
## Analytics/money)

Phase 24 is the fourth Analytics/money item. It
turns the analytics block toward money — tracked,
not processed.

Branch: `phase-24-monetization`, cut from Phase
23 closed head `c404259`. PR base:
`phase-23-monitoring-alerts`.

## What Phase 24 adds

1. **The ledger.** `monetization_entries`:
   kind (revenue | cost), category (sponsorship,
   affiliate, ad_revenue, subscription, ai_cost,
   other), amount, currency (3-letter, default
   PKR), optional platform, optional post link
   (ownership-checked, post must be the user's
   own), optional note, entry date (defaults to
   today).
2. **Validation + summaries (pure, `utils/
   monetization.js`).** Amount must be positive;
   currency must be a 3-letter code; unknown
   kind/category is a 400, never a silent
   default. Summaries group by currency, platform,
   and category — and net is computed per
   currency only, so PKR revenue and USD revenue
   are never added together.
3. **Endpoints.** `GET /api/monetization`
   (platform/kind filters), `POST /api/
   monetization` (201), `DELETE /api/monetization/
   :id` (own entries only), `GET /api/monetization/
   summary`.
4. **Monetization view.** A 💰 nav item +
   MonetizationView: net-per-currency cards, a
   record-an-entry form, and the entries list
   with delete.

## What Phase 24 deliberately does NOT do

- **No payment processing.** No Stripe, PayPal,
  or any checkout — HiSocial is a personal
  testing app, not for sale, and no payment code
  existed in this codebase to build on.
- **No platform revenue APIs.** YouTube/TikTok
  monetization endpoints are not wired in, so no
  earnings are pulled automatically. Every number
  here is one the user recorded.
- No invoicing, tax, or payout scheduling —
  those belong to a billing system, not a ledger.

## Local evidence

- `npm test` in `backend/`: **190 pass, 0 fail**
  (185 Phase 2–23 tests + 5 new Phase 24 tests:
  validation ×2, summaries ×1, wiring ×2).
- `node --check` passes on `monetization.js`
  (route + util) and `index.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–23.

## NOT proven yet — honest limits

- A live ledger entry over a running instance is
  NOT proven in GitHub-only dev (no running
  instance in CI). Owner steps: record a PKR
  sponsorship and a USD affiliate payout, confirm
  the nets stay per-currency and the entry list
  shows both.
- CI verdict on the Phase 24 head is pending at the
  time of this gate-doc write; Phase 24 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
