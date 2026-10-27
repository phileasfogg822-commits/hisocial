// Phase 7: LinkedIn personal + company fix tests.
// node:test only, no new dependency. The helpers are
// pure, so these run without LinkedIn and without a
// database; wiring checks are static, in the Phase 4–6
// style. A live LinkedIn connect/post is an owner step,
// not something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseAclElements,
  normalizeOrgId,
  selectOrgs,
  orgTargetsFromPageAccounts,
} = require('../src/utils/linkedin');

describe('ACL parsing', () => {
  it('extracts numeric org ids from URNs and drops unparseable rows', () => {
    const out = parseAclElements([
      { organization: 'urn:li:organization:12345', 'organization~': { localizedName: 'Acme', vanityName: 'acme' } },
      { organization: 'urn:li:organization:67890', 'organization~': {} },
      { organization: 'pages', 'organization~': {} },
      { organization: null, 'organization~': {} },
    ]);
    assert.deepEqual(out.map((o) => o.id), ['12345', '67890']);
    assert.equal(out[0].localizedName, 'Acme');
  });
});

describe('org id handling', () => {
  it('accepts bare numeric ids and rejects the old bogus fallback', () => {
    assert.equal(normalizeOrgId('12345'), '12345');
    assert.equal(normalizeOrgId('pages'), null);
    assert.equal(normalizeOrgId('organization:12345'), null);
    assert.equal(normalizeOrgId(''), null);
    assert.equal(normalizeOrgId(null), null);
  });

  it('selectOrgs stores all orgs without a preference', () => {
    const orgs = [{ id: '1' }, { id: '2' }];
    assert.deepEqual(selectOrgs(orgs, ''), { orgs, error: null });
    assert.deepEqual(selectOrgs(orgs, null), { orgs, error: null });
  });

  it('selectOrgs with a preference stores only it, and errors when it is not adminned', () => {
    const orgs = [{ id: '1' }, { id: '2' }];
    assert.deepEqual(selectOrgs(orgs, '2'), { orgs: [{ id: '2' }], error: null });
    const missing = selectOrgs(orgs, '9');
    assert.deepEqual(missing.orgs, []);
    assert.match(missing.error, /not among the organizations/);
  });

  it('posting targets come from stored rows, skipping bogus ones', () => {
    assert.deepEqual(
      orgTargetsFromPageAccounts([
        { platform_user_id: '12345' },
        { platform_user_id: 'pages' },
        { platform_user_id: '67890' },
      ]),
      ['organization:12345', 'organization:67890'],
    );
    assert.deepEqual(orgTargetsFromPageAccounts([]), []);
  });
});

describe('linkedin wiring (static)', () => {
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf8');
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');

  it('personal callback no longer hijacks the account with a hardcoded company', () => {
    assert.ok(!authJs.includes('105676582'), 'hardcoded default company id still present');
  });

  it('org callback fails visibly when no orgs are discovered, instead of storing pages', () => {
    assert.match(authJs, /linkedin_org_no_admin_org/);
    assert.ok(!/orgId = 'pages'/.test(authJs), 'bogus pages fallback still present');
    assert.match(authJs, /rw_organization_admin/);
  });

  it('posting builds company targets from stored rows, not the env var', () => {
    assert.match(postsJs, /orgTargetsFromPageAccounts/);
    assert.match(postsJs, /linkedInPageAccounts/);
    const postingBlock = postsJs.slice(postsJs.indexOf('async function listLinkedInTargets'));
    assert.ok(!postingBlock.includes('process.env.LINKEDIN_COMPANY_ID'), 'posting still reads LINKEDIN_COMPANY_ID');
  });
});
