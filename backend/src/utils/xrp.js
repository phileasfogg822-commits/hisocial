// Phase 10: X / Reddit / Pinterest repair helpers, kept
// pure or injected so they are unit-testable without the
// platforms and without a database.
//
// The three defects this phase fixes:
// - X silently dropped every attached image/video: the
//   old postToTwitter never looked at mediaUrls.
// - Reddit hardcoded sr='test': every Reddit post went
//   to r/test, with a comment admitting users "should
//   configure this" — but there was nothing to
//   configure. Reddit now requires a real subreddit per
//   post, validated here, and fails visibly without one.
// - Pinterest always used the first board: there was no
//   way to choose. Boards are now selectable per post,
//   with the first board only as a documented fallback.
// - Reddit access tokens live 1 hour and were never
//   refreshed, so Reddit posting broke an hour after
//   connect. Refresh (permanent refresh token) is now
//   wired into both posting paths, like YouTube/TikTok.
const MAX_TWEET_LENGTH = 280;
const MAX_REDDIT_TITLE_LENGTH = 300;
const MAX_PINTEREST_DESCRIPTION_LENGTH = 800;
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];

function validateTweet(content) {
  const text = String(content || '');
  if (text.length > MAX_TWEET_LENGTH) {
    return { ok: false, error: `Post is ${text.length} characters, over the X limit of ${MAX_TWEET_LENGTH}. Shorten it for X.` };
  }
  if (!text.trim()) return { ok: false, error: 'Post text is empty' };
  return { ok: true };
}

// Normalize a user-typed subreddit: strip a leading
// 'r/', then require Reddit's own shape (3–21 chars,
// letters/digits/underscore). Returns the clean name or
// an error — never a fallback subreddit.
function validateSubreddit(raw) {
  const cleaned = String(raw || '').trim().replace(/^r\//i, '');
  if (!cleaned) return { ok: false, error: 'Enter a subreddit for Reddit (for example: technology)' };
  if (!/^[A-Za-z0-9_]{3,21}$/.test(cleaned)) {
    return { ok: false, error: `Subreddit "${cleaned}" is not valid (3–21 letters, digits, or underscores)` };
  }
  return { ok: true, subreddit: cleaned };
}

function buildRedditSubmit({ subreddit, content }) {
  const text = String(content || '');
  return {
    kind: 'self',
    sr: subreddit,
    title: text.substring(0, MAX_REDDIT_TITLE_LENGTH),
    text,
    resubmit: 'true',
  };
}

function pinterestDescription(content) {
  return String(content || '').substring(0, MAX_PINTEREST_DESCRIPTION_LENGTH);
}

function isVideoUrl(url) {
  const path = String(url || '').split('?')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function mimeTypeForUrl(url) {
  const path = String(url || '').split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.mov')) return 'video/quicktime';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mp4')) return 'video/mp4';
  return 'image/jpeg';
}

async function refreshRedditToken({ refreshToken, clientId, clientSecret, httpPost }) {
  const post = httpPost || ((url, data, headers) => {
    const axios = require('axios');
    return axios.post(url, data, { headers });
  });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await post(
    'https://www.reddit.com/api/v1/access_token',
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  );
  const data = res.data || {};
  if (!data.access_token) throw new Error('Reddit refresh returned no access_token');
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

module.exports = {
  MAX_TWEET_LENGTH,
  MAX_REDDIT_TITLE_LENGTH,
  MAX_PINTEREST_DESCRIPTION_LENGTH,
  validateTweet,
  validateSubreddit,
  buildRedditSubmit,
  pinterestDescription,
  isVideoUrl,
  mimeTypeForUrl,
  refreshRedditToken,
};
