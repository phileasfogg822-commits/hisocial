// Phase 8: YouTube connect + upload, kept pure or injected
// so it is unit-testable without Google and without a
// database.
//
// Deliberate separation from Phase 3: Google APP login
// uses identity scopes only (profile, email) and must
// never silently gain upload scope. YouTube is a
// SEPARATE consent: the same Google Cloud project and
// credentials, but a separate OAuth flow
// (/auth/youtube) requesting youtube.upload +
// youtube.readonly, storing its own social_accounts row
// (platform 'youtube') with its own refresh token.
// A Google app login does not connect YouTube, and a
// YouTube connect does not log the user into the app.
//
// Upload uses the YouTube Data API v3 resumable protocol
// with plain HTTP (no googleapis dependency, matching
// the rest of the backend): start a session with the
// video metadata, then PUT the bytes to the session URL.
// Privacy defaults to 'private': an upload the user did
// not explicitly publish must not go public by accident.
// Choosing public/unlisted per post is later work, not a
// silent default.
//
// The video itself comes from the post's media URLs: the
// backend fetches the first video URL server-side. A
// post with no video URL cannot upload to YouTube and
// fails with a plain message, not a silent skip.
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

function youtubeCallbackUrl(env = process.env) {
  const configured = String(env.YOUTUBE_CALLBACK_URL || '').trim();
  return configured || 'http://localhost:4000/auth/youtube/callback';
}

function buildVideoMetadata(content) {
  const text = String(content || '').trim();
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) || 'Untitled video';
  return {
    title: firstLine.slice(0, 100),
    description: text.slice(0, 5000),
    privacyStatus: 'private',
  };
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];

function pickVideoUrl(mediaUrls) {
  for (const raw of mediaUrls || []) {
    const url = String(raw || '').trim();
    const path = url.split('?')[0].toLowerCase();
    if (VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))) return url;
  }
  return null;
}

function contentTypeForUrl(url) {
  const path = String(url).split('?')[0].toLowerCase();
  if (path.endsWith('.mov')) return 'video/quicktime';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mkv')) return 'video/x-matroska';
  if (path.endsWith('.avi')) return 'video/x-msvideo';
  return 'video/mp4';
}

async function exchangeCode({ code, redirectUri, clientId, clientSecret, httpPost }) {
  const post = httpPost || ((url, params) => {
    const axios = require('axios');
    return axios.post(url, new URLSearchParams(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  });
  const res = await post('https://oauth2.googleapis.com/token', {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  return res.data || {};
}

async function refreshAccessToken({ refreshToken, clientId, clientSecret, httpPost }) {
  const post = httpPost || ((url, params) => {
    const axios = require('axios');
    return axios.post(url, new URLSearchParams(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  });
  const res = await post('https://oauth2.googleapis.com/token', {
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  const data = res.data || {};
  if (!data.access_token) throw new Error('YouTube refresh returned no access_token');
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

async function uploadVideo({ accessToken, videoBuffer, contentType, metadata, http }) {
  const client = http || {
    postSession: async (url, data, headers) => {
      const axios = require('axios');
      return axios.post(url, data, { headers });
    },
    putBytes: async (url, buffer, headers) => {
      const axios = require('axios');
      return axios.put(url, buffer, { headers });
    },
  };
  const sessionRes = await client.postSession(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      snippet: { title: metadata.title, description: metadata.description },
      status: { privacyStatus: metadata.privacyStatus },
    },
    {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Length': String(videoBuffer.length),
      'X-Upload-Content-Type': contentType,
    },
  );
  const sessionUrl = sessionRes.headers?.location;
  if (!sessionUrl) throw new Error('YouTube did not return an upload session URL');
  const uploadRes = await client.putBytes(sessionUrl, videoBuffer, {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': contentType,
    'Content-Length': String(videoBuffer.length),
  });
  const videoId = uploadRes.data?.id;
  if (!videoId) throw new Error('YouTube upload did not return a video id');
  return { id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

module.exports = {
  YOUTUBE_SCOPES,
  youtubeCallbackUrl,
  buildVideoMetadata,
  pickVideoUrl,
  contentTypeForUrl,
  exchangeCode,
  refreshAccessToken,
  uploadVideo,
};
