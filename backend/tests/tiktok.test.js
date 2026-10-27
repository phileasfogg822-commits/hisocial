// Phase 9: TikTok connect + direct-post tests.
// node:test only, no new dependency. Post info, chunk
// planning, and the init/status HTTP shapes are pure or
// injected, so these run without TikTok and without a
// database; wiring checks are static, in the Phase 4–8
// style. A live TikTok connect/upload is an owner step,
// not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  TIKTOK_SCOPES,
  CHUNK_SIZE,
  buildPostInfo,
  chunkPlan,
  exchangeCode,
  refreshAccessToken,
  initVideoPost,
  fetchPublishStatus,
} = require('../src/utils/tiktok');

describe('post info', () => {
  it('caps the title at 2200 chars and defaults to SELF_ONLY', () => {
    const meta = buildPostInfo('x'.repeat(3000));
    assert.equal(meta.title.length, 2200);
    assert.equal(meta.privacy_level, 'SELF_ONLY');
    assert.equal(buildPostInfo('').title, 'Untitled video');
  });

  it('requests direct-post scopes, not inbox-only', () => {
    assert.ok(TIKTOK_SCOPES.includes('video.publish'));
    assert.ok(TIKTOK_SCOPES.includes('user.info.basic'));
    assert.ok(!TIKTOK_SCOPES.includes('video.upload'));
  });
});

describe('chunk planning', () => {
  it('splits into 10 MB chunks with correct Content-Range values', () => {
    const plan = chunkPlan(CHUNK_SIZE * 2 + 100);
    assert.equal(plan.length, 3);
    assert.equal(plan[0].range, `bytes 0-${CHUNK_SIZE - 1}/${CHUNK_SIZE * 2 + 100}`);
    assert.equal(plan[2].range, `bytes ${CHUNK_SIZE * 2}-${CHUNK_SIZE * 2 + 99}/${CHUNK_SIZE * 2 + 100}`);
    assert.equal(chunkPlan(0).length, 1);
    assert.equal(chunkPlan(100).length, 1);
  });
});

describe('token flows (injected HTTP)', () => {
  it('exchange posts the authorization code grant with client_key', async () => {
    let seenParams;
    const out = await exchangeCode({
      code: 'code-1', redirectUri: 'http://localhost:4000/auth/tiktok/callback',
      clientKey: 'ck', clientSecret: 'cs',
      httpPost: async (url, params) => {
        seenParams = params;
        assert.equal(url, 'https://open.tiktokapis.com/v2/oauth/token/');
        return { data: { access_token: 'at', refresh_token: 'rt', expires_in: 86400 } };
      },
    });
    assert.equal(seenParams.grant_type, 'authorization_code');
    assert.equal(seenParams.client_key, 'ck');
    assert.equal(out.expires_in, 86400);
  });

  it('refresh posts the refresh grant and throws without an access token', async () => {
    const out = await refreshAccessToken({
      refreshToken: 'rt', clientKey: 'ck', clientSecret: 'cs',
      httpPost: async (url, params) => {
        assert.equal(params.grant_type, 'refresh_token');
        return { data: { access_token: 'at2', refresh_token: 'rt2', expires_in: 86400 } };
      },
    });
    assert.equal(out.accessToken, 'at2');
    assert.equal(out.refreshToken, 'rt2');
    await assert.rejects(
      refreshAccessToken({
        refreshToken: 'rt', clientKey: 'ck', clientSecret: 'cs',
        httpPost: async () => ({ data: {} }),
      }),
      /no access_token/,
    );
  });
});

describe('video init and status (injected HTTP)', () => {
  it('init sends FILE_UPLOAD source info and returns publish_id + upload_url', async () => {
    let seenBody;
    const out = await initVideoPost({
      accessToken: 'at',
      postInfo: buildPostInfo('Hello'),
      videoSize: CHUNK_SIZE + 5,
      httpPost: async (url, data, headers) => {
        seenBody = data;
        assert.equal(url, 'https://open.tiktokapis.com/v2/post/publish/video/init/');
        assert.equal(headers.Authorization, 'Bearer at');
        return { data: { data: { publish_id: 'pub1', upload_url: 'https://upload.example/1' } } };
      },
    });
    assert.equal(seenBody.source_info.source, 'FILE_UPLOAD');
    assert.equal(seenBody.source_info.video_size, CHUNK_SIZE + 5);
    assert.equal(seenBody.source_info.total_chunk_count, 2);
    assert.equal(seenBody.post_info.privacy_level, 'SELF_ONLY');
    assert.equal(out.publishId, 'pub1');
  });

  it('init throws when publish_id or upload_url is missing', async () => {
    await assert.rejects(
      initVideoPost({
        accessToken: 'at', postInfo: buildPostInfo('Hi'), videoSize: 100,
        httpPost: async () => ({ data: { data: {} } }),
      }),
      /publish_id and upload_url/,
    );
  });

  it('status fetch posts the publish_id', async () => {
    const out = await fetchPublishStatus({
      accessToken: 'at', publishId: 'pub1',
      httpPost: async (url, data) => {
        assert.equal(url, 'https://open.tiktokapis.com/v2/post/publish/status/fetch/');
        assert.equal(data.publish_id, 'pub1');
        return { data: { data: { status: 'PUBLISH_COMPLETE' } } };
      },
    });
    assert.equal(out.status, 'PUBLISH_COMPLETE');
  });
});

describe('tiktok wiring (static)', () => {
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf8');
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const platformsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'platforms.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('tiktok connect uses its own OAuth route and stores a tiktok row', () => {
    assert.match(authJs, /router\.get\('\/tiktok'/);
    assert.match(authJs, /tiktok\.com\/v2\/auth\/authorize/);
    assert.match(authJs, /'tiktok'/);
  });

  it('posting handles tiktok with refresh in both paths', () => {
    assert.match(postsJs, /case 'tiktok'/);
    assert.match(postsJs, /postToTikTok/);
    assert.equal((postsJs.match(/refreshTikTokTokenIfNeeded\(/g) || []).length, 3);
  });

  it('platforms and frontend meta both list tiktok', () => {
    assert.match(platformsJs, /id: 'tiktok'/);
    assert.match(frontendJs, /tiktok:\s+\{ name: 'TikTok'/);
  });
});
