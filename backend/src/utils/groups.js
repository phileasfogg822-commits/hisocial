// Phase 4: account-group rules, kept pure so they are
// unit-testable without a database.
//
// Model: a group belongs to one app user (its owner). A social
// account belongs to at most one group (social_accounts.group_id).
// A group holds many accounts; an account's group is only a
// grouping, it never changes who owns the account or its token.
// Assigning an account to a group owned by a different user is
// never allowed — the API returns 404 in that case, so one user
// cannot even probe another user's groups or accounts.
const MAX_GROUP_NAME_LENGTH = 100;

function validateGroupName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: 'Group name is required' };
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) {
    return { ok: false, error: 'Group name must be 100 characters or fewer' };
  }
  return { ok: true, name: trimmed };
}

function canAssignAccount({ accountUserId, groupUserId, accountActive }) {
  if (!accountUserId || !groupUserId) return false;
  if (String(accountUserId) !== String(groupUserId)) return false;
  if (accountActive === false) return false;
  return true;
}

module.exports = {
  MAX_GROUP_NAME_LENGTH,
  validateGroupName,
  canAssignAccount,
};
