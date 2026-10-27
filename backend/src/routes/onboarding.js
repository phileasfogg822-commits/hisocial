// Phase 5: developer onboarding wizard API.
//
// GET /api/onboarding returns one entry per platform family
// with its portal, redirect URI, env-var checklist (names
// and presence only, never values), and configured flag.
// It is intentionally unauthenticated, like /api/platforms
// and /auth/status, which already expose the same presence
// level publicly. No endpoint here writes .env or creates a
// developer app — those stay owner actions.
const express = require('express');
const router = express.Router();
const { buildOnboarding } = require('../utils/onboarding');

router.get('/', (req, res) => {
  res.json(buildOnboarding(process.env));
});

module.exports = router;
