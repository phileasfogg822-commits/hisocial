// Phase 27: APK client handshake (pure).
//
// The Android client asks the backend what it is
// before (or without) logging in, so the app can
// show a compatibility notice instead of failing
// mysteriously against an old backend. No user
// data, no tokens, nothing authenticated — just
// identity and capability flags.
const MIN_CLIENT_VERSION = '1.0.0';

function buildClientInfo({ backendVersion }) {
  return {
    app: 'HiSocial',
    backendVersion: backendVersion || 'unknown',
    minClientVersion: MIN_CLIENT_VERSION,
    api: 'v1',
    features: [
      'compose',
      'schedule',
      'approval-inbox',
      'analytics',
      'monetization',
      'reports',
      'offline-drafts',
    ],
  };
}

module.exports = { buildClientInfo, MIN_CLIENT_VERSION };
