# Gate — Phase 0: Reusable Instance Template

Date: 2026-10-27 PKT. Started by Umar's phase-start tap (01:36 PKT).

## Accepted

- Instance template at `~/workspace/hisocial-instance-template/`:
  `README.md`, `docker-compose.yml`, `.env.example`,
  `scripts/new-instance.sh`, `scripts/validate-instance.sh`,
  `scripts/apply-muse-queue.sh`, `backend/museQueue.js`,
  `backend/museQueueLogic.js`, `backend/muse_queue_migration.sql`,
  `cloudflared/config.yml.template`, `docs/MUSE_BRIDGE_SPEC.md`,
  `tests/museQueueLogic.test.js`, `tests/run-phase0-tests.sh`.
- One instance per person, one folder, one Compose project, one port set,
  one domain, one named tunnel, one set of developer apps, one Muse bridge
  token per instance. No quick tunnel anywhere in the generated stack.
- Muse bridge queue: queued -> leased (15 min) -> done/error, with
  heartbeat, asset upload (PNG/JPG/WebP, max 20 MB), and SQL-guarded claim
  so two workers cannot claim the same job.

## Test evidence (run 2026-10-27, local, no Docker/Postgres in this VM)

Command: `tests/run-phase0-tests.sh` — output ended `PHASE 0 TESTS PASSED`.
- Shell syntax: `bash -n` on all three scripts — pass.
- JS syntax: `node --check` on `museQueue.js` and `museQueueLogic.js` — pass.
- Unit tests: `node --test tests/museQueueLogic.test.js` — 5 pass, 0 fail
  (lease length, claimable rules, validation, token comparison).
- Generated two instances in a throwaway directory: manager (index 0,
  backend 4000, frontend 4001, Postgres 5433, Redis 6380) and person2
  (index 1, 4010/4011/5443/6390). Both passed `validate-instance.sh`.
- Isolation check: all five generated secrets differed between the two
  instances, all at least 32 characters; ports, Compose projects and
  domains all differed; no ephemeral-tunnel command in either compose file.
- Apply step: `apply-muse-queue.sh` on a throwaway copy of the
  `hisocial-inspect` checkout inserted the `/api/muse-queue` mount into
  `backend/src/index.js` and passed `node --check` on both copied files.

## What was NOT proven in Phase 0 (honest limits)

- Docker build/run was not tested here: Docker is not available in this
  Muse VM. `docker compose up` on a real VPS is a Phase 1 verification step.
- The `muse_jobs` migration was not executed against a live Postgres
  database. The SQL is idempotent (`CREATE TABLE IF NOT EXISTS`) and was
  reviewed, not run.
- No GitHub push was made. The template lives only in this workspace
  until Umar taps a push/PR step.
- No real instance, domain, tunnel, developer app, or Muse pairing was
  created. Those are owner steps per instance, documented in README.md.

## Next step prepared

Phase 1 (awaiting Umar's phase-start tap): either push this template to
`phileasfogg822-commits/hisocial` as a branch/PR, or start the first real
instance on the VPS (manager instance + foundations fixes) and verify
`docker compose up`, the health endpoint, and one Muse image job
end-to-end. Phase 1 must not start without that tap, per the standing
HiSocial operating model.
