// Phase 21: daily snapshot builder.
//
// buildSnapshotsForUser(db, userId, dateStr) builds
// (or rebuilds, via upsert) one snapshot row per
// platform for that user and day, from platform_posts
// and posts. Idempotent: rebuilding the same day
// overwrites, never duplicates.
//
// ensureYesterdaySnapshots(db) is the automation:
// the scheduler tick calls it, and it builds
// yesterday's snapshots only for users who have none
// yet. It never throws — a snapshot failure must not
// break scheduling.
const { buildSnapshotRows } = require('../utils/snapshots');

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function buildSnapshotsForUser(db, userId, dateStr) {
  const platformPostsRes = await db.query(
    `SELECT pp.platform, pp.status, pp.posted_at
     FROM platform_posts pp
     JOIN posts p ON p.id = pp.post_id
     WHERE p.user_id=$1 AND pp.posted_at::date = $2`,
    [userId, dateStr]
  );
  const postsRes = await db.query(
    `SELECT platforms FROM posts WHERE user_id=$1 AND created_at::date = $2`,
    [userId, dateStr]
  );
  const rows = buildSnapshotRows({ platformPosts: platformPostsRes.rows, posts: postsRes.rows });
  for (const row of rows) {
    await db.query(
      `INSERT INTO analytics_daily_snapshots (user_id, snapshot_date, platform, published_count, failed_count, posts_created)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, snapshot_date, platform) DO UPDATE
       SET published_count=$4, failed_count=$5, posts_created=$6, updated_at=NOW()`,
      [userId, dateStr, row.platform, row.published_count, row.failed_count, row.posts_created]
    );
  }
  return rows;
}

async function ensureYesterdaySnapshots(db) {
  try {
    const dateStr = yesterdayStr();
    const usersRes = await db.query(`SELECT DISTINCT user_id FROM posts`);
    for (const { user_id: userId } of usersRes.rows) {
      const existing = await db.query(
        `SELECT 1 FROM analytics_daily_snapshots WHERE user_id=$1 AND snapshot_date=$2 LIMIT 1`,
        [userId, dateStr]
      );
      if (existing.rows.length === 0) {
        await buildSnapshotsForUser(db, userId, dateStr);
      }
    }
  } catch (e) {
    console.error('📊 Snapshot ensure failed (scheduling unaffected):', e.message);
  }
}

module.exports = { buildSnapshotsForUser, ensureYesterdaySnapshots, yesterdayStr };
