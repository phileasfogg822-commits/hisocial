// Phase 20: video pipeline tests.
// node:test only, no new dependency. Readiness rules
// are pure; wiring checks are static, in the Phase 4–19
// style. A live video publish is an owner step (needs
// platform tokens + a real video file), not something
// CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  videoUrlsOf,
  checkPlatform,
  validateVideoPost,
} = require('../src/utils/videoPipeline');

const VIDEO = 'https://example.com/clip.mp4';
const IMAGE = 'https://example.com/pic.jpg';

describe('video readiness rules', () => {
  it('finds video URLs by extension, ignoring query strings', () => {
    assert.deepEqual(videoUrlsOf([IMAGE, `${VIDEO}?x=1`]), [`${VIDEO}?x=1`]);
    assert.deepEqual(videoUrlsOf([IMAGE]), []);
  });

  it('youtube and tiktok need a video, x allows at most one', () => {
    assert.equal(checkPlatform('youtube', []).status, 'blocked');
    assert.equal(checkPlatform('youtube', [VIDEO]).status, 'ready');
    assert.equal(checkPlatform('tiktok', []).status, 'blocked');
    assert.equal(checkPlatform('tiktok', [VIDEO]).status, 'ready');
    assert.equal(checkPlatform('twitter', [VIDEO, VIDEO]).status, 'blocked');
    assert.equal(checkPlatform('twitter', [VIDEO]).status, 'ready');
  });

  it('pinterest video is blocked, other platforms are unchecked not blocked', () => {
    assert.equal(checkPlatform('pinterest', [VIDEO]).status, 'blocked');
    assert.equal(checkPlatform('pinterest', []).status, 'ready');
    assert.equal(checkPlatform('facebook', [VIDEO]).status, 'unchecked');
    assert.equal(checkPlatform('instagram', [VIDEO]).status, 'unchecked');
  });

  it('a post is ready only when nothing is blocked', () => {
    assert.equal(validateVideoPost({ platforms: ['youtube', 'tiktok'], mediaUrls: [VIDEO] }).ready, true);
    assert.equal(validateVideoPost({ platforms: ['youtube', 'pinterest'], mediaUrls: [VIDEO] }).ready, false);
    assert.equal(validateVideoPost({ platforms: ['youtube', 'pinterest'], mediaUrls: [VIDEO] }).blocked.length, 1);
    assert.equal(validateVideoPost({ platforms: ['youtube'], mediaUrls: [IMAGE] }).ready, false);
  });
});

describe('video pipeline wiring (static)', () => {
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('readiness endpoint exists and creation fails fast on blocked video', () => {
    assert.match(postsJs, /\/validate-video/);
    assert.match(postsJs, /validateVideoPost/);
    assert.match(postsJs, /Video post is not ready for every platform/);
  });

  it('compose offers a video readiness check', () => {
    assert.match(frontendJs, /api\/posts\/validate-video/);
    assert.match(frontendJs, /Video readiness/);
    assert.match(frontendJs, /Check video readiness/);
  });
});
