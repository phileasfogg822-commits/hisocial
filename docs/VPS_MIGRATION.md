# HiSocial VPS migration checklist (owner steps)

Development is complete (Phases 0–29, GitHub-
only). This document is the handoff for moving
the finished product to the VPS. Every item here
is an owner step — none of it is CI-proven, and
none of it has happened yet.

## 1. Infrastructure

- [ ] VPS Docker stack up (backend, frontend,
  Postgres, Redis, cloudflared) from the repo's
  compose files, in one folder, on one port set,
  without disturbing other Docker apps.
- [ ] Cloudflare named tunnel + stable domain
  pointing at the frontend/backend.
- [ ] Fresh secrets in the VPS `.env` (never copy
  a dev `.env`): `JWT_SECRET`, `SESSION_SECRET`,
  app login, and **`ENCRYPTION_KEY` — set once
  and never casually changed** (changing it
  orphans every encrypted token; accounts must
  then be reconnected).
- [ ] Postgres volume + backup schedule; test a
  restore with the Settings backup export/import
  (note: backups carry no secrets — see step 4).

## 2. Re-OAuth on the VPS domain

Every platform connection must be redone against
the VPS domain (redirect URLs change):

- [ ] Developer apps: update redirect URLs to the
  VPS domain for Facebook, Instagram, LinkedIn
  (personal + org app), X, Reddit, Pinterest,
  Google (login + YouTube), TikTok.
- [ ] Reconnect each platform in Settings and
  confirm the stored token is `v1:`-prefixed
  (encrypted) in the database.
- [ ] Instagram page tokens cannot be refreshed —
  reconnect when they expire; Facebook can be
  rotated from Settings.

## 3. Live verification cycles (one per surface)

- [ ] Post once per platform (including a video
  post for YouTube/TikTok and a Reddit post with
  a subreddit set) and confirm published status.
- [ ] Schedule a post, confirm it publishes on
  the tick; approve one supervised post from the
  Approval Inbox; reject one.
- [ ] Muse image cycle: queue a job, claim it
  from the worker, submit an asset, approve it in
  Compose (short-lived test window only — the
  dev-mode rule was GitHub-only windows, and the
  same discipline applies: claim, complete,
  verify, close).
- [ ] Snapshots: build yesterday's snapshot,
  confirm counts; alerts: trigger one rule and
  confirm it appears; weekly report + CSV
  download.
- [ ] Monetization: record one revenue and one
  cost entry, confirm per-currency nets.
- [ ] Autopilot: enable for one day at 1 post,
  confirm the cap and the kill switch.
- [ ] APK: build in Android Studio with
  `HISOCIAL_BASE_URL` set to the VPS domain,
  replace the placeholder launcher icon, install
  and log in.

## 4. Backup drill

- [ ] Export a backup from Settings; open the
  JSON and confirm it contains NO tokens or API
  keys; import it into a second profile and
  confirm rows appear without overwriting.

## 5. Merge order note

PRs #1, #3–#29 are chained drafts (each base =
previous phase branch); Phase 2 has no PR. If
merges ever run in chain order, the Phase 2 gap
needs a decision first (create the Phase 2 PR or
rebase the chain) — do not merge the chain
blindly. Merges and releases are owner-only.
