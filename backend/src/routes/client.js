// Phase 27: APK client handshake endpoint.
// Unauthenticated by design: it carries no user
// data, only backend identity and capabilities.
const express = require('express');

const router = express.Router();

router.get('/info', (req, res) => {
  const { buildClientInfo } = require('../utils/clientInfo');
  let backendVersion = 'unknown';
  try {
    backendVersion = require('../../package.json').version || 'unknown';
  } catch {
    backendVersion = 'unknown';
  }
  res.json(buildClientInfo({ backendVersion }));
});

module.exports = router;
