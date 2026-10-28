# HiSocial roadmap — complete (Phases 0–29)

Development stayed GitHub-only for the whole
roadmap, as decided 2026-10-27: no VPS during
development, all validation in GitHub Actions.
The final product now moves to the VPS — see
`docs/VPS_MIGRATION.md`. Nothing below claims a
live proof; CI proof is test + Docker-build proof.

## Phase table

| Phase | What | Code head | Gate head | Tests at close | PR |
|---|---|---|---|---|---|
| 0 | Instance template | b1bff39b | — (template) | 5 | #1 draft |
| 1 | Fix broken base | cbb7478 | — | — | #2 draft |
| 2 | Test harness + CI gate | 74ca6b3 | — | 20 | **none (gap)** |
| 3 | Google login + local admin | a7533ec | 7c01981 | 28 | #3 draft |
| 4 | Groups + multi-account | 953ee10 | 6a00377 | 37 | #4 draft |
| 5 | Onboarding wizard | d2f604a | 98caaf9 | 46 | #5 draft |
| 6 | Meta FB+IG repair/refresh | 2262e60 | 989b8b0 | 54 | #6 draft |
| 7 | LinkedIn personal+company | bdaf07b | 8110e12 | 62 | #7 draft |
| 8 | YouTube | f7abf8b | 3a57dfc | 74 | #8 draft |
| 9 | TikTok | 41a0d15 | 1fb0669 | 85 | #9 draft |
| 10 | X/Reddit/Pinterest repair | 17dc885 | 854942c | 97 | #10 draft |
| 11 | Generic platform connector | 7fffcf9 | 65b37ec | 106 | #11 draft |
| 12 | AI provider registry | 748152e | 8e3105e | 114 | #12 draft |
| 13 | AI assignment | a66a1c1 | efb0546 | 124 | #13 draft |
| 14 | Muse image queue/bridge | 84c17cb | 452db65 | 133 | #14 draft |
| 15 | English + Urdu packs | e0062c6 | c7c8a30 | 139 | #15 draft |
| 16 | Templates/style/duplicates | 65f7726 | a520a2d | 147 | #16 draft |
| 17 | Durable scheduler + calendar | b0de7d5 | 8102fc2 | 154 | #17 draft |
| 18 | Approval inbox | 4817e60 | 51c18d2 | 160 | #18 draft |
| 19 | Autopilot safety | 70ede24 | bece457 | 166 | #19 draft |
| 20 | Video pipeline | 9b1c9f5 | e22ef54 | 172 | #20 draft |
| 21 | Daily snapshots | 465e0e4 | b2b7a52 | 176 | #21 draft |
| 22 | Insights + comparisons | a37ee4d | f133792 | 180 | #22 draft |
| 23 | Monitoring alerts | 718e72a | c404259 | 185 | #23 draft |
| 24 | Monetization ledger | d853cb0 | 2dc27a8 | 190 | #24 draft |
| 25 | Weekly report + export | 0cea591 | 714636c | 196 | #25 draft |
| 26 | PWA polish + offline drafts | 596cc17 | 044e5ce | 200 | #26 draft |
| 27 | APK client | dc66fd6 | 13552aa | 203 | #27 draft |
| 28 | Security + backup + rotation | e8f7458 | 2506a4d | 209 | #28 draft |
| 29 | Final gate + docs | — | — | 212 | #29 draft |

Blocks: Foundations 0–4, Connections 5–11,
AI 12–16, Scheduling 17–20, Analytics/money
21–25, Clients/hardening 26–29. All PRs are
draft, chained (each base = previous phase
branch), owner-merge-only. `main` is untouched
at `0efa4c6` until the owner merges.

## What was deliberately NOT built

- No live platform proof, no live Muse worker
  cycle, no live scheduler/autopilot cycle — all
  owner steps at VPS migration.
- No payment processing, no platform revenue
  APIs (monetization is a manual ledger).
- No alert/report delivery channels (view/CSV
  only), no push notifications, no background
  sync, no server draft sync.
- No built APK (Android Studio owner build).
- No bulk re-encryption of legacy tokens.
- No platform demographics (no Insights API
  wired), no follower counts.

## Open carryovers (from gate docs)

- Phase 2 PR never created — the chain has a gap.
- Posting account selection with several accounts
  on one platform is undefined.
- Pinterest token refresh + video pins;
  readonly custom-platform fetch; editing
  awaiting-approval posts; Compose group/approval
  pickers; AI-path language stamping and video
  validation; creative-engine/autopilot generation
  not wired to assignment/templates.
- The final VPS migration itself (tunnel, domain,
  fresh secrets, re-OAuth, live cycles) — see
  `docs/VPS_MIGRATION.md`.
