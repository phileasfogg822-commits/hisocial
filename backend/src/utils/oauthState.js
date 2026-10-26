const crypto = require('crypto');

function getSigningSecret() {
  return String(process.env.SESSION_SECRET || process.env.JWT_SECRET || 'socialhub_secret');
}

function encodeOauthState(payload = {}) {
  const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function decodeOauthState(value = '') {
  const raw = String(value || '').trim();
  if (!raw.includes('.')) return null;

  const [body, signature] = raw.split('.', 2);
  if (!body || !signature) return null;

  const expected = crypto.createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  if (signature !== expected) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function getOauthLinkedUserId(req) {
  // Prefer the HMAC-signed state userId (trustworthy, tied to initiating user)
  // over req.user, which may belong to a stale session on the callback domain.
  const stateUserId = decodeOauthState(req?.query?.state)?.userId;
  if (stateUserId) return stateUserId;
  return req?.user?.id || null;
}

module.exports = {
  encodeOauthState,
  decodeOauthState,
  getOauthLinkedUserId,
};
