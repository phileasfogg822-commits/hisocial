// Phase 22: insights comparisons (pure).
//
// Compares the user's own posting record along one
// dimension at a time: language (en / ur / unknown),
// group (group name / ungrouped), or platform.
// Rows come from one joined query (posts + their
// platform_posts); the aggregation here is pure so
// it is testable without a database.
//
// Counts per key:
// - posts_created: distinct posts in the key.
// - published: platform_posts with status 'success'.
// - failed: platform_posts with status 'failed'.
// For the platform dimension, a post counts as
// created under every platform in its platforms
// array; published/failed count under the platform
// of the platform_post row. For language/group, a
// post counts once, under its own language/group.
function comparePosts(rows, dimension) {
  const byKey = new Map();
  const rowFor = (key) => {
    if (!byKey.has(key)) {
      byKey.set(key, { key, posts_created: 0, published: 0, failed: 0 });
    }
    return byKey.get(key);
  };
  const seenPosts = new Set();
  for (const row of rows) {
    if (dimension === 'platform') {
      const postKey = row.post_id;
      if (postKey && !seenPosts.has(postKey)) {
        seenPosts.add(postKey);
        for (const platform of (Array.isArray(row.platforms) ? row.platforms : [])) {
          rowFor(platform).posts_created += 1;
        }
      }
      if (row.pp_platform) {
        const target = rowFor(row.pp_platform);
        if (row.pp_status === 'success') target.published += 1;
        else if (row.pp_status === 'failed') target.failed += 1;
      }
      continue;
    }
    const key = dimension === 'language'
      ? (row.language || 'unknown')
      : (row.group_name || 'ungrouped');
    const target = rowFor(key);
    if (row.post_id && !seenPosts.has(row.post_id)) {
      seenPosts.add(row.post_id);
      target.posts_created += 1;
    }
    if (row.pp_status === 'success') target.published += 1;
    else if (row.pp_status === 'failed') target.failed += 1;
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

module.exports = { comparePosts };
