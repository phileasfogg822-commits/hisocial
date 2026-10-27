// Phase 4: account-group rules and wiring tests.
// node:test only, no new dependency. The rules are pure, so
// these run without a database; the wiring checks are static
// file checks, in the same style as the Phase 2 schema-parity
// tests. Live group CRUD against Postgres is proven only by
// the CI Docker backend, not by these tests.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { validateGroupName, canAssignAccount } = require('../src/utils/groups');

describe('group rules', () => {
  it('validateGroupName trims and accepts a normal name', () => {
    assert.deepEqual(validateGroupName('  English video  '), { ok: true, name: 'English video' });
  });

  it('validateGroupName rejects empty and over-long names', () => {
    assert.equal(validateGroupName('').ok, false);
    assert.equal(validateGroupName('   ').ok, false);
    assert.equal(validateGroupName('x'.repeat(101)).ok, false);
    assert.equal(validateGroupName('x'.repeat(100)).ok, true);
  });

  it('canAssignAccount requires same owner and an active account', () => {
    assert.equal(canAssignAccount({ accountUserId: 'u1', groupUserId: 'u1', accountActive: true }), true);
    assert.equal(canAssignAccount({ accountUserId: 'u1', groupUserId: 'u2', accountActive: true }), false);
    assert.equal(canAssignAccount({ accountUserId: 'u1', groupUserId: 'u1', accountActive: false }), false);
    assert.equal(canAssignAccount({ accountUserId: null, groupUserId: 'u1', accountActive: true }), false);
  });
});

describe('group wiring (static parity)', () => {
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const groupsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'groups.js'), 'utf8');
  const passportJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'passport.js'), 'utf8');
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf8');

  it('both init.sql and runMigrations() create account_groups', () => {
    assert.match(initSql, /CREATE TABLE IF NOT EXISTS account_groups/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS account_groups/);
    assert.match(initSql, /UNIQUE \(user_id, name\)/);
  });

  it('social_accounts carries group_id in both files, with SET NULL on group delete', () => {
    assert.match(initSql, /group_id UUID REFERENCES account_groups\(id\) ON DELETE SET NULL/);
    assert.match(indexJs, /ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES account_groups\(id\) ON DELETE SET NULL/);
  });

  it('uniqueness is per platform account, not per platform, in both files', () => {
    assert.match(initSql, /UNIQUE \(user_id, platform, platform_user_id\)/);
    assert.match(indexJs, /UNIQUE \(user_id, platform, platform_user_id\)/);
    assert.doesNotMatch(initSql, /UNIQUE \(user_id, platform\)\s*\)/);
  });

  it('runMigrations() drops the old constraint and adds the new one idempotently', () => {
    assert.match(indexJs, /DROP CONSTRAINT IF EXISTS social_accounts_user_id_platform_key/);
    assert.match(indexJs, /social_accounts_user_platform_account_key/);
    assert.match(indexJs, /EXCEPTION WHEN duplicate_object/);
  });

  it('every social-account upsert uses the new conflict target', () => {
    const combined = passportJs + '\n' + authJs;
    const oldSites = (combined.match(/ON CONFLICT \(user_id, platform\)/g) || []).length;
    const newSites = (combined.match(/ON CONFLICT \(user_id, platform, platform_user_id\)/g) || []).length;
    assert.equal(oldSites, 0);
    assert.equal(newSites, 7);
  });

  it('groups routes are mounted and guarded by a selected profile', () => {
    assert.match(indexJs, /app\.use\('\/api\/groups', require\('\.\/routes\/groups'\)\)/);
    assert.match(groupsJs, /if \(!req\.user\) return res\.status\(401\)/);
    assert.match(groupsJs, /router\.get\('\/', requireProfile/);
    assert.match(groupsJs, /router\.post\('\/:id\/accounts', requireProfile/);
  });
});
