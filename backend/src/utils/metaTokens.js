// Phase 6: Meta (Facebook / Instagram) token repair and refresh.
//
// The defect this fixes: before Phase 6, Facebook and
// Instagram connections stored the SHORT-lived token from
// the OAuth callback as-is, with no expiry recorded. A
// short-lived user token lasts hours, so a connection that
// worked at setup silently broke afterwards, and nothing
// could tell the user why or fix it.
//
// The repair, following Meta's documented flow:
// 1. On connect, exchange the short-lived user token for a
//    long-lived user token (~60 days) via
//    GET /oauth/access_token?grant_type=fb_exchange_token.
//    Page tokens derived from a long-lived user token do
//    not expire, so Instagram page tokens fetched after
//    the exchange inherit that.
// 2. Record token_expires_at for the connection, so its
//    health can be shown instead of guessed.
// 3. Refresh = re-exchange before expiry: exchanging a
//    long-lived token returns a new long-lived token and
//    resets the ~60-day clock. An already-expired token
//    cannot be exchanged — that account needs reconnecting,
//    and the API says so instead of failing silently.
//    Instagram page tokens cannot be exchanged at all
//    (they are not user tokens); a broken Instagram
//    connection also needs reconnecting.
//
// httpGet is injectable so tests can run without Meta:
// the default uses axios, the same client the rest of the
// backend uses. It must resolve to { data } like axios.
const GRAPH_API = 'https://graph.facebook.com/v18.0';
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

async function exchangeForLongLivedToken({ token, appId, appSecret, httpGet }) {
  const get = httpGet || ((url, params) => {
    const axios = require('axios');
    return axios.get(url, { params });
  });
  const res = await get(`${GRAPH_API}/oauth/access_token`, {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: token,
  });
  const data = res.data || {};
  if (!data.access_token) throw new Error('Meta exchange returned no access_token');
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

// Pure health classification. `expiresAt` may be null for
// connections made before Phase 6 recorded expiries —
// those report 'unknown', never a guessed date.
function tokenStatus(expiresAt, now = new Date()) {
  if (!expiresAt) return 'unknown';
  const at = new Date(expiresAt).getTime();
  if (Number.isNaN(at)) return 'unknown';
  if (at <= now.getTime()) return 'expired';
  if (at - now.getTime() < EXPIRING_SOON_MS) return 'expiring_soon';
  return 'ok';
}

function canAttemptRefresh(status) {
  return status === 'expiring_soon' || status === 'expired';
}

module.exports = {
  GRAPH_API,
  EXPIRING_SOON_MS,
  exchangeForLongLivedToken,
  tokenStatus,
  canAttemptRefresh,
};
