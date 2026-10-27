// Phase 13: per-scope AI assignment resolution.
//
// Scopes, most specific first:
//   1. an explicit provider on the request itself
//      (Compose's provider dropdown — the user's
//      in-the-moment choice always wins),
//   2. the platform-account assignment,
//   3. the account-group assignment,
//   4. the global assignment,
//   5. null — the caller falls back to its registry
//      default (first configured capable provider).
//
// Two deliberate rules:
// - An assignment may name Muse even though Muse is
//   not callable until the Phase 14 queue: it records
//   the user's preference, and generation refuses it
//   plainly (Phase 12 behavior) until the queue lands.
//   Recording it now means Phase 14 honors it without
//   a reconfiguration step.
// - An assignment naming an unconfigured provider is
//   skipped (fall through to the next level), not an
//   error: keys are added and removed at deploy time,
//   and a stale assignment must not break generation.
//   The caller passes the currently-configured ids.
const { getProviderSpec } = require('./aiProviders');

const SCOPE_TYPES = ['global', 'group', 'account'];
const TASK_KINDS = ['text', 'image'];

function validateAssignmentInput(input) {
  const scopeType = String(input.scope_type || '');
  if (!SCOPE_TYPES.includes(scopeType)) {
    return { ok: false, error: `scope_type must be one of: ${SCOPE_TYPES.join(', ')}` };
  }
  const scopeKey = scopeType === 'global' ? 'global' : String(input.scope_key || input.scope_id || '').trim();
  if (scopeType !== 'global' && !scopeKey) {
    return { ok: false, error: 'group and account assignments need a scope id' };
  }
  const taskKind = String(input.task_kind || '');
  if (!TASK_KINDS.includes(taskKind)) {
    return { ok: false, error: `task_kind must be one of: ${TASK_KINDS.join(', ')}` };
  }
  const providerId = String(input.provider_id || '').trim();
  if (!providerId) return { ok: false, error: 'provider_id is required' };
  const spec = getProviderSpec(providerId);
  if (!spec) return { ok: false, error: `Unknown AI provider: ${providerId}` };
  if (taskKind === 'text' && !spec.hasText) {
    return { ok: false, error: `${spec.name} cannot generate text` };
  }
  if (taskKind === 'image' && !spec.hasImage) {
    return { ok: false, error: `${spec.name} cannot generate images` };
  }
  return { ok: true, assignment: { scope_type: scopeType, scope_key: scopeKey, task_kind: taskKind, provider_id: providerId } };
}

// assignments: rows {scope_type, scope_key, task_kind,
// provider_id}. configuredIds: Set of provider ids that
// are configured right now (Muse counts as configured
// for this purpose — it must resolve so generation can
// refuse it plainly, per Phase 12).
function resolveAiProvider({ assignments = [], taskKind, requested = null, accountScopeKey = null, groupScopeKey = null, configuredIds = new Set() }) {
  if (requested) return requested;
  const find = (scopeType, scopeKey) => {
    const row = assignments.find(
      (a) => a.scope_type === scopeType && a.scope_key === scopeKey && a.task_kind === taskKind
    );
    if (!row) return null;
    if (row.provider_id === 'muse') return 'muse';
    if (!configuredIds.has(row.provider_id)) return null;
    return row.provider_id;
  };
  return (
    (accountScopeKey && find('account', accountScopeKey)) ||
    (groupScopeKey && find('group', groupScopeKey)) ||
    find('global', 'global') ||
    null
  );
}

module.exports = {
  SCOPE_TYPES,
  TASK_KINDS,
  validateAssignmentInput,
  resolveAiProvider,
};
