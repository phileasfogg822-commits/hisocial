// Phase 21: daily snapshot aggregation (pure).
//
// A snapshot is one row per user, per day, per
// platform: how many posts were published, how many
// failed, and how many posts were created that day.
// It is built from the app's own tables only — no
// platform API calls. Engagement (likes/comments)
// stays live in /engagement; snapshot engagement
// columns are later work (Phase 22), not invented
// numbers.
//
// Inputs are plain row arrays so the aggregation is
// testable without a database:
// - platformPosts: {platform, status, posted_at}
//   (posted_at may be null for failures — those
//   count by created ordering instead, see below).
// - posts: {platforms[], created_at}.
// A platform_post counts as published/failed on the
// day of its posted_at when present, else on the day
// the caller assigns (the builder passes rows already
// filtered to the target day, so the date itself is
// not re-derived here).
function buildSnapshotRows({ platformPosts = [], posts = [] } = {}) {
  const byPlatform = new Map();
  const rowFor = (platform) => {
    if (!byPlatform.has(platform)) {
      byPlatform.set(platform, { platform, published_count: 0, failed_count: 0, posts_created: 0 });
    }
    return byPlatform.get(platform);
  };
  for (const pp of platformPosts) {
    if (!pp.platform) continue;
    const row = rowFor(pp.platform);
    if (pp.status === 'success') row.published_count += 1;
    else if (pp.status === 'failed') row.failed_count += 1;
  }
  for (const post of posts) {
    for (const platform of (Array.isArray(post.platforms) ? post.platforms : [])) {
      rowFor(platform).posts_created += 1;
    }
  }
  return [...byPlatform.values()].sort((a, b) => a.platform.localeCompare(b.platform));
}

module.exports = { buildSnapshotRows };
