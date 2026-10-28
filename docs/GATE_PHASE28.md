# Gate — Phase 28: Security hardening +
# backup/restore + token rotation

## Scope (from the agreed 0–29 roadmap,
## Clients/hardening)

Phase 28 is the third Clients/hardening item and
the last big hardening phase before the final
gate.

Branch: `phase-28-security-backup-rotation`,
cut from Phase 27 closed head `13552aa`.
PR base: `phase-27-apk-client`.

## What Phase 28 adds

1. **Token encryption at rest.**
   `utils/tokenCrypto.js`: AES-256-GCM, key from
   `ENCRYPTION_KEY` (SHA-256 hashed to 32 bytes),
   format `v1:iv:tag:ciphertext`. Wired at every
   social token write found in the codebase
   (auth.js callbacks, passport.js, meta.js
   refresh, posts.js refresh updates) and every
   central read (both posting token maps,
   meta.js, analytics.js), plus custom platform
   API keys (create/update + both posting map
   reads). Fail-closed, never fake: encrypt
   throws without a key; decrypt passes legacy
   plaintext through (pre-Phase 28 tokens keep
   working until rotated/reconnected) and throws
   on an encrypted value without a key.
   `.env.example` documents the key, including
   that changing it orphans encrypted tokens.
2. **Backup export + restore import.**
   `GET /api/backup/export` (JSON download) and
   `POST /api/backup/import` (insert-or-skip by
   id, ownership forced to the importer, tables
   allowlisted). Secrets are NEVER exported:
   account tokens and custom API keys are omitted
   from the export columns, and the export says
   so — reconnecting is an owner step after
   restore. SettingsView gains a Backup & Restore
   card (export download + import file picker
   with a per-table report).
3. **Token rotation.** `POST /api/tokens/
   rotate/:accountId` for the user's own account,
   using the existing refresh flows: Facebook
   (long-lived exchange), YouTube, TikTok, and
   Reddit. The refreshed token is stored
   encrypted. Platforms with no wired refresh
   flow (Instagram page tokens, Pinterest,
   LinkedIn, X) are refused with a clear
   reconnect message instead of a pretended
   rotation. SettingsView shows a Rotate button
   on connected rotatable accounts (`/user/me`
   now returns account ids).
4. **Baseline headers.** nosniff, SAMEORIGIN
   framing, no-referrer — no new dependencies.
   No CSP: a restrictive CSP could break the
   React app in ways CI cannot catch (no browser
   test), so it is deliberately not set here.

## What Phase 28 deliberately does NOT do

- No migration that re-encrypts existing rows in
  place: legacy tokens stay plaintext until their
  next refresh/reconnect, by the decrypt
  pass-through design. A bulk re-encryption job
  is later work, not a silent rewrite.
- No new dependencies (no helmet, no rate-limit
  middleware): the lockfile is untouched, and
  those are Phase 29 candidates if the final
  gate wants them.
- No backup scheduling or cloud storage: export
  is on-demand download; scheduling is a
  VPS-migration detail.

## Local evidence

- `npm test` in `backend/`: **209 pass, 0 fail**
  (203 Phase 2–27 tests + 6 new Phase 28 tests:
  crypto ×3, wiring ×3).
- `node --check` passes on every touched backend
  file. A grep audit confirms no social token DB
  write still passes a bare token variable —
  remaining matches are in-memory passing
  (function arguments, session vars), and the
  storing functions encrypt internally.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–27.

## NOT proven yet — honest limits

- A live encrypted connect + backup + rotation
  cycle is NOT proven in GitHub-only dev (no
  running instance, no ENCRYPTION_KEY, no
  platform credentials in CI). Owner steps at
  VPS migration: set ENCRYPTION_KEY once,
  reconnect one account, confirm its stored token
  is `v1:`-prefixed, export a backup and confirm
  no secrets are in it, rotate a Facebook token
  and confirm the new value is encrypted.
- CI verdict on the Phase 28 head is pending at the
  time of this gate-doc write; Phase 28 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
