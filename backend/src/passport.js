const FacebookStrategy = require('passport-facebook').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const RedditStrategy = require('passport-reddit').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getOauthLinkedUserId } = require('./utils/oauthState');
const { isGoogleConfigured, googleCallbackUrl, GOOGLE_SCOPES } = require('./utils/googleLogin');

module.exports = (passport, pool) => {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0] || null);
    } catch (err) {
      done(err, null);
    }
  });

  const findOrCreateUser = async (profile, platform, accessToken, refreshToken, tokenExpiry) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if social account exists
      const existing = await client.query(
        'SELECT u.* FROM users u JOIN social_accounts sa ON u.id = sa.user_id WHERE sa.platform = $1 AND sa.platform_user_id = $2',
        [platform, profile.id]
      );

      let user;
      if (existing.rows.length > 0) {
        user = existing.rows[0];
        // Update tokens
        await client.query(
          `UPDATE social_accounts SET access_token=$1, refresh_token=$2, token_expires_at=$3, 
           platform_username=$4, platform_display_name=$5, platform_avatar_url=$6, updated_at=NOW()
           WHERE platform=$7 AND platform_user_id=$8`,
          [encryptToken(accessToken), refreshToken ? encryptToken(refreshToken) : null, tokenExpiry,
           profile.username || profile.displayName,
           profile.displayName,
           profile.photos?.[0]?.value,
           platform, profile.id]
        );
      } else {
        // Check if user exists by email (link accounts)
        const email = profile.emails?.[0]?.value || `${profile.id}@${platform}.socialhub`;
        let userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
          userResult = await client.query(
            'INSERT INTO users (email, name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
            [email, profile.displayName || profile.username || 'User', profile.photos?.[0]?.value]
          );
        }
        user = userResult.rows[0];

        // Create social account link
        await client.query(
          `INSERT INTO social_accounts (user_id, platform, platform_user_id, platform_username, 
           platform_display_name, platform_avatar_url, access_token, refresh_token, token_expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
           access_token=$7, refresh_token=$8, token_expires_at=$9, updated_at=NOW()`,
          [user.id, platform, profile.id,
           profile.username || profile.displayName,
           profile.displayName,
           profile.photos?.[0]?.value,
           encryptToken(accessToken), refreshToken ? encryptToken(refreshToken) : null, tokenExpiry]
        );
      }

      await client.query('COMMIT');
      return user;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  // Facebook
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id') {
    passport.use('facebook', new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      graphAPIVersion: 'v18.0',
      profileFields: ['id', 'displayName', 'photos', 'email'],
      passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Phase 6: exchange the short-lived callback token for
        // a long-lived one (~60 days) before storing it.
        // Best-effort: if the exchange fails (network, app
        // config), store the short-lived token as before
        // rather than failing the whole connect.
        let storedToken = accessToken;
        let storedExpiry = null;
        try {
          const { exchangeForLongLivedToken } = require('./utils/metaTokens');
          const exchanged = await exchangeForLongLivedToken({
            token: accessToken,
            appId: process.env.FACEBOOK_APP_ID,
            appSecret: process.env.FACEBOOK_APP_SECRET,
          });
          storedToken = exchanged.accessToken;
          storedExpiry = exchanged.expiresAt;
        } catch (e) {
          console.error('Facebook long-lived exchange failed, storing short-lived token:', e.message);
        }
        const linkedUserId = getOauthLinkedUserId(req);
        if (linkedUserId) {
          await linkAccount(pool, linkedUserId, 'facebook', profile, storedToken, refreshToken, storedExpiry);
          const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [linkedUserId]);
          return done(null, userResult.rows[0] || null);
        }
        const user = await findOrCreateUser(profile, 'facebook', storedToken, refreshToken, storedExpiry);
        done(null, user);
      } catch (err) { done(err); }
    }));
  }

  // Instagram (via Facebook)
  if (process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_ID !== 'your_instagram_app_id') {
    // Instagram uses Facebook Graph API - using a custom implementation
    // This uses passport-facebook with Instagram permissions
  }

  // LinkedIn
  if (process.env.LINKEDIN_CLIENT_ID && !process.env.LINKEDIN_CLIENT_ID.startsWith('your_')) {
    passport.use('linkedin', new LinkedInStrategy({
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: process.env.LINKEDIN_CALLBACK_URL,
      scope: ['openid', 'profile', 'email', 'w_member_social'],
      passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (req.user) {
          await linkAccount(pool, req.user.id, 'linkedin', profile, accessToken, refreshToken);
          return done(null, req.user);
        }
        const user = await findOrCreateUser(profile, 'linkedin', accessToken, refreshToken, null);
        done(null, user);
      } catch (err) { done(err); }
    }));
  }

  // Twitter
  if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_KEY !== 'your_twitter_api_key') {
    passport.use('twitter', new TwitterStrategy({
      consumerKey: process.env.TWITTER_API_KEY,
      consumerSecret: process.env.TWITTER_API_SECRET,
      callbackURL: process.env.TWITTER_CALLBACK_URL,
      passReqToCallback: true
    }, async (req, token, tokenSecret, profile, done) => {
      try {
        if (req.user) {
          await linkAccount(pool, req.user.id, 'twitter', profile, token, tokenSecret);
          return done(null, req.user);
        }
        const user = await findOrCreateUser(profile, 'twitter', token, tokenSecret, null);
        done(null, user);
      } catch (err) { done(err); }
    }));
  }

  // Google — APP login (Phase 3), not a posting connection.
  // Registered only when real credentials are configured, so a
  // dev checkout without Google credentials still boots and the
  // local admin login remains the fallback. Scopes are identity
  // only ('profile', 'email'); no YouTube scope is requested here.
  if (isGoogleConfigured(process.env)) {
    passport.use('google', new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: googleCallbackUrl(process.env),
      scope: GOOGLE_SCOPES,
      passReqToCallback: true
    }, async (req, accessToken, refreshToken, params, profile, done) => {
      try {
        const tokenExpiry = params?.expires_in
          ? new Date(Date.now() + params.expires_in * 1000)
          : null;
        const linkedUserId = getOauthLinkedUserId(req);
        if (linkedUserId) {
          await linkAccount(pool, linkedUserId, 'google', profile, accessToken, refreshToken);
          const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [linkedUserId]);
          return done(null, userResult.rows[0] || null);
        }
        const user = await findOrCreateUser(profile, 'google', accessToken, refreshToken, tokenExpiry);
        done(null, user);
      } catch (err) { done(err); }
    }));
  }

  // Reddit
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_ID !== 'your_reddit_client_id') {
    passport.use('reddit', new RedditStrategy({
      clientID: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      callbackURL: process.env.REDDIT_CALLBACK_URL,
      passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (req.user) {
          await linkAccount(pool, req.user.id, 'reddit', profile, accessToken, refreshToken);
          return done(null, req.user);
        }
        const user = await findOrCreateUser(profile, 'reddit', accessToken, refreshToken, null);
        done(null, user);
      } catch (err) { done(err); }
    }));
  }
};

async function linkAccount(pool, userId, platform, profile, accessToken, refreshToken, tokenExpiry = null) {
  await pool.query(
    `INSERT INTO social_accounts (user_id, platform, platform_user_id, platform_username,
     platform_display_name, platform_avatar_url, access_token, refresh_token, token_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
     access_token=$7, refresh_token=$8, token_expires_at=$9, platform_username=$4,
     platform_display_name=$5, platform_avatar_url=$6, updated_at=NOW()`,
    [userId, platform, profile.id,
     profile.username || profile.displayName,
     profile.displayName,
     profile.photos?.[0]?.value,
     encryptToken(accessToken), refreshToken ? encryptToken(refreshToken) : null, tokenExpiry]
  );
}
