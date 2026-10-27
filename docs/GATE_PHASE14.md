# Gate — Phase 14: Muse image queue / bridge with fallback + approval

## Scope (from the agreed 0–29 roadmap, AI)

Phase 14 is the third AI item: "Muse image queue /
bridge with fallback + approval". It follows Phase
13 (assignment) and makes the preferred provider
real. It ports the Phase 0 instance-template bridge
— which was designed and unit-tested but never
mounted in the main backend — into the app, and
adds the approval and fallback steps the roadmap
names.

Branch: `phase-14-muse-queue`, cut from Phase 13
closed head `efb0546`. PR base:
`phase-13-ai-assignment`.

## What Phase 14 adds

1. **The queue, mounted.** `GET /api/muse-queue/
   next` (claim oldest claimable job, 15-minute
   lease), `POST /jobs/:id/heartbeat`,
   `POST /jobs/:id/asset` (PNG/JPG/WebP upload,
   ≤20 MB, per-job folder under `uploads/muse/`,
   served by the existing static route), `POST
   /jobs/:id/result` — the CinePulse reverse-queue
   pattern: the app queues, the worker polls,
   claims, generates, uploads, submits. Bridge
   endpoints require `MUSE_BRIDGE_TOKEN` as a
   Bearer token and return 503 when it is not
   configured; the token is never logged or
   returned. An expired lease returns the job to
   `queued` on the next claim; a stale worker cannot
   submit against an expired lease (409).
2. **Approval.** A done image job is NOT usable
   until its owner approves it: `POST /jobs/:id/
   approve` / `/reject`, only for done jobs with
   pending approval. Compose shows Muse jobs with
   their status, and "Approve & Use" attaches the
   approved image. A rejected job is not silently
   dropped — it becomes fallback-eligible.
3. **Fallback.** `POST /jobs/:id/fallback` is
   allowed only for jobs Muse did not deliver
   (errored, or done-but-rejected) — never for a
   queued job the worker may still be working on.
   It records the decision and returns the prompt +
   fallback provider; the caller then generates via
   the existing `/api/ai/image` endpoint. The
   backend does not silently re-run a generation
   the user did not ask for. The job records the
   fallback provider at creation (from the Compose
   image-provider choice).
4. **Compose loop.** The compose image section
   gains a Muse card: request from the image prompt,
   live job list (auto-refresh every 20s while a
   job is queued/leased), approve/reject, and
   one-click fallback to an API provider.
5. **Allowance rule preserved.** A worker out of
   allowance submits status `error` with
   `error_message` starting
   `MUSE_ALLOWANCE_EXHAUSTED: ` and stops claiming;
   the app records it and nothing more.

## What Phase 14 deliberately does NOT do

- No live worker runs in GitHub-only dev, and no
  24/7 worker: per the standing decision, dev-mode
  Muse image jobs run only in short-lived
  scheduled windows (claim, complete, verify, keep
  artifact, close). Until such a window runs, jobs
  honestly sit in `queued` — they are never faked.
- No text-job approval flow in the UI (the queue
  accepts text jobs for later phases; approval UI
  covers images, the Phase 14 title scope).
- No automatic fallback execution: fallback is a
  recorded user decision plus a normal API
  generation, not a background retry loop.

## Local evidence

- `npm test` in `backend/`: **133 pass, 0 fail**
  (124 Phase 2–13 tests + 9 new Phase 14 tests:
  lease/claiming ×2, input/token ×2, approval/
  fallback ×2, wiring ×3).
- `node --check` passes on `museQueue.js`,
  `museQueueLogic.js`, and `index.js`.
- The Phase 10 require-resolution regression test
  caught a stale mount-example comment in the
  ported router during this phase; the comment was
  cleaned and the test passes.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–13.

## NOT proven yet — honest limits

- A live worker claim → asset → result → approval
  cycle is NOT proven in GitHub-only dev (no
  worker, no bridge token in CI). Owner steps: set
  `MUSE_BRIDGE_TOKEN`, run a worker in a short
  scheduled window, request an image from Compose,
  approve it, and confirm it attaches to a post.
- CI verdict on the Phase 14 head is pending at the
  time of this gate-doc write; Phase 14 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
