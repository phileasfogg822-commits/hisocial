# Gate — Phase 7: LinkedIn personal + company fix

## Scope (from the agreed 0–29 roadmap, Connections)

Phase 7 is the third Connections item: "LinkedIn
personal + company fix". It follows Phase 6 (Meta
repair). Umar's known history: LinkedIn company posting
previously failed while personal posting worked and
Facebook/Instagram worked.

Branch: `phase-7-linkedin-fix`, cut from Phase 6 closed
head `989b8b0`. PR base: `phase-6-meta-repair-refresh`.

## The failure chain this phase breaks

Three compounding defects, all in the LinkedIn code:

1. The company connect (`/linkedin-org`) requested only
   `w_organization_social`, but discovering admin'd
   pages via `organizationAcls` needs a read scope — so
   the lookup failed, was caught silently, and the
   callback stored a bogus page account with id
   `'pages'` while redirecting `?connected=
   linkedin_page` as if it had succeeded. Company
   posting could never work from that row.
2. Posting ignored stored page accounts entirely and
   built its company target from a `LINKEDIN_COMPANY_ID`
   env var instead — unset meant no company target at
   all, wrong meant posting to an org the token may not
   administer.
3. The personal connect hardcoded a default company id
   (`105676582`) and, when that org happened to be
   admin'd, stored the ORGANIZATION as the personal
   account id — corrupting personal posting too.

## What Phase 7 adds

1. Pure helpers, `backend/src/utils/linkedin.js`:
   ACL-element parsing (URN → numeric id, unparseable
   rows dropped), org-id validation (bare numeric only;
   `'pages'` rejected), org selection (all orgs, or one
   preference — with a visible error when the preference
   is not admin'd, never a silent fallback), and posting
   targets from stored page rows (bogus rows skipped).
2. Company connect, `auth.js`:
   - Requests `rw_organization_admin` alongside
     `w_organization_social`, so the ACL lookup can
     actually succeed. If the app lacks that product,
     consent fails visibly instead of storing a row
     that can never post.
   - Discovers orgs with the shared helper and stores
     ONE `linkedin_page` row per admin'd org (Phase 4
     multi-account) — a user with several pages gets
     several targets.
   - Discovers no orgs, or a `LINKEDIN_COMPANY_ID`
     preference that is not admin'd → redirects with
     `linkedin_org_no_admin_org` and a message, storing
     nothing.
3. Personal connect: ALWAYS stores the person id. The
   hardcoded default company and the org-hijack block
   are deleted. Company pages are the separate
   `linkedin_page` flow, never mixed into the personal
   row.
4. Posting, `posts.js`: company targets are built from
   the stored `linkedin_page` rows (all of them — both
   the immediate-post path and the scheduled-post path
   now query every page row, since the old tokens map
   kept only one). `listLinkedInTargets` no longer
   reads `LINKEDIN_COMPANY_ID` at all. The
   `/linkedin/targets` picker benefits automatically,
   since it uses the same function.

## What Phase 7 deliberately does NOT do

- No LinkedIn token refresh: LinkedIn tokens also
  expire (60 days), but refresh is a separate,
  cross-platform token-lifecycle item, not smuggled
  into the company fix. A broken LinkedIn connection
  still needs reconnecting for now.
- No frontend change: the target picker already reads
  `/linkedin/targets`, so fixed targets flow through
  with no UI work.
- `LINKEDIN_COMPANY_ID` is kept only as an optional
  preference filter on the org connect (store just that
  org). It no longer decides what posting targets
  exist.

## Local evidence

- `npm test` in `backend/`: **62 pass, 0 fail, 16 suites**
  (54 Phase 2–6 tests + 8 new Phase 7 tests: ACL
  parsing ×1, org-id handling ×4, wiring ×3).
- `node --check` passes on `linkedin.js`, `auth.js`,
  and `posts.js`.
- Frontend compile is NOT proven locally; it is proven
  by the CI Docker build, as in Phases 1–6.

## NOT proven yet — honest limits

- A live LinkedIn connect and company post are NOT
  proven by tests or CI (no LinkedIn app, admin'd page,
  or credentials in GitHub-only dev). The owner step
  is: reconnect the company flow once, confirm the
  picker shows the real page names (not 'pages'), and
  post to a page.
- Legacy `'pages'` rows already stored in a real
  database are NOT deleted by this phase — they are
  skipped at posting time, and disappear when the user
  reconnects. Deleting them automatically would destroy
  data without owner approval.
- CI verdict on the Phase 7 head is pending at the time
  of this gate-doc write; Phase 7 is accepted ONLY on a
  green run on the exact head, including the new tests.
