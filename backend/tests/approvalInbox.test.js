// Phase 18: supervised approval inbox tests.
// node:test only, no new dependency. Approval rules are
// pure; wiring checks are static, in the Phase 4–17
// style. A live approve/reject cycle is an owner step
// (needs a running instance + platform tokens), not
// something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isApprovalDue,
  canDecideApproval,
} = require('../src/utils/scheduler');

describe('approval rules', () => {
  const now = Date.now();
  const past = new Date(now - 60000).toISOString();
  const future = new Date(now + 60000).toISOString();

  it('only due supervised posts move to the inbox', () => {
    assert.equal(isApprovalDue({ requires_approval: true, status: 'scheduled', scheduled_at: past }, now), true);
    assert.equal(isApprovalDue({ requires_approval: true, status: 'scheduled', scheduled_at: future }, now), false);
    assert.equal(isApprovalDue({ requires_approval: false, status: 'scheduled', scheduled_at: past }, now), false);
    assert.equal(isApprovalDue({ requires_approval: true, status: 'awaiting_approval', scheduled_at: past }, now), false);
  });

  it('only awaiting posts can be approved or rejected', () => {
    assert.equal(canDecideApproval({ status: 'awaiting_approval' }), true);
    assert.equal(canDecideApproval({ status: 'scheduled' }), false);
    assert.equal(canDecideApproval({ status: 'published' }), false);
  });
});

describe('approval wiring (static)', () => {
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('scheduler routes supervised posts to the inbox, never auto-publishes them', () => {
    assert.match(postsJs, /awaiting_approval/);
    assert.match(postsJs, /requires_approval = true/);
    assert.match(postsJs, /requires_approval = false/);
  });

  it('approve publishes, failure returns to the inbox, reject is terminal', () => {
    assert.match(postsJs, /\/:postId\/approve/);
    assert.match(postsJs, /\/:postId\/reject/);
    assert.match(postsJs, /status='rejected'/);
    assert.match(postsJs, /\/approval/);
  });

  it('column exists in init.sql and runMigrations', () => {
    assert.match(initSql, /requires_approval BOOLEAN/);
    assert.match(indexJs, /ADD COLUMN IF NOT EXISTS requires_approval/);
  });

  it('inbox view and calendar approval checkbox exist', () => {
    assert.match(frontendJs, /ApprovalInboxView/);
    assert.match(frontendJs, /api\/posts\/approval/);
    assert.match(frontendJs, /Approve & Publish/);
    assert.match(frontendJs, /Needs my approval before publishing/);
  });
});
