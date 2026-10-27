// Phase 7: LinkedIn personal + company fix, pure helpers.
//
// The failure chain this phase breaks:
// 1. The company connect asked only for
//    w_organization_social, but discovering admin'd pages
//    via organizationAcls needs a read scope — so the
//    lookup failed, was caught silently, and the callback
//    stored a bogus page account with id 'pages' while
//    redirecting as if it had succeeded.
// 2. Posting ignored stored page accounts entirely and
//    used a LINKEDIN_COMPANY_ID env var instead — unset
//    meant no company target at all, wrong meant posting
//    to an org the token may not administer.
// 3. The personal connect hardcoded a default company id
//    and, when that org happened to be admin'd, stored
//    the ORGANIZATION as the personal account id —
//    corrupting personal posting too.
//
// The fix: personal accounts always store the person id;
// company accounts are stored one row per admin'd org
// (Phase 4 multi-account supports this); posting builds
// company targets from those stored rows, never from an
// env var; and a company connect that discovers no orgs
// fails visibly instead of storing a bogus row.

// Parse organizationAcls elements into { id, localizedName,
// vanityName }. The organization field is a URN like
// 'urn:li:organization:12345'; anything unparseable is
// dropped, never stored as a target.
function parseAclElements(elements) {
  return (elements || [])
    .map((el) => {
      const urn = el.organization;
      const id = typeof urn === 'string' ? urn.split(':').pop() : null;
      const profile = el['organization~'] || {};
      return {
        id: id && /^\d+$/.test(id) ? id : null,
        localizedName: profile.localizedName || null,
        vanityName: profile.vanityName || null,
      };
    })
    .filter((org) => Boolean(org.id));
}

// A stored page-account id is valid only if it is a bare
// numeric org id. 'pages' (the old bogus fallback) and
// 'organization:123' forms are not valid stored ids.
function normalizeOrgId(value) {
  const raw = String(value || '').trim();
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

// Choose which discovered orgs to store. With no
// preference, store all of them. With a preference
// (LINKEDIN_COMPANY_ID), store only it — and report an
// error when it is not among the admin'd orgs, instead
// of silently falling back to a different org.
function selectOrgs(orgs, preferredId) {
  const wanted = String(preferredId || '').trim();
  if (!wanted) return { orgs, error: null };
  const found = orgs.find((o) => o.id === wanted);
  if (!found) {
    return {
      orgs: [],
      error: `Configured company ${wanted} is not among the organizations this account administers`,
    };
  }
  return { orgs: [found], error: null };
}

// Company targets for posting, from stored page-account
// rows. Invalid stored ids (e.g. the old 'pages' rows)
// are skipped, so a legacy bogus row cannot break
// posting for the valid ones.
function orgTargetsFromPageAccounts(pageAccounts) {
  return (pageAccounts || [])
    .map((account) => normalizeOrgId(account.platform_user_id ?? account.id))
    .filter(Boolean)
    .map((id) => `organization:${id}`);
}

module.exports = {
  parseAclElements,
  normalizeOrgId,
  selectOrgs,
  orgTargetsFromPageAccounts,
};
