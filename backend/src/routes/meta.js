// Phase 6: Meta token health and refresh.
//
// GET /api/meta/status — the current profile's Facebook
// and Instagram connections with a health classification
// (ok / expiring_soon / expired / unknown). Never returns
// a token value.
// POST /api/meta/refresh { platform: 'facebook' } —
// re-exchanges the stored Facebook user token for a new
// long-lived token and stores the new expiry. Instagram
// cannot be refreshed this way: its stored token is a
// page token, not a user token, so the endpoint says so
// and reports needs_reconnect instead of pretending.
// An already-expired Facebook token also cannot be
// exchanged; that case reports needs_reconnect too.
const express = require('express');
const { encryptToken, decryptToken } = require('../utils/tokenCrypto');
const router = express.Router();
const { exchangeForLongLivedToken, tokenStatus, canAttemptRefresh } = require('../utils/metaTokens');

const requireProfile = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No profile selected' });
  next();
};

router.get('/status', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT id, platform, platform_username, platform_display_name, token_expires_at
       FROM social_accounts
       WHERE user_id = $1 AND platform IN ('facebook', 'instagram') AND is_active = true
       ORDER BY platform ASC, connected_at ASC`,
      [req.user.id],
    );
    res.json(result.rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      username: row.platform_display_name || row.platform_username,
      expiresAt: row.token_expires_at,
      status: tokenStatus(row.token_expires_at),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/refresh', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const platform = req.body?.platform;
  if (platform !== 'facebook') {
    return res.status(400).json({
      error: platform === 'instagram'
        ? 'Instagram page tokens cannot be refreshed — reconnect Instagram if posting fails'
        : 'Only facebook can be refreshed here',
      needs_reconnect: platform === 'instagram',
    });
  }
  try {
    const result = await db.query(
      `SELECT id, access_token, token_expires_at
       FROM social_accounts
       WHERE user_id = $1 AND platform = 'facebook' AND is_active = true
       ORDER BY connected_at ASC LIMIT 1`,
      [req.user.id],
    );
    const account = result.rows[0];
    if (!account) return res.status(404).json({ error: 'No Facebook connection for this profile' });
    if (!canAttemptRefresh(tokenStatus(account.token_expires_at)) && account.token_expires_at) {
      return res.json({ refreshed: false, status: 'ok', message: 'Token is still healthy, no refresh needed' });
    }
    let exchanged;
    try {
      exchanged = await exchangeForLongLivedToken({
        token: decryptToken(account.access_token),
        appId: process.env.FACEBOOK_APP_ID,
        appSecret: process.env.FACEBOOK_APP_SECRET,
      });
    } catch (e) {
      return res.status(502).json({
        error: 'Meta refused the refresh — the token has likely expired. Reconnect Facebook.',
        needs_reconnect: true,
      });
    }
    await db.query(
      'UPDATE social_accounts SET access_token = $1, token_expires_at = $2, updated_at = NOW() WHERE id = $3',
      [encryptToken(exchanged.accessToken), exchanged.expiresAt, account.id],
    );
    res.json({ refreshed: true, status: tokenStatus(exchanged.expiresAt), expiresAt: exchanged.expiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
