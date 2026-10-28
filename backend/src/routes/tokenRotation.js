// Phase 28: token rotation endpoint.
//
// POST /api/tokens/rotate/:accountId rotates one of
// the user's own connected accounts, using the
// platform refresh flow that already exists in this
// codebase. The refreshed token is stored encrypted
// (Phase 28 encryption). Platforms with no wired
// refresh flow are refused honestly instead of
// pretending: Instagram page tokens cannot be
// refreshed (Phase 6), Pinterest has no refresh
// helper, LinkedIn and X have none wired either —
// those accounts must be reconnected, not rotated.
const express = require('express');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.post('/rotate/:accountId', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { encryptToken, decryptToken } = require('../utils/tokenCrypto');
  try {
    const result = await db.query(
      `SELECT id, platform, access_token, refresh_token, token_expires_at
       FROM social_accounts WHERE id=$1 AND user_id=$2 AND is_active = true`,
      [req.params.accountId, req.user.id]
    );
    const account = result.rows[0];
    if (!account) return res.status(404).json({ error: 'Connected account not found' });

    const platform = account.platform;
    let refreshed;
    try {
      if (platform === 'facebook') {
        const { exchangeForLongLivedToken } = require('../utils/metaTokens');
        refreshed = await exchangeForLongLivedToken({
          token: decryptToken(account.access_token),
          appId: process.env.FACEBOOK_APP_ID,
          appSecret: process.env.FACEBOOK_APP_SECRET,
        });
      } else if (platform === 'youtube') {
        const { refreshAccessToken } = require('../utils/youtube');
        if (!account.refresh_token) throw new Error('No refresh token stored for this account');
        refreshed = await refreshAccessToken({
          refreshToken: decryptToken(account.refresh_token),
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        });
      } else if (platform === 'tiktok') {
        const { refreshAccessToken } = require('../utils/tiktok');
        if (!account.refresh_token) throw new Error('No refresh token stored for this account');
        refreshed = await refreshAccessToken({
          refreshToken: decryptToken(account.refresh_token),
          clientKey: process.env.TIKTOK_CLIENT_KEY,
          clientSecret: process.env.TIKTOK_CLIENT_SECRET,
        });
      } else if (platform === 'reddit') {
        const { refreshRedditToken } = require('../utils/xrp');
        if (!account.refresh_token) throw new Error('No refresh token stored for this account');
        refreshed = await refreshRedditToken({
          refreshToken: decryptToken(account.refresh_token),
          clientId: process.env.REDDIT_CLIENT_ID,
          clientSecret: process.env.REDDIT_CLIENT_SECRET,
        });
      } else {
        return res.status(400).json({
          error: `Token rotation is not supported for ${platform} — reconnect the account instead.`,
          platform,
        });
      }
    } catch (e) {
      return res.status(502).json({ error: `Rotation failed for ${platform}: ${e.message}` });
    }

    const newRefresh = refreshed.refreshToken
      ? encryptToken(refreshed.refreshToken)
      : account.refresh_token;
    await db.query(
      `UPDATE social_accounts SET access_token=$1, refresh_token=$2, token_expires_at=$3, updated_at=NOW() WHERE id=$4`,
      [encryptToken(refreshed.accessToken), newRefresh, refreshed.expiresAt || account.token_expires_at, account.id]
    );
    res.json({ rotated: true, platform, expiresAt: refreshed.expiresAt || account.token_expires_at });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
