const express = require('express');
const passport = require('passport');
const { encodeOauthState, decodeOauthState, getOauthLinkedUserId } = require('../utils/oauthState');
const { isGoogleConfigured, GOOGLE_SCOPES } = require('../utils/googleLogin');
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FACEBOOK_LOGIN_SCOPES = ['email', 'public_profile'];
if (String(process.env.FACEBOOK_ENABLE_PAGE_SCOPES).toLowerCase() === 'true') {
  FACEBOOK_LOGIN_SCOPES.push('pages_show_list', 'pages_manage_posts');
}

const isConfigured = (platform) => {
  const keys = {
    facebook: process.env.FACEBOOK_APP_ID,
    instagram: process.env.INSTAGRAM_APP_ID,
    linkedin: process.env.LINKEDIN_CLIENT_ID,
    linkedin_page: process.env.LINKEDIN_ORG_CLIENT_ID,
    twitter: process.env.TWITTER_API_KEY,
    reddit: process.env.REDDIT_CLIENT_ID,
    pinterest: process.env.PINTEREST_APP_ID,
    google: process.env.GOOGLE_CLIENT_ID,
    youtube: process.env.GOOGLE_CLIENT_ID
  };
  const val = keys[platform];
  return val && !val.startsWith('your_');
};

const requireAppProfile = (req, res, next) => {
  if (!req.session?.appAuthenticated) {
    return res.redirect(`${FRONTEND_URL}?error=app_login_required`);
  }
  if (!req.user) {
    return res.redirect(`${FRONTEND_URL}?error=select_profile_first`);
  }
  return next();
};

const finishOAuth = (req, res, user, connectedKey) => {
  req.login(user, (loginErr) => {
    if (loginErr) return res.redirect(`${FRONTEND_URL}?error=login_failed`);
    req.session.appAuthenticated = true;
    return req.session.save((sessionErr) => {
      if (sessionErr) {
        console.error('OAuth session save error:', sessionErr.message);
      }
      return res.redirect(`${FRONTEND_URL}?connected=${connectedKey}`);
    });
  });
};

// Check which platforms are configured
router.get('/status', (req, res) => {
  res.json({
    user: req.user || null,
    configured: {
      facebook: isConfigured('facebook'),
      instagram: isConfigured('instagram'),
      linkedin: isConfigured('linkedin'),
      twitter: isConfigured('twitter'),
      reddit: isConfigured('reddit'),
      pinterest: isConfigured('pinterest'),
      google: isGoogleConfigured(process.env)
    }
  });
});

// Google — APP login (Phase 3). Deliberately NOT behind
// requireAppProfile: this IS the app login, so requiring an app
// login first would be a chicken-and-egg. On success,
// finishOAuth logs the user in and sets appAuthenticated, the
// same as the local login. The local admin login in
// routes/user.js is untouched and remains the fallback when
// Google is not configured. If Google is not configured, the
// start route redirects with a plain error instead of calling
// passport.authenticate on an unregistered strategy.
router.get('/google', (req, res, next) => {
  if (!isGoogleConfigured(process.env)) {
    return res.redirect(`${FRONTEND_URL}?error=google_not_configured`);
  }
  return passport.authenticate('google', { scope: GOOGLE_SCOPES })(req, res, next);
});
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}?error=google_login_failed` }),
  (req, res) => finishOAuth(req, res, req.user, 'google')
);

// YouTube — Phase 8. A SEPARATE consent from Google app
// login (Phase 3): same Google Cloud project and
// credentials, but youtube.upload + youtube.readonly
// scopes, its own callback, and its own social_accounts
// row (platform 'youtube'). access_type=offline and
// prompt=consent are load-bearing: without them Google
// may not return a refresh token, and uploads would stop
// working when the short-lived access token expires.
router.get('/youtube', requireAppProfile, (req, res) => {
  if (!isConfigured('youtube')) {
    return res.redirect(`${FRONTEND_URL}?error=youtube_not_configured`);
  }
  const { YOUTUBE_SCOPES, youtubeCallbackUrl } = require('../utils/youtube');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: youtubeCallbackUrl(),
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: encodeOauthState({ provider: 'youtube', userId: req.user.id, mode: 'profile' }),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/youtube/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}?error=youtube_auth_failed&msg=${encodeURIComponent(error_description || String(error))}`);
  }
  if (!code) return res.redirect(`${FRONTEND_URL}?error=youtube_auth_failed`);
  try {
    const axios = require('axios');
    const db = req.app.locals.db;
    const { exchangeCode, youtubeCallbackUrl } = require('../utils/youtube');
    const tokens = await exchangeCode({
      code: String(code),
      redirectUri: youtubeCallbackUrl(),
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    const accessToken = tokens.access_token;
    if (!accessToken) throw new Error('YouTube exchange returned no access_token');
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet', mine: 'true' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const channel = (channelRes.data?.items || [])[0];
    if (!channel) throw new Error('No YouTube channel found for this account');
    const channelId = channel.id;
    const channelTitle = channel.snippet?.title || channelId;

    const oauthUserId = getOauthLinkedUserId(req);
    let user = null;
    if (oauthUserId) {
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [oauthUserId]);
      user = userResult.rows[0] || null;
    }
    if (!user) user = req.user;
    if (!user) return res.redirect(`${FRONTEND_URL}?error=not_logged_in`);

    await db.query(
      `INSERT INTO social_accounts
       (user_id, platform, platform_user_id, platform_username, platform_display_name, access_token, refresh_token, token_expires_at, scope)
       VALUES ($1,'youtube',$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
       access_token=$5, refresh_token=CASE WHEN $6 IS NULL THEN social_accounts.refresh_token ELSE $6 END,
       token_expires_at=$7, scope=$8,
       platform_username=$3, platform_display_name=$4, updated_at=NOW()`,
      [user.id, channelId, channelTitle, channelTitle, accessToken, tokens.refresh_token || null, expiresAt, tokens.scope || null]
    );

    return finishOAuth(req, res, user, 'youtube');
  } catch (e) {
    console.error('YouTube callback error:', e.response?.data || e.message);
    return res.redirect(`${FRONTEND_URL}?error=youtube_auth_failed&msg=${encodeURIComponent(e.response?.data?.error?.message || e.message)}`);
  }
});

// Facebook
router.get('/facebook', requireAppProfile, (req, res, next) => {
  if (!isConfigured('facebook')) {
    return res.redirect(`${FRONTEND_URL}?error=facebook_not_configured`);
  }

  const oauthState = encodeOauthState({ provider: 'facebook', userId: req.user.id, mode: 'profile' });
  passport.authenticate('facebook', {
    scope: FACEBOOK_LOGIN_SCOPES,
    state: oauthState,
  })(req, res, next);
});

router.get('/facebook/callback', (req, res, next) => {
  passport.authenticate('facebook', { failureRedirect: `${FRONTEND_URL}?error=facebook_auth_failed` }, (err, user) => {
    if (err || !user) {
      if (err) console.error('Facebook callback error:', err.message);
      return res.redirect(`${FRONTEND_URL}?error=facebook_auth_failed`);
    }
    return finishOAuth(req, res, user, 'facebook');
  })(req, res, next);
});

// LinkedIn via direct OAuth (OpenID Connect)
router.get('/linkedin', requireAppProfile, (req, res) => {
  if (!isConfigured('linkedin')) {
    return res.redirect(`${FRONTEND_URL}?error=linkedin_not_configured`);
  }

  const callbackUrl = process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:4000/auth/linkedin/callback';
  const basicMode = String(req.query.basic).toLowerCase() === 'true';
  const orgMode = String(req.query.org).toLowerCase() === 'true';
  const linkedInScopes = ['openid', 'profile', 'email', 'w_member_social'];
  if (!basicMode && orgMode && String(process.env.LINKEDIN_ENABLE_ORG_SCOPES).toLowerCase() === 'true') {
    linkedInScopes.push('rw_organization_admin', 'w_organization_social');
  }

  const oauthMode = basicMode ? 'basic' : (orgMode ? 'org' : 'profile');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: linkedInScopes.join(' '),
    state: encodeOauthState({ provider: 'linkedin', mode: oauthMode, userId: req.user.id })
  });

  if (orgMode) {
    params.set('prompt', 'consent');
  }

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// LinkedIn Company Pages OAuth (App 2 - Community Management API)
router.get('/linkedin-org', requireAppProfile, (req, res) => {
  if (!isConfigured('linkedin_page')) {
    return res.redirect(`${FRONTEND_URL}?error=linkedin_org_not_configured`);
  }

  const callbackUrl = process.env.LINKEDIN_ORG_CALLBACK_URL || 'http://localhost:4000/auth/linkedin-org/callback';
  // Phase 7: w_organization_social alone cannot discover
  // admin'd pages — organizationAcls needs a read scope.
  // Requesting only the posting scope was why the old
  // callback silently stored a bogus 'pages' account. The
  // app needs the Community Management product with admin
  // read; if it lacks it, consent fails visibly instead
  // of storing a row that can never post.
  const scopes = ['rw_organization_admin', 'w_organization_social'];

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_ORG_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: scopes.join(' '),
    state: encodeOauthState({ provider: 'linkedin_org', mode: 'org', userId: req.user.id }),
    prompt: 'consent'
  });

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// Phase 1: duplicate '/linkedin-org/callback' removed. The retained handler below
// is the one that was live (Express uses the later registration), so behaviour is
// unchanged. The removed handler's LINKEDIN_COMPANY_ID approach is a candidate
// for the dedicated LinkedIn phase, not silently adopted here.
router.get('/linkedin-org/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('LinkedIn Org OAuth error:', error, error_description || '');
    return res.redirect(`${FRONTEND_URL}?error=linkedin_org_auth_failed&msg=${encodeURIComponent(error_description || String(error))}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}?error=linkedin_org_auth_failed`);
  }

  // User must already be logged in via App 1 (no OpenID for App 2)
  if (!req.user) {
    return res.redirect(`${FRONTEND_URL}?error=not_logged_in`);
  }

  try {
    const axios = require('axios');
    const db = req.app.locals.db;
    const callbackUrl = process.env.LINKEDIN_ORG_CALLBACK_URL || 'http://localhost:4000/auth/linkedin-org/callback';

    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: callbackUrl,
        client_id: process.env.LINKEDIN_ORG_CLIENT_ID,
        client_secret: process.env.LINKEDIN_ORG_CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;
    const grantedScope = String(tokenRes.data.scope || '').trim();
    console.log('LinkedIn Org granted scopes:', grantedScope || '(none)');

    // Phase 7: discover admin'd organizations with the
    // shared helper, then store ONE linkedin_page row per
    // org (Phase 4 multi-account). A connect that
    // discovers no orgs FAILS VISIBLY now — the old code
    // stored a bogus 'pages' row and redirected as if it
    // had succeeded, which is exactly why company posting
    // failed afterwards. A LINKEDIN_COMPANY_ID preference
    // that is not admin'd is also an error, not a silent
    // fallback to a different org.
    const { selectOrgs } = require('../utils/linkedin');
    const discovered = await fetchManagedLinkedInOrganizations(accessToken);
    console.log('LinkedIn Org: found organizations:', discovered.map((o) => `${o.localizedName || o.id}:${o.id}`).join(', ') || '(none)');
    const { orgs, error: selectError } = selectOrgs(discovered, process.env.LINKEDIN_COMPANY_ID);
    if (selectError || orgs.length === 0) {
      const message = selectError || 'No administered LinkedIn organizations found for this account. Make sure the app has organization admin access and the account administers a page.';
      console.error('LinkedIn Org connect refused:', message);
      return res.redirect(`${FRONTEND_URL}?error=linkedin_org_no_admin_org&msg=${encodeURIComponent(message)}`);
    }

    // Store as 'linkedin_page' rows for the currently logged-in user
    for (const org of orgs) {
      const orgName = org.localizedName || org.vanityName || org.id;
      await db.query(
        `INSERT INTO social_accounts
         (user_id, platform, platform_user_id, platform_username, platform_display_name, platform_avatar_url, access_token, scope)
         VALUES ($1,'linkedin_page',$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
         access_token=$6,
         scope=$7,
         platform_user_id=$2,
         platform_username=$3,
         platform_display_name=$4,
         updated_at=NOW()`,
        [req.user.id, org.id, org.vanityName || org.id, orgName, null, accessToken, grantedScope || null]
      );
    }

    res.redirect(`${FRONTEND_URL}?connected=linkedin_page`);
  } catch (e) {
    console.error('LinkedIn Org callback error:', e.response?.data || e.message);
    res.redirect(`${FRONTEND_URL}?error=linkedin_org_auth_failed&msg=${encodeURIComponent(e.response?.data?.error_description || e.message)}`);
  }
});

router.get('/linkedin/callback', async (req, res) => {
  const { code, error, error_description, state } = req.query;
  const oauthState = decodeOauthState(state);
  const requestedMode = oauthState?.mode || 'profile';

  if (error) {
    console.error('LinkedIn OAuth error:', error, error_description || '');
    const message = String(error_description || error || '').toLowerCase();
    const hasScopeIssue = message.includes('scope') || message.includes('permission');
    if (hasScopeIssue && requestedMode !== 'basic') {
      return res.redirect('/auth/linkedin?basic=true');
    }
    return res.redirect(`${FRONTEND_URL}?error=linkedin_auth_failed&msg=${encodeURIComponent(error_description || String(error))}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}?error=linkedin_auth_failed`);
  }

  try {
    const axios = require('axios');
    const db = req.app.locals.db;
    const callbackUrl = process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:4000/auth/linkedin/callback';

    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: callbackUrl,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;
    const grantedScope = String(tokenRes.data.scope || '').trim();
    console.log('LinkedIn granted scopes:', grantedScope || '(none)', 'state=', state || 'profile');

    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const profile = profileRes.data || {};
    const linkedInId = profile.sub;
    if (!linkedInId) {
      throw new Error('LinkedIn userinfo did not return sub');
    }

    const email = profile.email || `${linkedInId}@linkedin.socialhub`;
    const displayName =
      profile.name ||
      `${profile.given_name || ''} ${profile.family_name || ''}`.trim() ||
      'LinkedIn User';

    // Phase 7: a personal connect ALWAYS stores the person
    // id. The old code replaced it with an organization id
    // when a hardcoded default company happened to be
    // admin'd, corrupting personal posting. Company pages
    // are the separate linkedin_page flow (Phase 7 org
    // callback), never mixed into the personal row.
    const linkedInTargetUserId = linkedInId;
    const linkedInTargetUsername = profile.email || linkedInId;
    const linkedInTargetDisplayName = displayName;

    const oauthUserId = getOauthLinkedUserId(req);
    let user = null;
    if (oauthUserId) {
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [oauthUserId]);
      user = userResult.rows[0] || null;
    }
    if (!user) user = req.user;

    if (!user) {
      let userResult = await db.query('SELECT * FROM users WHERE email=$1', [email]);
      if (userResult.rows.length === 0) {
        userResult = await db.query(
          'INSERT INTO users (email, name, avatar_url) VALUES ($1,$2,$3) RETURNING *',
          [email, displayName, profile.picture || null]
        );
      }
      user = userResult.rows[0];
    }

    await db.query(
      `INSERT INTO social_accounts
       (user_id, platform, platform_user_id, platform_username, platform_display_name, platform_avatar_url, access_token, scope)
       VALUES ($1,'linkedin',$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
       access_token=$6,
       scope=$7,
       platform_user_id=$2,
       platform_username=$3,
       platform_display_name=$4,
       platform_avatar_url=$5,
       updated_at=NOW()`,
      [
        user.id,
        linkedInTargetUserId,
        linkedInTargetUsername,
        linkedInTargetDisplayName,
        profile.picture || null,
        accessToken,
        grantedScope || null
      ]
    );

    return finishOAuth(req, res, user, 'linkedin');
  } catch (e) {
    console.error('LinkedIn callback error:', e.response?.data || e.message);
    res.redirect(`${FRONTEND_URL}?error=linkedin_auth_failed&msg=${encodeURIComponent(e.response?.data?.error_description || e.message)}`);
  }
});

async function fetchManagedLinkedInOrganizations(accessToken) {
  const axios = require('axios');

  try {
    const aclRes = await axios.get('https://api.linkedin.com/v2/organizationAcls', {
      params: {
        q: 'roleAssignee',
        role: 'ADMINISTRATOR',
        projection: '(elements*(organization~(localizedName,vanityName)))'
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const { parseAclElements } = require('../utils/linkedin');
    return parseAclElements(aclRes.data?.elements || []);
  } catch (error) {
    console.warn('LinkedIn organization lookup failed:', error.response?.data || error.message);
    return [];
  }
}

// Twitter
router.get('/twitter', (req, res, next) => {
  if (!isConfigured('twitter')) {
    return res.redirect(`${FRONTEND_URL}?error=twitter_not_configured`);
  }
  passport.authenticate('twitter')(req, res, next);
});
router.get('/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: `${FRONTEND_URL}?error=twitter_auth_failed` }),
  (req, res) => res.redirect(`${FRONTEND_URL}?connected=twitter`)
);

// Reddit
router.get('/reddit', (req, res, next) => {
  if (!isConfigured('reddit')) {
    return res.redirect(`${FRONTEND_URL}?error=reddit_not_configured`);
  }
  passport.authenticate('reddit', { duration: 'permanent' })(req, res, next);
});
router.get('/reddit/callback',
  passport.authenticate('reddit', { failureRedirect: `${FRONTEND_URL}?error=reddit_auth_failed` }),
  (req, res) => res.redirect(`${FRONTEND_URL}?connected=reddit`)
);

// Instagram via Facebook OAuth
router.get('/instagram', requireAppProfile, (req, res) => {
  const callbackUrl = process.env.INSTAGRAM_CALLBACK_URL || process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:4000/auth/instagram/callback';
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: callbackUrl,
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,pages_manage_posts',
    response_type: 'code',
    state: encodeOauthState({ provider: 'instagram', userId: req.user.id, mode: 'instagram' })
  });
  res.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params}`);
});

router.get('/instagram/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}?error=instagram_auth_failed`);
  try {
    const axios = require('axios');
    const callbackUrl = process.env.INSTAGRAM_CALLBACK_URL || process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:4000/auth/instagram/callback';

    // Exchange code for user access token
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: callbackUrl,
        code
      }
    });
    const shortLivedToken = tokenRes.data.access_token;

    // Phase 6: exchange for a long-lived user token BEFORE
    // fetching pages, so the page tokens derived from it do
    // not expire. Best-effort: on exchange failure, fall
    // back to the short-lived token as before.
    let userToken = shortLivedToken;
    let tokenExpiresAt = null;
    try {
      const { exchangeForLongLivedToken } = require('../utils/metaTokens');
      const exchanged = await exchangeForLongLivedToken({
        token: shortLivedToken,
        appId: process.env.FACEBOOK_APP_ID,
        appSecret: process.env.FACEBOOK_APP_SECRET,
      });
      userToken = exchanged.accessToken;
      tokenExpiresAt = exchanged.expiresAt;
    } catch (e) {
      console.error('Instagram long-lived exchange failed, using short-lived token:', e.message);
    }

    // Get all pages with their Instagram business accounts
    const pagesRes = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        fields: 'id,name,access_token,instagram_business_account{id,username,profile_picture_url}',
        access_token: userToken
      }
    });

    // Find all pages that have Instagram connected
    const pagesWithIG = pagesRes.data.data.filter(p => p.instagram_business_account);
    if (pagesWithIG.length === 0) {
      console.error('No Instagram business account found. Pages:', JSON.stringify(pagesRes.data.data));
      return res.redirect(`${FRONTEND_URL}?error=no_instagram_business_account`);
    }

    // If only one Instagram account, connect it directly
    if (pagesWithIG.length === 1) {
      const pageWithIG = pagesWithIG[0];
      const igAccount = pageWithIG.instagram_business_account;
      const pageToken = pageWithIG.access_token;

      console.log('Found single Instagram account:', igAccount.username, 'ID:', igAccount.id);

      const db = req.app.locals.db;

      // Use existing logged-in user or restore the selected app profile from OAuth state
      const oauthUserId = getOauthLinkedUserId(req);
      let user = null;
      if (oauthUserId) {
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [oauthUserId]);
        user = userResult.rows[0] || null;
      }
      if (!user) user = req.user;
      if (!user) {
        const fbUserRes = await axios.get('https://graph.facebook.com/v18.0/me', {
          params: { fields: 'id,name,email', access_token: userToken }
        });
        const fbUser = fbUserRes.data;
        const email = fbUser.email || `${fbUser.id}@facebook.socialhub`;

        let userResult = await db.query('SELECT * FROM users WHERE email=$1', [email]);
        if (userResult.rows.length === 0) {
          userResult = await db.query(
            'INSERT INTO users (email, name) VALUES ($1,$2) RETURNING *',
            [email, fbUser.name]
          );
        }
        user = userResult.rows[0];
      }

      // Save Instagram
      await db.query(
        `INSERT INTO social_accounts
         (user_id, platform, platform_user_id, platform_username, platform_display_name, platform_avatar_url, access_token, token_expires_at)
         VALUES ($1,'instagram',$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
         access_token=$6, token_expires_at=$7, platform_user_id=$2, platform_username=$3,
         platform_display_name=$4, platform_avatar_url=$5, updated_at=NOW()`,
        [user.id, igAccount.id, igAccount.username, igAccount.username,
         igAccount.profile_picture_url || null, pageToken, tokenExpiresAt]
      );

      return finishOAuth(req, res, user, 'instagram');
    }

    // Multiple Instagram accounts found — store in process-local map keyed by a random token
    // (avoids cross-domain session cookie problem between Cloudflare callback and VPS frontend)
    const crypto = require('crypto');
    const pendingToken = crypto.randomBytes(16).toString('hex');
    const pendingUserId = getOauthLinkedUserId(req) || req.user?.id || null;
    req.app.locals.instagramPending = req.app.locals.instagramPending || new Map();
    req.app.locals.instagramPending.set(pendingToken, {
      accounts: pagesWithIG.map(p => ({
        id: p.id,
        name: p.name,
        igAccount: {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username,
          profile_picture_url: p.instagram_business_account.profile_picture_url
        },
        access_token: p.access_token
      })),
      userToken,
      tokenExpiresAt,
      userId: pendingUserId,
      expires: Date.now() + 10 * 60 * 1000
    });
    req.session.appAuthenticated = true;
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect(`${FRONTEND_URL}?instagram_token=${pendingToken}`);
    });

  } catch(e) {
    console.error('Instagram error:', e.response?.data || e.message);
    res.redirect(`${FRONTEND_URL}?error=instagram_auth_failed&msg=${encodeURIComponent(e.response?.data?.error?.message || e.message)}`);
  }
});

// Get available Instagram accounts for selection
router.get('/instagram/accounts', async (req, res) => {
  const token = req.query.token;
  if (token) {
    const pending = req.app.locals.instagramPending?.get(token);
    if (!pending || pending.expires < Date.now()) {
      req.app.locals.instagramPending?.delete(token);
      return res.status(400).json({ error: 'Instagram selection expired. Please try connecting again.' });
    }
    return res.json({ accounts: pending.accounts });
  }
  // Fallback: legacy session-based
  if (!req.session.instagramAccounts) {
    return res.status(400).json({ error: 'No Instagram accounts available for selection. Try connecting again.' });
  }
  res.json({ accounts: req.session.instagramAccounts });
});

// Instagram account selection after OAuth
router.post('/instagram/confirm', async (req, res) => {
  const { accountId, token } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  // Resolve accounts list — prefer token-based (cross-domain safe), fall back to session
  let accounts, userToken, pendingUserId, confirmTokenExpiresAt = null;
  if (token) {
    const pending = req.app.locals.instagramPending?.get(token);
    if (!pending || pending.expires < Date.now()) {
      req.app.locals.instagramPending?.delete(token);
      return res.status(400).json({ error: 'Instagram selection expired. Please try connecting again.' });
    }
    accounts = pending.accounts;
    userToken = pending.userToken;
    pendingUserId = pending.userId;
    confirmTokenExpiresAt = pending.tokenExpiresAt || null;
    req.app.locals.instagramPending.delete(token);
  } else if (req.session.instagramAccounts) {
    accounts = req.session.instagramAccounts;
    userToken = req.session.userToken;
    pendingUserId = req.session.pendingInstagramUserId;
  } else {
    return res.status(400).json({ error: 'No Instagram accounts available for selection' });
  }

  try {
    const axios = require('axios');
    const db = req.app.locals.db;

    // Find selected account
    const selectedPageData = accounts.find(p => p.id === accountId);
    if (!selectedPageData) {
      return res.status(400).json({ error: 'Invalid Instagram account selection' });
    }

    const igAccount = selectedPageData.igAccount;
    const pageToken = selectedPageData.access_token;

    console.log('User selected Instagram account:', igAccount.username, 'ID:', igAccount.id);

    // Use existing logged-in user or restore the selected app profile from OAuth state/session
    const oauthUserId = getOauthLinkedUserId(req) || pendingUserId || req.session?.pendingInstagramUserId;
    let user = req.user;
    if (!user && oauthUserId) {
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [oauthUserId]);
      user = userResult.rows[0] || null;
    }
    if (!user) {
      const fbUserRes = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: { fields: 'id,name,email', access_token: userToken }
      });
      const fbUser = fbUserRes.data;
      const email = fbUser.email || `${fbUser.id}@facebook.socialhub`;

      let userResult = await db.query('SELECT * FROM users WHERE email=$1', [email]);
      if (userResult.rows.length === 0) {
        userResult = await db.query(
          'INSERT INTO users (email, name) VALUES ($1,$2) RETURNING *',
          [email, fbUser.name]
        );
      }
      user = userResult.rows[0];
    }

    // Save Instagram
    await db.query(
      `INSERT INTO social_accounts
       (user_id, platform, platform_user_id, platform_username, platform_display_name, platform_avatar_url, access_token, token_expires_at)
       VALUES ($1,'instagram',$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
       access_token=$6, token_expires_at=$7, platform_user_id=$2, platform_username=$3,
       platform_display_name=$4, platform_avatar_url=$5, updated_at=NOW()`,
      [user.id, igAccount.id, igAccount.username, igAccount.username,
       igAccount.profile_picture_url || null, pageToken, confirmTokenExpiresAt]
    );

    // Clear legacy session data if present
    if (req.session.instagramAccounts) req.session.instagramAccounts = null;
    if (req.session.userToken) req.session.userToken = null;
    if (req.session.pendingInstagramUserId) req.session.pendingInstagramUserId = null;

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      req.session.appAuthenticated = true;
      return req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: 'Failed to persist session' });
        return res.json({ success: true, user });
      });
    });

  } catch(e) {
    console.error('Instagram confirm error:', e.response?.data || e.message);
    res.status(500).json({ error: e.message });
  }
});

// Pinterest
router.get('/pinterest', (req, res) => {
  if (!isConfigured('pinterest')) {
    return res.redirect(`${FRONTEND_URL}?error=pinterest_not_configured`);
  }
  const params = new URLSearchParams({
    client_id: process.env.PINTEREST_APP_ID,
    redirect_uri: process.env.PINTEREST_CALLBACK_URL,
    response_type: 'code',
    scope: 'boards:read,pins:read,pins:write'
  });
  res.redirect(`https://www.pinterest.com/oauth/?${params}`);
});

router.get('/pinterest/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}?error=pinterest_auth_failed`);
  try {
    const axios = require('axios');
    const credentials = Buffer.from(`${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`).toString('base64');
    const tokenRes = await axios.post('https://api.pinterest.com/v5/oauth/token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.PINTEREST_CALLBACK_URL }),
      { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data;
    const profileRes = await axios.get('https://api.pinterest.com/v5/user_account',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const db = req.app.locals.db;
    const profile = profileRes.data;
    const email = `${profile.username}@pinterest.socialhub`;

    let userResult;
    if (req.user) {
      userResult = { rows: [req.user] };
    } else {
      userResult = await db.query('SELECT * FROM users WHERE email=$1', [email]);
      if (userResult.rows.length === 0) {
        userResult = await db.query(
          'INSERT INTO users (email, name, avatar_url) VALUES ($1,$2,$3) RETURNING *',
          [email, profile.username, profile.profile_image]
        );
      }
    }

    const user = userResult.rows[0];
    await db.query(
      `INSERT INTO social_accounts (user_id, platform, platform_user_id, platform_username, access_token)
       VALUES ($1,'pinterest',$2,$3,$4)
       ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET access_token=$4, updated_at=NOW()`,
      [user.id, profile.username, profile.username, access_token]
    );

    req.login(user, (err) => {
      if (err) return res.redirect(`${FRONTEND_URL}?error=login_failed`);
      res.redirect(`${FRONTEND_URL}?connected=pinterest`);
    });
  } catch (e) {
    console.error('Pinterest OAuth error:', e.message);
    res.redirect(`${FRONTEND_URL}?error=pinterest_auth_failed`);
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.json({ success: true });
  });
});

// Disconnect a platform
router.delete('/disconnect/:platform', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const db = req.app.locals.db;
  try {
    await db.query(
      'DELETE FROM social_accounts WHERE user_id=$1 AND platform=$2',
      [req.user.id, req.params.platform]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
