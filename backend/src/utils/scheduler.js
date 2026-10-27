// Phase 17: durable scheduler helpers.
//
// The old scheduler was a 60-second in-memory loop with
// two durability holes: a post that failed stayed
// 'failed' forever with no retry, and a post stuck in
// 'posting' (crash mid-publish) stayed there forever.
// The durable rules:
// - A failed attempt is retried with exponential
//   backoff (60s, 2m, 4m, 8m, 16m, capped at 1h),
//   up to MAX_ATTEMPTS attempts; then it is terminal.
// - A 'posting' post whose updated_at is older than
//   STUCK_AFTER_MS is presumed crashed and returns to
//   'scheduled' (or 'failed' if attempts are spent).
// - 'partial' is terminal: some platforms published,
//   and retrying would duplicate those posts. Only
//   all-failed and exception failures retry.
// - All claiming stays atomic (UPDATE ... WHERE
//   status='scheduled'), so two workers or two ticks
//   cannot publish the same post twice.
const MAX_ATTEMPTS = 5;
const STUCK_AFTER_MS = 10 * 60 * 1000;
const BASE_DELAY_MS = 60 * 1000;
const MAX_DELAY_MS = 60 * 60 * 1000;

function computeBackoffMs(attempts) {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
}

// A post is due when it is scheduled, its time has
// come, and no retry delay is still running.
function isDue(post, nowMs) {
  if (!post || post.status !== 'scheduled') return false;
  if (!post.scheduled_at) return false;
  if (new Date(post.scheduled_at).getTime() > nowMs) return false;
  if (post.next_attempt_at && new Date(post.next_attempt_at).getTime() > nowMs) return false;
  return true;
}

// A post is stuck when it was claimed for posting but
// has not been updated within the stuck window.
function isStuckPost(post, nowMs) {
  if (!post || post.status !== 'posting') return false;
  if (!post.updated_at) return true;
  return nowMs - new Date(post.updated_at).getTime() > STUCK_AFTER_MS;
}

// Outcome of a failed attempt: retry with a delay, or
// terminal failure once attempts are spent.
function nextAttemptAfterFailure(attempts) {
  if (attempts >= MAX_ATTEMPTS) return { terminal: true, delayMs: null };
  return { terminal: false, delayMs: computeBackoffMs(attempts) };
}

module.exports = {
  MAX_ATTEMPTS,
  STUCK_AFTER_MS,
  BASE_DELAY_MS,
  MAX_DELAY_MS,
  computeBackoffMs,
  isDue,
  isStuckPost,
  nextAttemptAfterFailure,
};
