// Phase 8: YouTube connect + upload tests.
// node:test only, no new dependency. Metadata, URL
// picking, and the upload/refresh HTTP shapes are pure
// or injected, so these run without Google and without
// a database; wiring checks are static, in the Phase
// 4–7 style. A live YouTube connect/upload is an owner
// step, not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  YOUTUBE_SCOPES,
  buildVideoMetadata,
  pickVideoUrl,
  contentTypeForUrl,
  exchangeCode,
  refreshAccessToken,
  uploadVideo,
} = require('../src/utils/youtube');

describe('video metadata', () => {
  it('uses the first non-empty line as title, capped at 100 chars', () => {
    const meta = buildVideoMetadata('\n\nMy Video Title\nSecond line here');
    assert.equal(meta.title, 'My Video Title');
    assert.equal(meta.description, 'My Video Title\nSecond line here');
    assert.equal(meta.privacyStatus, 'private');
    const long = buildVideoMetadata('x'.repeat(150));
    assert.equal(long.title.length, 100);
    const capped = buildVideoMetadata('y'.repeat(6000));
    assert.equal(capped.description.length, 5000);
  });

  it('falls back to a title when content is empty', () => {
    assert.equal(buildVideoMetadata('').title, 'Untitled video');
  });
});

describe('video URL picking', () => {
  it('picks the first video URL and ignores images', () => {
    assert.equal(
      pickVideoUrl(['https://example.com/poster.jpg', 'https://example.com/clip.mp4?token=1']),
      'https://example.com/clip.mp4?token=1',
    );
    assert.equal(pickVideoUrl(['https://example.com/poster.jpg']), null);
    assert.equal(pickVideoUrl([]), null);
  });

  it('maps extensions to content types, defaulting to mp4', () => {
    assert.equal(contentTypeForUrl('https://example.com/a.mov'), 'video/quicktime');
    assert.equal(contentTypeForUrl('https://example.com/a.webm'), 'video/webm');
    assert.equal(contentTypeForUrl('https://example.com/a.unknown'), 'video/mp4');
  });
});

describe('scopes', () => {
  it('requests upload + readonly, and nothing identity-only', () => {
    assert.ok(YOUTUBE_SCOPES.includes('https://www.googleapis.com/auth/youtube.upload'));
    assert.ok(YOUTUBE_SCOPES.includes('https://www.googleapis.com/auth/youtube.readonly'));
    assert.ok(!YOUTUBE_SCOPES.some((s) => s.includes('youtube.force-ssl')));
  });
});

describe('token flows (injected HTTP)', () => {
  it('exchange posts the authorization code grant', async () => {
    let seenParams;
    const out = await exchangeCode({
      code: 'code-1', redirectUri: 'http://localhost:4000/auth/youtube/callback',
      clientId: 'cid', clientSecret: 'csec',
      httpPost: async (url, params) => {
        seenParams = params;
        assert.equal(url, 'https://oauth2.googleapis.com/token');
        return { data: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'upload' } };
      },
    });
    assert.equal(seenParams.grant_type, 'authorization_code');
    assert.equal(seenParams.code, 'code-1');
    assert.equal(out.refresh_token, 'rt');
  });

  it('refresh posts the refresh grant and throws without an access token', async () => {
    const out = await refreshAccessToken({
      refreshToken: 'rt', clientId: 'cid', clientSecret: 'csec',
      httpPost: async (url, params) => {
        assert.equal(params.grant_type, 'refresh_token');
        return { data: { access_token: 'at2', expires_in: 3600 } };
      },
    });
    assert.equal(out.accessToken, 'at2');
    await assert.rejects(
      refreshAccessToken({
        refreshToken: 'rt', clientId: 'cid', clientSecret: 'csec',
        httpPost: async () => ({ data: {} }),
      }),
      /no access_token/,
    );
  });
});

describe('resumable upload (injected HTTP)', () => {
  it('starts a session with metadata, then PUTs bytes to the session URL', async () => {
    const seen = {};
    const out = await uploadVideo({
      accessToken: 'at',
      videoBuffer: Buffer.from('fake-bytes'),
      contentType: 'video/mp4',
      metadata: { title: 'T', description: 'D', privacyStatus: 'private' },
      http: {
        postSession: async (url, data, headers) => {
          seen.sessionUrl = url;
          seen.metadata = data;
          seen.auth = headers.Authorization;
          assert.equal(headers['X-Upload-Content-Type'], 'video/mp4');
          return { headers: { location: 'https://upload.example/session/1' } };
        },
        putBytes: async (url, buffer, headers) => {
          seen.putUrl = url;
          seen.bytes = buffer.toString();
          assert.equal(headers['Content-Type'], 'video/mp4');
          return { data: { id: 'vid123' } };
        },
      },
    });
    assert.ok(seen.sessionUrl.includes('uploadType=resumable'));
    assert.equal(seen.metadata.snippet.title, 'T');
    assert.equal(seen.metadata.status.privacyStatus, 'private');
    assert.equal(seen.putUrl, 'https://upload.example/session/1');
    assert.equal(seen.bytes, 'fake-bytes');
    assert.equal(out.url, 'https://www.youtube.com/watch?v=vid123');
  });

  it('throws when no session URL or no video id comes back', async () => {
    await assert.rejects(
      uploadVideo({
        accessToken: 'at', videoBuffer: Buffer.from('x'), contentType: 'video/mp4',
        metadata: { title: 'T', description: 'D', privacyStatus: 'private' },
        http: { postSession: async () => ({ headers: {} }), putBytes: async () => ({ data: {} }) },
      }),
      /session URL/,
    );
  });
});

describe('youtube wiring (static)', () => {
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf8');
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const platformsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'platforms.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('youtube connect is a separate consent with offline access, not the app login', () => {
    assert.match(authJs, /router\.get\('\/youtube'/);
    assert.match(authJs, /access_type: 'offline'/);
    assert.match(authJs, /YOUTUBE_SCOPES/);
    assert.match(authJs, /platform, platform_user_id.*'youtube'|\(user_id, platform, platform_user_id.*\n.*'youtube'/s);
  });

  it('posting handles youtube with refresh in both paths', () => {
    assert.match(postsJs, /case 'youtube'/);
    assert.match(postsJs, /postToYouTube/);
    assert.equal((postsJs.match(/refreshYouTubeTokenIfNeeded\(/g) || []).length, 3);
  });

  it('platforms and frontend meta both list youtube', () => {
    assert.match(platformsJs, /id: 'youtube'/);
    assert.match(frontendJs, /youtube:\s+\{ name: 'YouTube'/);
  });
});
