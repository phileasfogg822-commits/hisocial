# Gate — Phase 11: Generic platform connector

## Scope (from the agreed 0–29 roadmap, Connections)

Phase 11 is the last Connections item: "generic
platform connector". It follows Phase 10 (X/Reddit/
Pinterest repair). Before this phase the only way to
post anywhere was a built-in platform with its own
OAuth flow; there was no way to add an unsupported
platform at all.

Branch: `phase-11-generic-connector`, cut from Phase
10 closed head `854942c`. PR base:
`phase-10-xrp-repair`.

## What Phase 11 adds

1. **Custom platforms, tiered.** A user creates a
   platform in the new Custom Platforms view: name,
   slug, tier, base URL, and — for the full tier —
   post path and API key. Table `custom_platforms`
   (in `init.sql` + `runMigrations`, UNIQUE per user
   per slug).
   - **full:** the app POSTs JSON `{content,
     media_urls}` to `{base_url}{post_path}` with a
     Bearer token or a custom auth header.
   - **readonly:** connected for reading only;
     posting is refused with a clear error, never
     attempted and failed confusingly at the API.
   - **manual:** the app never calls the platform. A
     publish attempt records a manual instruction
     ("publish this post yourself at <base_url> —
     copy the text from this post") as the attempt's
     error message, instead of pretending the post
     went out. A real manual-task queue is later work
     (supervised inbox, Phase 18); this tier does not
     fake one.
2. **Posting integration.** Custom platform ids are
   namespaced `custom_<slug>` so they cannot collide
   with built-in ids. `postToPlatform` resolves them
   from a per-user custom map (built in both the
   immediate and scheduled paths) before the token
   check, since custom platforms carry no
   `social_accounts` row. A deleted custom platform
   fails visibly ("was deleted or is not available"),
   not silently.
3. **Frontend.** Custom Platforms sidebar view
   (create with tier explanations, list, remove);
   the app merges custom platforms into the Compose
   platform list and marks them connected (creating
   one IS the connection — there is no OAuth flow),
   and registers their real names into
   `PLATFORM_META` so every view renders the actual
   name. API keys are never returned by the API: the
   list reports only `has_api_key`.
4. **Validation.** Slugs are 2–40 lowercase
   letters/digits/underscores/hyphens (they become
   part of post platform ids); base URLs must be
   http(s); full tier requires a `/`-leading post
   path and an API key up front, not at first
   publish.

## What Phase 11 deliberately does NOT do

- No key encryption: API keys are stored like the
  other platforms' access tokens (plaintext, same as
  `social_accounts`). Token encryption is Phase 28
  work and covers all of them together.
- No read/fetch implementation for the readonly
  tier (analytics reads are Phases 21–22 work); the
  tier exists so the platform can be registered and
  posting is honestly refused.
- No CalendarView edit UI for custom-platform posts
  beyond what already renders (platform results show
  the custom name via the registered meta).
- No live posting is proven by CI (no real custom
  platform endpoint in GitHub-only dev).

## Local evidence

- `npm test` in `backend/`: **106 pass, 0 fail, 35
  suites** (97 Phase 2–10 tests + 9 new Phase 11
  tests: slug/validation ×3, request building ×2,
  ids/wiring ×4).
- `node --check` passes on `posts.js`,
  `customPlatforms.js` (route + util), and `index.js`.
- Frontend compile is NOT proven locally; it is
  proven by the CI Docker build, as in Phases 1–10.

## NOT proven yet — honest limits

- A live full-tier post to a real custom endpoint,
  and the manual-tier instruction flow in the UI,
  are NOT proven in GitHub-only dev. Owner steps:
  add a test endpoint, post to it, and confirm the
  JSON shape arrives; add a manual platform and
  confirm the attempt records the instruction.
- CI verdict on the Phase 11 head is pending at the
  time of this gate-doc write; Phase 11 is accepted
  ONLY on a green run on the exact head, including
  the new tests.

## CI verdict (added after the run)

- Run `40490525439` on head `7fffcf9` (the code
  head): **SUCCESS** — all steps green, including
  Test backend and the frontend Docker build.
  **Phase 11 ACCEPTED on `7fffcf9`.** Draft PR #11
  created and verified (the first creation attempt
  died on a runtime restart and was re-created
  cleanly). The confirmatory run on this gate head
  follows the Phase 1–10 pattern.
