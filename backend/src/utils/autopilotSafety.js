// Phase 19: autopilot safety rules.
//
// The old autopilot had one gate (once per day) and
// logged failures forever without ever stopping. The
// safety rules:
// - Kill switch: a single DB flag. When killed, NO
//   run starts — not the sweep, not a manual run-now,
//   not even a forced run. Kill is the emergency stop
//   and outranks everything, including force.
// - Daily cap: the day's autopilot posts are counted
//   from the posts table before scheduling more, so a
//   force run cannot push the day past posts_per_day
//   (which itself clamps to 1–5).
// - Consecutive failures: after MAX_CONSECUTIVE_
//   FAILURES failed runs in a row, the config auto-
//   disables with a recorded reason. It takes an
//   explicit re-enable to run again — a failing
//   autopilot must not burn provider quota daily.
// - Per-post failures: one bad generation inside a
//   run fails that post, not the whole run. The run
//   reports 'partial' when some posts scheduled and
//   some failed.
const MAX_CONSECUTIVE_FAILURES = 3;
const DAILY_CAP_MAX = 5;

// Returns a skip reason string, or null when the run
// may proceed. Kill beats everything, including force.
function shouldSkipRun({ killed, enabled, force, lastRunOn, today }) {
  if (killed) return 'killed';
  if (!enabled && !force) return 'disabled';
  if (!force && lastRunOn && String(lastRunOn).slice(0, 10) === today) return 'already-ran-today';
  return null;
}

// How many more autopilot posts the day allows.
function remainingForToday(todayCount, postsPerDay) {
  const cap = Math.max(1, Math.min(DAILY_CAP_MAX, Number(postsPerDay) || 1));
  return Math.max(0, cap - (Number(todayCount) || 0));
}

// After a failed run: the new consecutive count, and
// whether the config must auto-disable.
function afterFailure(consecutiveFailures) {
  const next = (Number(consecutiveFailures) || 0) + 1;
  return { consecutiveFailures: next, shouldDisable: next >= MAX_CONSECUTIVE_FAILURES };
}

module.exports = {
  MAX_CONSECUTIVE_FAILURES,
  DAILY_CAP_MAX,
  shouldSkipRun,
  remainingForToday,
  afterFailure,
};
