// Phase 9: TikTok connect + direct-post upload, kept pure
// or injected so it is unit-testable without TikTok and
// without a database.
//
// Flow (TikTok Content Posting API, direct post):
// 1. OAuth with scopes user.info.basic + video.publish
//    (video.publish is direct post; video.upload would
//    only drop the video into the creator's inbox).
// 2. POST /v2/post/publish/video/init/ with post_info
//    and FILE_UPLOAD source_info → publish_id + upload_url.
// 3. PUT the bytes to upload_url in chunks (5–64 MB
//    each; this module uses 10 MB) with Content-Range.
// 4. Poll POST /v2/post/publish/status/fetch/ until
//    PUBLISH_COMPLETE (or FAILED).
//
// Three facts that shape this phase, all from TikTok's
// own docs and all stated in the gate doc too:
// - Access tokens expire after 24 hours, so a refresh
//   token is not optional — both posting paths refresh
//   before posting, exactly like YouTube in Phase 8.
// - Until the app passes TikTok's Content Posting
//   audit, posts are forced to SELF_ONLY (private).
//   Privacy therefore defaults to SELF_ONLY here; a
//   public default would be rejected for an unaudited
//   app and would be a lie about what will happen.
// - PULL_FROM_URL needs a verified domain, so this
//   phase uses FILE_UPLOAD (bytes fetched server-side
//   from the post's video URL, like YouTube).
const TIKTOK_SCOPES = ['user.info.basic', 'video.publish'];
const CHUNK_SIZE = 10 * 1024 * 1024;

function tiktokCallbackUrl(env = process.env) {
  const configured = String(env.TIKTOK_CALLBACK_URL || '').trim();
  return configured || 'http://localhost:4000/auth/tiktok/callback';
}

function buildPostInfo(content) {
  return {
    title: String(content || '').trim().slice(0, 2200) || 'Untitled video',
    privacy_level: 'SELF_ONLY',
    disable_duet: false,
    disable_comment: false,
    disable_stitch: false,
    video_cover_timestamp_ms: 1000,
  };
}

// Chunk plan for a buffer of `size` bytes: chunks of
// CHUNK_SIZE, each with its Content-Range header value.
function chunkPlan(size) {
  const total = Math.max(1, Math.ceil(size / CHUNK_SIZE));
  const chunks = [];
  for (let i = 0; i < total; i += 1) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(size, start + CHUNK_SIZE) - 1;
    chunks.push({ index: i, start, end, range: `bytes ${start}-${end}/${size}` });
  }
  return chunks;
}

async function exchangeCode({ code, redirectUri, clientKey, clientSecret, httpPost }) {
  const post = httpPost || ((url, params) => {
    const axios = require('axios');
    return axios.post(url, new URLSearchParams(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  });
  const res = await post('https://open.tiktokapis.com/v2/oauth/token/', {
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  return res.data || {};
}

async function refreshAccessToken({ refreshToken, clientKey, clientSecret, httpPost }) {
  const post = httpPost || ((url, params) => {
    const axios = require('axios');
    return axios.post(url, new URLSearchParams(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  });
  const res = await post('https://open.tiktokapis.com/v2/oauth/token/', {
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const data = res.data || {};
  if (!data.access_token) throw new Error('TikTok refresh returned no access_token');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

async function initVideoPost({ accessToken, postInfo, videoSize, httpPost }) {
  const post = httpPost || ((url, data, headers) => {
    const axios = require('axios');
    return axios.post(url, data, { headers });
  });
  const chunks = chunkPlan(videoSize);
  const res = await post(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      post_info: postInfo,
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: CHUNK_SIZE,
        total_chunk_count: chunks.length,
      },
    },
    { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
  );
  const data = res.data?.data || {};
  if (!data.publish_id || !data.upload_url) {
    throw new Error('TikTok init did not return publish_id and upload_url');
  }
  return { publishId: data.publish_id, uploadUrl: data.upload_url, chunks };
}

async function fetchPublishStatus({ accessToken, publishId, httpPost }) {
  const post = httpPost || ((url, data, headers) => {
    const axios = require('axios');
    return axios.post(url, data, { headers });
  });
  const res = await post(
    'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
    { publish_id: publishId },
    { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
  );
  return res.data?.data || {};
}

module.exports = {
  TIKTOK_SCOPES,
  CHUNK_SIZE,
  tiktokCallbackUrl,
  buildPostInfo,
  chunkPlan,
  exchangeCode,
  refreshAccessToken,
  initVideoPost,
  fetchPublishStatus,
};
