// museQueueLogic.js — pure, dependency-free helpers for the Muse bridge queue.
// Kept separate from the Express router so it can be unit-tested without
// Express, Postgres, or any other service running.
// Lease model (mirrors the CinePulse pattern): a job is claimed for 15
// minutes. If the worker does not heartbeat or submit within the lease,
// the job returns to `queued` and may be claimed again. No job is ever
// claimed twice while its lease is live.

const LEASE_MS = 15 * 60 * 1000;
const VALID_KINDS = new Set(['image', 'text']);
const VALID_STATUSES = new Set(['queued', 'leased', 'done', 'error']);

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
  isValidKind,
  isLeaseExpired,
  isClaimable,
  validateJobInput,
  tokensMatch,
};
