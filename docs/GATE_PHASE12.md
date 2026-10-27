# Gate — Phase 12: AI provider registry + connection testing

## Scope (from the agreed 0–29 roadmap, AI)

Phase 12 is the first AI item: "provider registry +
connection testing". It follows Phase 11 (generic
connector) and closes the Connections block. It
deliberately does NOT do per-task / per-account /
per-group AI assignment — that is Phase 13.

Branch: `phase-12-ai-registry`, cut from Phase 11
closed head `65b37ec`. PR base:
`phase-11-generic-connector`.

## What Phase 12 adds

1. **One registry.** `backend/src/utils/
   aiProviders.js` is now the single source of truth
   for AI providers: Muse, OpenAI, Gemini, BigModel,
   Alibaba, DEAPI, Anthropic, Grok — each with its
   env var, text/image capability, and test kind.
   Before this phase the backend list was hardcoded
   in `routes/ai.js` and the Settings list was
   hardcoded again in the frontend (missing Alibaba
   and Muse entirely), so the two lists could — and
   did — disagree.
2. **Muse registered as preferred.** Muse (Meta
   Muse) is the preferred generator per the standing
   decision, but it takes no API key and has no live
   endpoint here — it connects via the task queue,
   which lands in Phase 14. The registry says so
   plainly: Muse shows as preferred with a "task
   queue" marker, its test reports `unavailable`
   with that explanation (recorded like any test),
   and `/generate` refuses a Muse request with a
   plain message instead of silently substituting
   another provider.
3. **Honest test kinds.** Text providers get the
   existing live text probe. Image-only providers
   (Alibaba, DEAPI) have no free probe endpoint, and
   running a generation as a "test" would spend a
   generation and poll an async job — so their test
   reports `untestable` with the real way to verify
   (generate one image). No fake green ticks.
4. **Recorded test status.** Table `ai_provider_
   tests` (in `init.sql` + `runMigrations`) stores
   each provider's last status (`ok` / `failed` /
   `unavailable` / `untestable`), detail, and time.
   `GET /api/ai/providers` returns the registry with
   that status merged; Settings renders a status
   badge per provider (tested ✓ / test failed /
   queue / verify by generating). A missing table or
   DB never breaks the provider list — status is
   just null.
5. **Presence rule unchanged.** An env var counts as
   configured only when set and not a `your_`
   placeholder, exactly as before — now implemented
   once in the registry instead of per route.

## What Phase 12 deliberately does NOT do

- No per-task / per-account / per-group AI
  assignment (Phase 13).
- No Muse queue, bridge, or fallback (Phase 14).
- No image-generation test runs (see honest test
  kinds above).
- No live provider test is proven by CI (no API
  keys in GitHub-only dev).

## Local evidence

- `npm test` in `backend/`: **114 pass, 0 fail**
  (106 Phase 2–11 tests + 8 new Phase 12 tests:
  registry completeness ×2, presence/eligibility
  ×3, wiring ×3).
- `node --check` passes on `ai.js`,
  `aiProviders.js`, and `index.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–11.

## NOT proven yet — honest limits

- A live text probe against a real provider, and
  the Settings status badges against a real
  database, are NOT proven in GitHub-only dev.
  Owner steps: set one provider key, run its test
  from Settings, confirm the badge and the recorded
  time update.
- CI verdict on the Phase 12 head is pending at the
  time of this gate-doc write; Phase 12 is accepted
  ONLY on a green run on the exact head, including
  the new tests.

## CI verdict (added after the run)

- Run `40499470644` on head `748152e` (the code
  head): **SUCCESS** — all steps green, including
  Test backend and the frontend Docker build.
  **Phase 12 ACCEPTED on `748152e`.** Draft PR #12
  created and verified. The confirmatory run on
  this gate head follows the Phase 1–11 pattern.
