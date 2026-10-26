# HiSocial — Reusable Instance Template (Phase 0)

One template, one instance per person. Copy the template, never share an
instance's secrets, ports, database, tunnel, domain, developer apps, or Muse
bridge token with another instance.

This is the Phase 0 deliverable. It does **not** deploy anything to a VPS by
itself, and it does **not** create developer accounts, Cloudflare tunnels, or
DNS records automatically — those steps need a human owner (see "Manual steps
only the owner can do" below). What it does give you is a repeatable,
testable way to create instance N+1 from a proven instance 0.

## Isolation rules (locked)

- One folder per instance on the VPS, e.g. `~/hisocial-instances/manager/`,
  `~/hisocial-instances/person2/`. Never run two instances from one folder.
- One Docker Compose project name per instance (`COMPOSE_PROJECT_NAME`).
  That is what keeps containers, volumes and networks apart.
- One port set per instance. Index 0 matches the original app
  (backend 4000, frontend 4001, Postgres 5433, Redis 6380). Index 1 steps by
  10 (4010, 4011, 5443, 6390), index 2 by 20, and so on. Never reuse a port
  set, and never disturb another app's ports on the VPS.
- One `.env` per instance, generated fresh by `scripts/new-instance.sh`.
  Secrets are never copied from another instance and never committed to Git.
  The template `.env.example` contains placeholders only.
- One named Cloudflare tunnel and one domain per instance. No quick tunnel:
  a quick tunnel URL changes on every restart and breaks OAuth callbacks
  and Instagram media URLs.
- One Muse bridge token per instance, stored only in that instance's `.env`
  (`MUSE_BRIDGE_TOKEN`) and in that person's own Muse pairing. A Muse worker
  polls only its own instance's queue. Workers never claim another
  instance's jobs.
- One set of developer apps per instance, because OAuth redirect URLs must
  point at that instance's own domain, e.g.
  `https://api.manager.example.com/auth/facebook/callback` is not valid for
  another instance.

## What is in this template

- `docker-compose.yml` — templated stack: Postgres, Redis, backend,
  frontend, and a Cloudflare named-tunnel service (disabled by default;
  enable with `--profile tunnel`). No quick tunnel, no hard-coded secrets.
- `.env.example` — every variable the stack needs, with placeholders only.
- `scripts/new-instance.sh` — generates one instance folder from this
  template: renders the compose file, generates fresh secrets, writes
  `.env`, and refuses to overwrite an existing instance or reuse a port set
  already recorded in `instances.registry` (see below).
- `scripts/validate-instance.sh` — checks an instance folder: `.env`
  completeness, no placeholder secrets left, compose YAML parses, tunnel
  config present when the tunnel profile is intended, and no quick-tunnel
  command anywhere.
- `backend/museQueue.js` + `backend/museQueueLogic.js` — the Muse bridge
  queue reference implementation. Drop it into a HiSocial backend checkout
  with `scripts/apply-muse-queue.sh` (see `docs/MUSE_BRIDGE_SPEC.md`).
- `backend/muse_queue_migration.sql` — the `muse_jobs` table.
- `cloudflared/config.yml.template` — ingress for `https://<domain>` to the
  frontend and `https://api.<domain>` to the backend.
- `tests/` — the Phase 0 test run. Run `tests/run-phase0-tests.sh`.

## Create an instance (on the VPS)

1. Clone the HiSocial repo into the instance folder first, so `backend/`
   and `frontend/` exist there:
   ```bash
   git clone https://github.com/phileasfogg822-commits/hisocial.git \
     ~/hisocial-instances/manager
   cd ~/hisocial-instances/manager
   ```
2. Copy this template's `scripts/` into the checkout (or run the script
   from this template folder with `--target` pointing at the checkout).
3. Generate the instance:
   ```bash
   ./scripts/new-instance.sh --slug manager --domain manager.example.com \
     --index 0 --target ~/hisocial-instances/manager
   ```
   This writes `docker-compose.yml` and `.env` in the target folder. It
   will not overwrite an existing `.env` or `docker-compose.yml` unless
   you pass `--force`, and it records the slug, domain and ports in
   `instances.registry` next to the script (used only to detect collisions
   on the same machine — it contains no secrets).
4. Validate:
   ```bash
   ./scripts/validate-instance.sh ~/hisocial-instances/manager
   ```
5. Do the manual owner steps below, then start:
   ```bash
   docker compose up -d --build
   docker compose --profile tunnel up -d cloudflared
   ```

## Manual steps only the owner can do

These cannot be automated by the template, and the template does not try
to scrape or fake them:

1. **Cloudflare named tunnel.** On a machine with `cloudflared`:
   `cloudflared tunnel create hisocial-manager`, then
   `cloudflared tunnel route dns hisocial-manager manager.example.com`
   and `cloudflared tunnel route dns hisocial-manager api.manager.example.com`.
   Copy the tunnel credentials JSON into the instance folder as
   `cloudflared/<tunnel-id>.json` (gitignored, never committed) and fill
   `cloudflared/config.yml` from `config.yml.template` with that tunnel ID
   and the credentials-file path.
2. **Developer apps.** Create one app per platform family for this instance
   only, with redirect URLs on this instance's domain
   (`https://api.<domain>/auth/<platform>/callback`). Paste the app IDs
   and secrets into this instance's `.env` only.
3. **Muse pairing.** The person who owns this instance pairs their own
   Muse in their own Muse chat, using this instance's `MUSE_BRIDGE_TOKEN`
   and queue URL `https://api.<domain>/api/muse-queue`. That Muse polls
   only this instance. Umar's Muse does not act as another person's
   runtime worker.
4. **Social connections.** Log in inside the app and connect each social
   account for this instance. Tokens stay in this instance's database.

## Muse bridge, in one paragraph

The app creates an image/text job in `muse_jobs` (status `queued`). The
owner's Muse polls `GET /api/muse-queue/next` with its bridge token, claims
the oldest queued job under a 15-minute lease, generates the result, uploads
the image file with `POST /api/muse-queue/jobs/:id/asset` if there is one,
and submits `POST /api/muse-queue/jobs/:id/result`. The app then shows the
job as ready for approval. If the lease expires, the job returns to `queued`
for a later claim. Full spec: `docs/MUSE_BRIDGE_SPEC.md`.

## What Phase 0 does not do

- It does not push anything to GitHub. Pushing this template to
  `phileasfogg822-commits/hisocial` is a separate, owner-tapped step.
- It does not deploy to the VPS. The VPS, its domain, and its Cloudflare
  account are the owner's.
- It does not change the existing HiSocial posting, scheduling, or AI
  providers. Those are later phases. Phase 0 is only the repeatable
  instance + bridge foundation, with tests.
