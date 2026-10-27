# Gate — Phase 20: Video pipeline

## Scope (from the agreed 0–29 roadmap,
## Scheduling/autopilot)

Phase 20 is the fourth and last Scheduling item:
"video pipeline". It follows Phase 19 (autopilot
safety) and closes the Scheduling block (Phases
17–20).

Branch: `phase-20-video-pipeline`, cut from Phase
19 closed head `bece457`. PR base:
`phase-19-autopilot-safety`.

## What Phase 20 adds

1. **Readiness validation, up front.** Before this
   phase, video problems surfaced only at publish
   time, per platform, one failure at a time.
   `utils/videoPipeline.js` checks the whole post
   before anything is scheduled or published:
   - YouTube: ready with at least one video URL
     (the uploader uses the first video URL).
   - TikTok: same (direct post uses the first
     video URL).
   - X: blocked with more than one video
     (existing rule: one video per post).
   - Pinterest: blocked for video (existing rule:
     the video-pin upload flow is not implemented).
   - Every other platform: `unchecked` — the
     pipeline does not claim readiness it has not
     verified, and does not block on an unverified
     guess. A post is ready when nothing is
     blocked.
   All rules come from behavior already in this
   codebase's platform paths, never from assumed
   limits.
2. **Wiring.** `POST /api/posts/validate-video`
   returns the per-platform results with no side
   effects. The post create route fails fast
   (400, with the blocked list) when a manual post
   carries video that no selected platform path
   can publish — before scheduling or publishing.
   Compose gains a Video readiness card that runs
   the check against the selected platforms and
   the media list and shows each result.

## What Phase 20 deliberately does NOT do

- No rendering, transcoding, or assembly: no
  ffmpeg runs here, no video is built from a
  script, no duration or size is measured. Those
  need a media pipeline that does not exist in
  this codebase yet, and claiming otherwise would
  be fabrication. The pipeline validates what the
  post carries against what each platform path can
  actually take.
- No AI-engine-path validation: the AI creative
  path returns before the manual path and its
  media is generated imagery, not user video.
- No per-platform duration/size limits: none are
  enforced in the existing platform paths, so none
  are invented here.

## Local evidence

- `npm test` in `backend/`: **172 pass, 0 fail**
  (166 Phase 2–19 tests + 6 new Phase 20 tests:
  readiness rules ×4, wiring ×2).
- `node --check` passes on `posts.js` and
  `videoPipeline.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–19.

## NOT proven yet — honest limits

- A live video publish through the pipeline is NOT
  proven in GitHub-only dev (no platform tokens,
  no real video file in CI). Owner steps: attach
  a video URL, run the readiness check, confirm
  YouTube/TikTok ready, X blocked on two videos,
  Pinterest blocked; schedule a video post and
  confirm it publishes.
- CI verdict on the Phase 20 head is pending at the
  time of this gate-doc write; Phase 20 is accepted
  ONLY on a green run on the exact head, including
  the new tests.
