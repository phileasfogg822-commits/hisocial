# Gate — Phase 18: Supervised approval inbox

## Scope (from the agreed 0–29 roadmap,
## Scheduling/autopilot)

Phase 18 is the second Scheduling item:
"supervised approval inbox". It follows Phase 17
(durable scheduler + per-group calendar).

Branch: `phase-18-approval-inbox`, cut from Phase
17 closed head `8102fc2`. PR base:
`phase-17-durable-scheduler`.

## What Phase 18 adds

1. **Supervised posts.** New `posts.
   requires_approval` flag (in `init.sql` +
   `runMigrations` ALTER). The post create route
   accepts it and stores it on scheduled posts.
   The scheduler's due query excludes supervised
   posts; instead, supervised posts whose time has
   come move to status `awaiting_approval`. They
   are never auto-published — that is the whole
   point of supervised mode.
2. **The inbox.** `GET /api/posts/approval` lists
   the user's awaiting posts, earliest due first.
   A new "Approval Inbox" sidebar view shows each
   post's content, due time, platforms, media, and
   failed-approval count, with Approve & Publish
   and Reject buttons.
3. **Decisions.** `POST /api/posts/:id/approve`
   claims the post and publishes it now via the
   existing publish path. A failed approval returns
   the post to the inbox with an incremented
   attempt count — a manual retry after fixing the
   cause (e.g. reconnecting a token), never an
   automatic publish the user did not approve.
   `POST /api/posts/:id/reject` sets status
   `rejected`, terminal, kept visible in history.
   Both endpoints refuse posts that are not
   awaiting (409) and enforce ownership.
4. **Calendar entry point.** The calendar draft
   form gains a "Needs my approval before
   publishing" checkbox, stored on the draft and
   reset after saving.
5. **Crash safety, preserved.** An approval publish
   interrupted mid-flight leaves a `posting` row,
   which Phase 17's stuck recovery returns to
   `scheduled` — and the scheduler's supervised
   mover then returns it to the inbox, not to
   auto-publish. No path publishes a supervised
   post without an explicit approval.

## What Phase 18 deliberately does NOT do

- No editing of awaiting posts (content, time, or
  platforms) — approve or reject only. Editing an
  awaiting post is follow-up work; the current
  edit route stays limited to `scheduled` posts.
- No per-group or per-platform approval rules, no
  approval deadlines or escalation — one inbox,
  one flag.
- No approval checkbox on Compose's schedule
  paths (same scoping as Phase 17) — the calendar
  draft is the supervised entry point.

## Local evidence

- `npm test` in `backend/`: **160 pass, 0 fail**
  (154 Phase 2–17 tests + 6 new Phase 18 tests:
  approval rules ×2, wiring ×4).
- `node --check` passes on `posts.js`,
  `index.js`, and `scheduler.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–17.

## NOT proven yet — honest limits

- A live inbox cycle (due → inbox → approve →
  published, and approve-failure → inbox) is NOT
  proven in GitHub-only dev (no running instance,
  no platform tokens in CI). Owner steps: create
  a supervised calendar draft, wait for its time,
  confirm it lands in the inbox and does NOT
  publish, approve it, confirm it publishes.
- CI verdict on the Phase 18 head is pending at the
  time of this gate-doc write; Phase 18 is accepted
  ONLY on a green run on the exact head, including
  the new tests.

## CI verdict (added after the run)

- Run `40529104002` on head `4817e60` (the code
  head): **SUCCESS** — all steps green, including
  Test backend and the frontend Docker build.
  **Phase 18 ACCEPTED on `4817e60`.** Draft PR #18
  created and verified (the first creation attempt
  died on a runtime restart before applying; the
  open-PR list was re-checked and the PR was
  created cleanly, no duplicate). The confirmatory
  run on this gate head follows the Phase 1–17
  pattern.
