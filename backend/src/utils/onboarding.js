// Phase 5: developer onboarding wizard data, kept pure so it
// is unit-testable without a database or a running server.
//
// What this is: for each platform, the exact facts a user
// needs to create a developer app by hand and wire it into
// HiSocial — the developer portal, the redirect URI to paste
// there, and the env vars to set. It does NOT automate any
// of that: creating a developer app and approving a consent
// screen are owner actions, and official posting cannot skip
// one developer app per platform family.
//
// Safety: this module never returns a secret VALUE. The
// config check reports only var NAMES and whether each is
// present (set and not a `your_` placeholder), the same
// presence level the public /auth/status endpoint already
// exposes as `configured`.
const DEFAULT_BACKEND_ORIGIN = 'http://localhost:4000';

function isSet(value) {
  return !!(value && !String(value).startsWith('your_'));
}

// Redirect URI the user must paste into the developer app.
// Resolution mirrors what the OAuth code itself uses:
// 1. the platform's own *_CALLBACK_URL env var, if set;
// 2. per-platform fallbacks the code already has (Instagram
//    falls back to the Facebook callback URL);
// 3. PUBLIC_BACKEND_URL, the public origin in production;
// 4. the localhost default.
function buildRedirectUri(env, platform) {
  const callbackVars = {
    facebook: ['FACEBOOK_CALLBACK_URL'],
    instagram: ['INSTAGRAM_CALLBACK_URL', 'FACEBOOK_CALLBACK_URL'],
    linkedin: ['LINKEDIN_CALLBACK_URL'],
    linkedin_page: ['LINKEDIN_ORG_CALLBACK_URL'],
    twitter: ['TWITTER_CALLBACK_URL'],
    reddit: ['REDDIT_CALLBACK_URL'],
    pinterest: ['PINTEREST_CALLBACK_URL'],
    youtube: ['YOUTUBE_CALLBACK_URL'],
  }[platform];
  if (!callbackVars) return null;
  for (const name of callbackVars) {
    if (isSet(env[name])) return String(env[name]);
  }
  const origin = isSet(env.PUBLIC_BACKEND_URL) ? String(env.PUBLIC_BACKEND_URL).replace(/\/$/, '') : DEFAULT_BACKEND_ORIGIN;
  const paths = {
    facebook: '/auth/facebook/callback',
    instagram: '/auth/instagram/callback',
    linkedin: '/auth/linkedin/callback',
    linkedin_page: '/auth/linkedin-org/callback',
    twitter: '/auth/twitter/callback',
    reddit: '/auth/reddit/callback',
    pinterest: '/auth/pinterest/callback',
    youtube: '/auth/youtube/callback',
  };
  return origin + paths[platform];
}

function checkVars(env, names) {
  return names.map((name) => ({ name, present: isSet(env[name]) }));
}

// One spec per platform family. `id` matches /api/platforms
// ids (plus linkedin_page, the company variant). `connectId`
// is what the frontend passes to the existing Connect flow.
const SPECS = [
  {
    id: 'facebook',
    name: 'Facebook',
    connectId: 'facebook',
    portalUrl: 'https://developers.facebook.com',
    portalName: 'Meta for Developers',
    productNote: 'Create an app, then add the Facebook Login product.',
    redirectFieldNote: 'Paste it under Facebook Login > Settings > Valid OAuth Redirect URIs.',
    requiredVars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    callbackVar: 'FACEBOOK_CALLBACK_URL',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    connectId: 'instagram',
    portalUrl: 'https://developers.facebook.com',
    portalName: 'Meta for Developers',
    productNote: 'Instagram connects through your Facebook app (Instagram via Facebook Page) — there is no separate Instagram developer app. Link the Instagram account to a Facebook Page first.',
    redirectFieldNote: 'Paste it under Facebook Login > Settings > Valid OAuth Redirect URIs.',
    requiredVars: ['INSTAGRAM_APP_ID', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    callbackVar: 'INSTAGRAM_CALLBACK_URL',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn (personal)',
    connectId: 'linkedin',
    portalUrl: 'https://www.linkedin.com/developers',
    portalName: 'LinkedIn Developers',
    productNote: 'Create an app and request the OpenID Connect product (profile + email).',
    redirectFieldNote: 'Paste it under Auth > Authorized redirect URLs for your app.',
    requiredVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    callbackVar: 'LINKEDIN_CALLBACK_URL',
  },
  {
    id: 'linkedin_page',
    name: 'LinkedIn (company page)',
    connectId: 'linkedin_page',
    portalUrl: 'https://www.linkedin.com/developers',
    portalName: 'LinkedIn Developers',
    productNote: 'A second app (or the same app with company access) for posting as a company page. You must be an admin of the page.',
    redirectFieldNote: 'Paste it under Auth > Authorized redirect URLs for your app.',
    requiredVars: ['LINKEDIN_ORG_CLIENT_ID', 'LINKEDIN_ORG_CLIENT_SECRET'],
    callbackVar: 'LINKEDIN_ORG_CALLBACK_URL',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    connectId: 'twitter',
    portalUrl: 'https://developer.twitter.com',
    portalName: 'X Developer Portal',
    productNote: 'Create a project + app, enable OAuth 2.0 (or OAuth 1.0a) with read and write permissions.',
    redirectFieldNote: 'Paste it under your app settings > User authentication > Callback URI.',
    requiredVars: ['TWITTER_API_KEY', 'TWITTER_API_SECRET'],
    callbackVar: 'TWITTER_CALLBACK_URL',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    connectId: 'reddit',
    portalUrl: 'https://www.reddit.com/prefs/apps',
    portalName: 'Reddit app preferences',
    productNote: 'Create a "web app". The redirect URI below goes in the app form.',
    redirectFieldNote: 'Paste it in the redirect URI field of your Reddit app.',
    requiredVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
    callbackVar: 'REDDIT_CALLBACK_URL',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    connectId: 'youtube',
    portalUrl: 'https://console.cloud.google.com',
    portalName: 'Google Cloud Console',
    productNote: 'Use the SAME Google Cloud project as the app login, but a separate consent: enable the YouTube Data API v3, add youtube.upload + youtube.readonly scopes, and create a channel for the Google account first — an account without a channel cannot upload.',
    redirectFieldNote: 'Paste it under APIs & Services > Credentials > your OAuth client > Authorized redirect URIs.',
    requiredVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    callbackVar: 'YOUTUBE_CALLBACK_URL',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    connectId: 'pinterest',
    portalUrl: 'https://developers.pinterest.com',
    portalName: 'Pinterest Developers',
    productNote: 'Create an app and request the boards and pins scopes you post with.',
    redirectFieldNote: 'Paste it under your app settings > Redirect URIs.',
    requiredVars: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'],
    callbackVar: 'PINTEREST_CALLBACK_URL',
  },
];

function buildOnboarding(env) {
  return SPECS.map((spec) => {
    const vars = checkVars(env, spec.requiredVars);
    return {
      id: spec.id,
      name: spec.name,
      connectId: spec.connectId,
      portalUrl: spec.portalUrl,
      portalName: spec.portalName,
      productNote: spec.productNote,
      redirectFieldNote: spec.redirectFieldNote,
      redirectUri: buildRedirectUri(env, spec.id),
      vars,
      configured: vars.every((v) => v.present),
    };
  });
}

module.exports = {
  DEFAULT_BACKEND_ORIGIN,
  isSet,
  buildRedirectUri,
  checkVars,
  SPECS,
  buildOnboarding,
};
