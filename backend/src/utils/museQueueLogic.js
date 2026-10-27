// Phase 14: Muse bridge queue helpers, ported from the
// Phase 0 instance template (which proved this shape)
// and extended with approval + fallback transitions.
//
// Lease model (mirrors the CinePulse pattern): a job is
// claimed for 15 minutes. If the worker does not
// heartbeat or submit within the lease, the job returns
// to `queued` and may be claimed again. No job is ever
// claimed twice while its lease is live.
//
// Approval: a done image job is NOT usable until its
// owner approves it (approval 'pending' -> 'approved' /
// 'rejected'). Rejected or errored jobs may request a
// fallback to a configured API image provider.
// Allowance rule (CinePulse boundary): a worker that
// runs out of allowance submits status 'error' with
// error_message starting 'MUSE_ALLOWANCE_EXHAUSTED: '
// and stops claiming; the app records it, nothing more.
const LEASE_MS = 15 * 60 * 1000;
const VALID_KINDS = new Set(['image', 'text']);
const VALID_STATUSES = new Set(['queued', 'leased', 'done', 'error']);
const VALID_APPROVALS = new Set(['pending', 'approved', 'rejected']);

function isValidKind(kind) {
  return VALID_KINDS.has(kind);
}

function isLeaseExpired(job, nowMs) {
  if (!job || job.status !== 'leased') return false;
  if (!job.lease_expires_at) return true;
  const expires = new Date(job.lease_expires_at).getTime();
  if (Number.isNaN(expires)) return true;
  return expires <= nowMs;
}

// A job is claimable when it is queued, or leased with an expired lease.
// It is NOT claimable when leased with a live lease, done, or errored.
function isClaimable(job, nowMs) {
  if (!job) return false;
  if (job.status === 'queued') return true;
  if (job.status === 'leased') return isLeaseExpired(job, nowMs);
  return false;
}

// Validate a job-creation payload. Returns an error string, or null.
function validateJobInput(body) {
  if (!body || typeof body !== 'object') return 'body is required';
  if (!isValidKind(body.kind)) return 'kind must be image or text';
  if (!body.prompt || !String(body.prompt).trim()) return 'prompt is required';
  if (body.prompt.length > 8000) return 'prompt is too long (max 8000 chars)';
  if (body.language && String(body.language).length > 10) {
    return 'language is too long (max 10 chars)';
  }
  return null;
}

// Only a done job with pending approval can be approved
// or rejected. Approving twice, or approving an errored
// job, is a no-op the route refuses, not a silent pass.
function canApprove(job) {
  return Boolean(job) && job.status === 'done' && job.approval === 'pending';
}

// Fallback is for jobs Muse did not deliver: errored, or
// done-but-rejected by the owner. A queued job must not
// fall back — the worker may still be working on it.
function canRequestFallback(job) {
  if (!job) return false;
  if (job.status === 'error') return true;
  if (job.status === 'done' && job.approval === 'rejected') return true;
  return false;
}

// Constant-time-ish bridge-token comparison that never throws on length
// mismatch. The router still requires a configured token first; this helper
// only compares two non-empty strings safely.
function tokensMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  if (expected.length !== supplied.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  return diff === 0;
}

module.exports = {
  LEASE_MS,
  VALID_KINDS,
  VALID_STATUSES,
  VALID_APPROVALS,
  isValidKind,
  isLeaseExpired,
  isClaimable,
  validateJobInput,
  canApprove,
  canRequestFallback,
  tokensMatch,
};
