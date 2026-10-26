# Muse Bridge Spec (Phase 0)

One instance, one worker, one queue. This spec is the contract between a
HiSocial instance and the Muse who serves it. It mirrors the CinePulse
pattern (claim under a lease, heartbeat, submit a result, upload an asset)
because that pattern is already proven with this Muse account — but the
endpoint names, table, and token are HiSocial-specific and per-instance.

## Base

- Queue URL: `https://api.<instance-domain>/api/muse-queue`
- Bridge auth: `Authorization: Bearer <MUSE_BRIDGE_TOKEN>` on every bridge
  endpoint. The token lives only in the instance `.env` and in the owning
  person's Muse pairing. It is never logged, never returned, and never
  shared with another instance.
- App auth: job creation and job listing use the normal app session
  (`req.user`), like every other `/api` route.

## Table: muse_jobs

See `backend/muse_queue_migration.sql`. Status values: `queued`,
`leased`, `done`, `error`. Lease: 15 minutes.

## Endpoints

### POST /api/muse-queue/jobs (app session)
Create a job. Body: `{ kind: "image" | "text", prompt, style?, size?,
language?, group_name?, account_label? }`. Returns `201` with the job.
Validation: kind must be image or text, prompt non-empty and at most
8000 characters.

### GET /api/muse-queue/jobs (app session)
List the calling user's jobs, newest first, limit 100.

### GET /api/muse-queue/next?kind=image (bridge token)
Claim the oldest claimable job (queued, or leased with an expired lease).
Sets status `leased`, a fresh lease token, and a 15-minute expiry, and
returns `{ job, lease_token }`. If nothing is claimable, returns
`{ job: null }` — the worker reports idle, it does not invent work.
The claim update is guarded in SQL so two workers cannot claim the same
job: it only succeeds when the row is still queued or its lease has
expired at claim time.

### POST /api/muse-queue/jobs/:id/heartbeat (bridge token)
Body: `{ lease_token }`. Extends the lease by 15 minutes. Returns 409 if
the job is not leased, the token does not match, or the lease expired.

### POST /api/muse-queue/jobs/:id/asset (bridge token, multipart)
Field `file`, plus form field `lease_token`. Accepts PNG, JPG, WebP only,
max 20 MB, stored under `uploads/muse/<job-id>/`. Returns
`{ ok: true, media_url }`. Uploading an asset does not finish the job.

### POST /api/muse-queue/jobs/:id/result (bridge token)
Body: `{ lease_token, status: "done" | "error", result_text?,
output?, error_message? }`. Marks the job done or errored and clears the
lease token. Returns the updated job. Returns 409 on a bad or expired
lease, so a stale worker cannot overwrite a reclaimed job.

## Worker rules (for the owning person's Muse)

1. Poll only your own instance's queue, with your own instance's token.
2. Claim one job at a time. Heartbeat if generation takes longer than
   a few minutes. If the lease expires, stop and re-claim — do not submit
   against an expired lease.
3. If the queue is empty, report idle. Never invent a job, never claim
   another instance's job, never mark a job done without a real result.
4. If Muse allowance is exhausted, submit `status: "error"` with
   `error_message` starting `MUSE_ALLOWANCE_EXHAUSTED: ` and stop claiming
   for that instance, so the app can fall back to its per-account provider
   instead of queuing silently forever.
5. The generated image file is the asset. The app shows it for approval
   before scheduling or posting; the bridge never posts to a social
   platform directly.

## What this spec deliberately does not do

- No direct social posting from the bridge. Posting stays in the app's
  existing, permission-checked posting paths.
- No cross-instance visibility. Each instance's database and token are
  separate, so a worker physically cannot list another instance's jobs.
- No token rotation endpoint in Phase 0. Rotating a bridge token is a
  manual owner step: change `MUSE_BRIDGE_TOKEN` in that instance's `.env`,
  restart the backend, and re-pair that person's Muse with the new token.
