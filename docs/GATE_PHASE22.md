# Gate — Phase 22: Demographics / insights +
# English vs Urdu / group comparisons

## Scope (from the agreed 0–29 roadmap,
## Analytics/money)

Phase 22 is the second Analytics/money item. It
builds on Phase 21's snapshots with comparisons
over the user's own posting record.

Branch: `phase-22-insights-comparisons`, cut from
Phase 21 closed head `b2b7a52`. PR base:
`phase-21-daily-snapshots`.

## What Phase 22 adds

1. **Post language.** `posts.language` (VARCHAR,
   init.sql + migration ALTER). The manual create
   route accepts `language` — `'en'` or `'ur'`
   only, anything else is a 400 (the Phase 15
   rule: unknown language is an error, never a
   silent fallback). Stored on both the scheduled
   and immediate INSERTs.
2. **Comparisons.** `GET /api/analytics/compare?
   dimension=language|group|platform&days=30`:
   per-key created / published / failed counts,
   aggregated purely in `utils/insights.js` from
   one joined query (posts + group names +
   platform_posts). Language compares English vs
   Urdu (unstamped posts count as `unknown`);
   group compares by group name (`ungrouped`
   for posts without a group); platform counts a
   post as created under every platform in its
   list. Posts are never double-counted within a
   key.
3. **Audience overview.** `GET /api/analytics/
   audience`: connected active accounts per
   platform and per group, from social_accounts
   only.
4. **Analytics view section.** An Insights card:
   dimension select, comparison rows, and the
   audience account chips.

## What Phase 22 deliberately does NOT do

- **No platform demographics.** Age, gender, and
  location breakdowns are NOT implemented: no
  platform Insights API is wired in this codebase,
  and no demographic source exists in the
  database. The view says so plainly instead of
  showing invented numbers. True demographics need
  platform Insights endpoints + tokens and are
  later work.
- **No follower counts.** social_accounts has no
  follower column; none is invented for the
  audience overview.
- No AI-path language stamping: the AI creative
  path returns before the manual path, so its
  posts stay `unknown` until that path carries
  language through (later work, not silent
  guessing).

## Local evidence

- `npm test` in `backend/`: **180 pass, 0 fail**
  (176 Phase 2–21 tests + 4 new Phase 22 tests:
  aggregation ×2, wiring ×2).
- `node --check` passes on `analytics.js`,
  `posts.js`, and `index.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–21.

## NOT proven yet — honest limits

- A live comparison over real post history is NOT
  proven in GitHub-only dev (no running instance,
  no post history in CI). Owner steps: stamp a few
  posts en/ur, post to two groups, open Analytics,
  confirm the language and group comparisons match
  the posts.
- CI verdict on the Phase 22 head is pending at the
  time of this gate-doc write; Phase 22 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
