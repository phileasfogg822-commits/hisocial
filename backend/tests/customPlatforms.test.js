// Phase 11: generic platform connector tests.
// node:test only, no new dependency. Validation and the
// request builder are pure; wiring checks are static,
// in the Phase 4–10 style. Live posting to a real custom
// platform is an owner step, not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateSlug,
  validateCustomPlatform,
  tierCanPost,
  buildPostRequest,
  customPlatformId,
  isCustomPlatformId,
} = require('../src/utils/customPlatforms');

describe('slug and platform validation', () => {
  it('accepts a clean slug and lowercases it', () => {
    assert.deepEqual(validateSlug('My-Blog_1'), { ok: true, slug: 'my-blog_1' });
  });

  it('rejects bad slugs, bad tiers, and non-http base URLs', () => {
    assert.equal(validateSlug('a').ok, false);
    assert.equal(validateSlug('Bad Slug').ok, false);
    assert.equal(validateCustomPlatform({ name: 'X', slug: 'x1', tier: 'super', base_url: 'https://e.com' }).ok, false);
    assert.equal(validateCustomPlatform({ name: 'X', slug: 'x1', tier: 'full', base_url: 'example.com' }).ok, false);
    assert.equal(validateCustomPlatform({ name: 'X', slug: 'x1', tier: 'full', base_url: 'https://e.com', post_path: 'api/posts' }).ok, false);
    assert.equal(validateCustomPlatform({ name: 'X', slug: 'x1', tier: 'full', base_url: 'https://e.com', post_path: '/api/posts', auth_type: 'header' }).ok, false);
  });

  it('accepts all three tiers with the right shape', () => {
    const full = validateCustomPlatform({ name: 'Blog', slug: 'blog', tier: 'full', base_url: 'https://e.com/', post_path: '/api/posts' });
    assert.equal(full.ok, true);
    assert.equal(full.platform.base_url, 'https://e.com');
    assert.equal(validateCustomPlatform({ name: 'Blog', slug: 'blog', tier: 'readonly', base_url: 'https://e.com' }).ok, true);
    assert.equal(validateCustomPlatform({ name: 'Blog', slug: 'blog', tier: 'manual', base_url: 'https://e.com' }).ok, true);
    assert.equal(tierCanPost('full'), true);
    assert.equal(tierCanPost('readonly'), false);
    assert.equal(tierCanPost('manual'), false);
  });
});

describe('post request building', () => {
  it('builds a bearer request with content and media', () => {
    const req = buildPostRequest(
      { base_url: 'https://e.com', post_path: '/api/posts', api_key: 'k1', auth_type: 'bearer' },
      'Hello', ['https://e.com/img.jpg']
    );
    assert.equal(req.url, 'https://e.com/api/posts');
    assert.equal(req.headers.Authorization, 'Bearer k1');
    assert.deepEqual(req.body, { content: 'Hello', media_urls: ['https://e.com/img.jpg'] });
  });

  it('builds a custom-header request', () => {
    const req = buildPostRequest(
      { base_url: 'https://e.com', post_path: '/p', api_key: 'k2', auth_type: 'header', auth_header: 'X-API-Key' },
      'Hi', []
    );
    assert.equal(req.headers['X-API-Key'], 'k2');
    assert.equal(req.headers.Authorization, undefined);
  });
});

describe('custom platform ids and wiring (static)', () => {
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('ids are namespaced so they cannot collide with built-ins', () => {
    assert.equal(customPlatformId('blog'), 'custom_blog');
    assert.equal(isCustomPlatformId('custom_blog'), true);
    assert.equal(isCustomPlatformId('facebook'), false);
  });

  it('posting routes custom ids before the token check, in both paths', () => {
    assert.match(postsJs, /isCustomPlatformId\(platform\)/);
    assert.match(postsJs, /postToCustom\(def, content, mediaUrls\)/);
    assert.ok((postsJs.match(/^\s+customPlatforms$/gm) || []).length >= 2, 'both paths pass the custom map');
    assert.match(postsJs, /tier === 'manual'/);
    assert.match(postsJs, /tier === 'readonly'/);
  });

  it('table exists in init.sql and runMigrations, route is mounted', () => {
    assert.match(initSql, /CREATE TABLE IF NOT EXISTS custom_platforms/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS custom_platforms/);
    assert.match(indexJs, /routes\/customPlatforms/);
  });

  it('frontend manages custom platforms and merges them into compose', () => {
    assert.match(frontendJs, /CustomPlatformsView/);
    assert.match(frontendJs, /api\/custom-platforms/);
    assert.match(frontendJs, /loadCustomPlatforms/);
    assert.match(frontendJs, /GenericIcon/);
  });
});
