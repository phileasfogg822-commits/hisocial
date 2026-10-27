# Gate — Phase 4: Groups + multi-account model

## Scope (from the agreed 0–29 roadmap, Foundations)

Phase 4 is the last Foundations item: "rebuild accounts into
groups with multiple accounts per platform". It follows
Phase 3 (Google login) and closes the Foundations group
(0–4, with the domain/tunnel item deferred to the final VPS
migration under the GitHub-only decision).

Branch: `phase-4-groups-multi-account`, cut from Phase 3
closed head `7c01981`. PR base: `phase-3-google-login`
(the Lubric chaining pattern).

## The bug this phase fixes

`social_accounts` was `UNIQUE (user_id, platform)`, so a
second account on the same platform overwrote the first for
that app profile. Multiple app profiles were the only
workaround. There was also no groups model at all, although
Umar's model is one app user holding several groups
(English video, Urdu video, images), each holding several
social accounts.

## What Phase 4 adds

1. Data model, in both `backend/init.sql` (fresh DBs) and
   `runMigrations()` (existing DBs, idempotent):
   - New `account_groups` table: owner `user_id`, `name`
     (unique per owner), `description`, timestamps.
   - `social_accounts.group_id` (FK to `account_groups`,
     `ON DELETE SET NULL` — deleting a group never deletes
     its accounts, they become ungrouped).
   - Uniqueness moved from `(user_id, platform)` to
     `(user_id, platform, platform_user_id)`: several
     accounts per platform, same account re-connected
     still updates in place. The migration drops the old
     constraint by name and adds the new one inside a
     `duplicate_object` guard, so startup is safe to rerun.
     The old constraint was stricter than the new one, so
     existing rows always satisfy the new constraint.
2. Upserts updated, all 7 sites: `passport.js` (2:
   `findOrCreateUser`, `linkAccount`) and `auth.js` (5:
   LinkedIn org, LinkedIn personal, Instagram ×2,
   Pinterest) now use
   `ON CONFLICT (user_id, platform, platform_user_id)`.
   Every site already supplies a non-null platform account
   id (profile id, org id, IG account id, LinkedIn target
   id, Pinterest username), verified site by site. A test
   counts old sites = 0, new sites = 7.
3. Groups API, `backend/src/routes/groups.js`, mounted at
   `/api/groups`, all endpoints requiring a selected
   profile (`req.user`):
   - `GET /` (groups with accounts), `POST /` (create,
     409 on duplicate name), `GET /ungrouped`,
     `GET /:id`, `PUT /:id`, `DELETE /:id`,
     `POST /:id/accounts` (assign), `DELETE
     /:id/accounts/:accountId` (unassign).
   - Ownership is enforced by scoping every query to
     `req.user.id`; a foreign group or account is answered
     404, never 403, so users cannot probe each other.
   - Pure rules in `backend/src/utils/groups.js`: name
     validation (trimmed, non-empty, ≤100 chars) and the
     same-owner + active assignment check.
4. Frontend: a "Groups" item in the sidebar and a
   `GroupsView` (create group, list groups with accounts,
   add an ungrouped account, remove an account, delete a
   group) using the same axios + styles patterns as the
   rest of the app.

## What Phase 4 deliberately does NOT do

- Posting selection is unchanged: `publishStoredPost`
  still builds one token per platform, so with several
  accounts on one platform it posts with one of them
  (the query has no `ORDER BY`, so which one is not
  defined by Phase 4). Choosing which account in a group
  to post to — per-group posting, or posting to every
  account in a group — is later Scheduling/Connections
  work, not silently decided here. This is the phase's
  main known limitation, stated plainly.
- No per-group AI assignment yet: groups are the
  prerequisite for it (AI phases 12–16), but assignment
  itself is not in this phase.
- No group-level analytics yet (Analytics phases 21–25).

## Local evidence

- `npm test` in `backend/`: **37 pass, 0 fail, 7 suites**
  (28 Phase 2–3 tests + 9 new Phase 4 tests: 3 group
  rules, 6 wiring parity). The Phase 2 schema-parity
  test was updated to the new table list (9 tables) and
  its "8 base tables" wording corrected.
- `node --check` passes on `groups.js` (util and router),
  `index.js`, `passport.js`, and `auth.js`.
- Frontend compile is NOT proven locally; it is proven
  by the CI Docker build, as in Phases 1–3.

## NOT proven yet — honest limits

- Live group CRUD against Postgres is NOT proven by unit
  tests (they are pure + static). The CI Docker backend
  `/health` check proves the backend boots with the
  migration, but no CI step yet exercises the groups
  endpoints end to end. That integration step is future
  work, not claimed here.
- CI verdict on the Phase 4 head is pending at the time of
  this gate-doc write; Phase 4 is accepted ONLY on a green
  run on the exact head, including the new tests.
