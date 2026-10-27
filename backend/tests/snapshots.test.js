// Phase 21: daily snapshot tests.
// node:test only, no new dependency. Aggregation is
// pure; wiring checks are static, in the Phase 4–20
// style. A live snapshot build is an owner step (needs
// a running instance with post history), not something
// CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildSnapshotRows } = require('../src/utils/snapshots');

describe('snapshot aggregation', () => {
  it('counts published, failed, and created per platform', () => {
    const rows = buildSnapshotRows({
      platformPosts: [
        { platform: 'facebook', status: 'success' },
        { platform: 'facebook', status: 'success' },
        { platform: 'facebook', status: 'failed' },
        { platform: 'instagram', status: 'success' },
      ],
      posts: [
        { platforms: ['facebook', 'instagram'] },
        { platforms: ['facebook'] },
      ],
    });
    const fb = rows.find((r) => r.platform === 'facebook');
    const ig = rows.find((r) => r.platform === 'instagram');
    assert.equal(fb.published_count, 2);
    assert.equal(fb.failed_count, 1);
    assert.equal(fb.posts_created, 2);
    assert.equal(ig.published_count, 1);
    assert.equal(ig.posts_created, 1);
  });

  it('ignores non-success/failed platform rows and empty platform lists', () => {
    const rows = buildSnapshotRows({
      platformPosts: [{ platform: 'linkedin', status: 'processing' }],
      posts: [{ platforms: [] }, {}],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].published_count, 0);
    assert.equal(rows[0].failed_count, 0);
  });
});

describe('snapshot wiring (static)', () => {
  const analyticsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'analytics.js'), 'utf8');
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('snapshot endpoints, table, and scheduler hook exist', () => {
    assert.match(analyticsJs, /\/snapshots/);
    assert.match(analyticsJs, /snapshots\/build/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS analytics_daily_snapshots/);
    assert.match(postsJs, /ensureYesterdaySnapshots/);
  });

  it('analytics view shows snapshots and can rebuild', () => {
    assert.match(frontendJs, /api\/analytics\/snapshots/);
    assert.match(frontendJs, /Daily Snapshots/);
    assert.match(frontendJs, /Build yesterday snapshot/);
  });
});
