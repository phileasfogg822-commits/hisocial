// Phase 22: insights comparison tests.
// node:test only, no new dependency. Aggregation is
// pure; wiring checks are static, in the Phase 4–21
// style. A live comparison is an owner step (needs a
// running instance with post history), not something
// CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { comparePosts } = require('../src/utils/insights');

describe('comparison aggregation', () => {
  const rows = [
    { post_id: 'p1', language: 'en', group_name: 'English video', platforms: ['facebook'], pp_platform: 'facebook', pp_status: 'success' },
    { post_id: 'p1', language: 'en', group_name: 'English video', platforms: ['facebook'], pp_platform: 'instagram', pp_status: 'failed' },
    { post_id: 'p2', language: 'ur', group_name: null, platforms: ['facebook', 'tiktok'], pp_platform: 'facebook', pp_status: 'success' },
    { post_id: 'p3', language: null, group_name: null, platforms: ['tiktok'], pp_platform: null, pp_status: null },
  ];

  it('compares by language without double-counting posts', () => {
    const out = comparePosts(rows, 'language');
    const en = out.find((r) => r.key === 'en');
    const ur = out.find((r) => r.key === 'ur');
    const unknown = out.find((r) => r.key === 'unknown');
    assert.equal(en.posts_created, 1);
    assert.equal(en.published, 1);
    assert.equal(en.failed, 1);
    assert.equal(ur.posts_created, 1);
    assert.equal(ur.published, 1);
    assert.equal(unknown.posts_created, 1);
  });

  it('compares by group and by platform', () => {
    const byGroup = comparePosts(rows, 'group');
    assert.equal(byGroup.find((r) => r.key === 'English video').posts_created, 1);
    assert.equal(byGroup.find((r) => r.key === 'ungrouped').posts_created, 2);
    const byPlatform = comparePosts(rows, 'platform');
    assert.equal(byPlatform.find((r) => r.key === 'facebook').posts_created, 2);
    assert.equal(byPlatform.find((r) => r.key === 'facebook').published, 2);
    assert.equal(byPlatform.find((r) => r.key === 'tiktok').posts_created, 2);
  });
});

describe('insights wiring (static)', () => {
  const analyticsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'analytics.js'), 'utf8');
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('compare + audience endpoints and language storage exist', () => {
    assert.match(analyticsJs, /\/compare/);
    assert.match(analyticsJs, /\/audience/);
    assert.match(postsJs, /language must be 'en' or 'ur'/);
    assert.match(indexJs, /ADD COLUMN IF NOT EXISTS language/);
  });

  it('analytics view offers comparisons and audience', () => {
    assert.match(frontendJs, /api\/analytics\/compare/);
    assert.match(frontendJs, /api\/analytics\/audience/);
    assert.match(frontendJs, /Insights: Compare/);
  });
});
