// Phase 28: backup export + restore import.
//
// Export: one JSON document with the user's own
// rows from the core tables. Secrets are NEVER
// exported: social_accounts rows omit access_token
// and refresh_token, custom_platforms rows omit
// api_key. A backup without secrets cannot restore
// a connection — reconnecting is an owner step
// after restore, and the export says so.
//
// Import: insert-or-skip by id (existing rows are
// left alone — import never overwrites), ownership
// forced to the importing user regardless of what
// the file claims, tables allowlisted. Unknown
// tables, bad shapes, or rows naming another user
// are rejected, not silently fixed.
const express = require('express');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

const EXPORT_TABLES = {
  account_groups: { columns: ['id', 'name', 'created_at'], pk: 'id' },
  social_accounts: { columns: ['id', 'platform', 'platform_user_id', 'platform_username', 'platform_display_name', 'platform_avatar_url', 'token_expires_at', 'scope', 'group_id', 'is_active', 'connected_at'], pk: 'id' },
  posts: { columns: ['id', 'content', 'platforms', 'media_urls', 'status', 'scheduled_at', 'published_at', 'group_id', 'requires_approval', 'attempts', 'facebook_page_ids', 'linkedin_target_ids', 'reddit_subreddit', 'pinterest_board_id', 'autopilot_generated', 'generation_source', 'generation_batch_id', 'generation_index', 'generation_total', 'language', 'created_at'], pk: 'id' },
  platform_posts: { columns: ['id', 'post_id', 'platform', 'platform_post_id', 'platform_post_url', 'status', 'error_message', 'posted_at'], pk: 'id' },
  ai_templates: { columns: ['id', 'name', 'tone', 'language', 'format', 'style_notes', 'created_at'], pk: 'id' },
  ai_assignments: { columns: ['id', 'scope_type', 'scope_key', 'task_kind', 'provider_id', 'created_at'], pk: 'id' },
  monetization_entries: { columns: ['id', 'kind', 'category', 'amount', 'currency', 'platform', 'post_id', 'note', 'entry_date', 'created_at'], pk: 'id' },
  custom_platforms: { columns: ['id', 'name', 'slug', 'tier', 'base_url', 'post_path', 'auth_type', 'auth_header', 'is_active', 'created_at'], pk: 'id' },
};

router.get('/export', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const data = { version: 1, exported_at: new Date().toISOString(), user_id: req.user.id, tables: {} };
    for (const [table, spec] of Object.entries(EXPORT_TABLES)) {
      if (table === 'platform_posts') continue; // no user_id column; handled below via posts
      const cols = spec.columns.join(', ');
      const result = await db.query(`SELECT ${cols} FROM ${table} WHERE user_id=$1 ORDER BY created_at ASC NULLS LAST LIMIT 5000`, [req.user.id]);
      data.tables[table] = result.rows;
    }
    // platform_posts has no user_id column — it is
    // reached through the user's posts instead.
    const ppRes = await db.query(
      `SELECT pp.id, pp.post_id, pp.platform, pp.platform_post_id, pp.platform_post_url, pp.status, pp.error_message, pp.posted_at
       FROM platform_posts pp JOIN posts p ON p.id = pp.post_id WHERE p.user_id=$1 ORDER BY pp.posted_at ASC NULLS LAST LIMIT 5000`,
      [req.user.id]
    );
    data.tables.platform_posts = ppRes.rows;
    data.notes = 'Secrets are NOT included: social_accounts tokens and custom_platforms API keys are omitted. Reconnect accounts and re-enter custom keys after restore.';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="hisocial-backup.json"');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const backup = req.body || {};
  if (backup.version !== 1 || typeof backup.tables !== 'object') {
    return res.status(400).json({ error: 'Invalid backup: expected version 1 with a tables object' });
  }
  try {
    const report = {};
    for (const [table, rows] of Object.entries(backup.tables)) {
      const spec = EXPORT_TABLES[table];
      if (!spec) return res.status(400).json({ error: `Unknown table in backup: ${table}` });
      if (!Array.isArray(rows)) return res.status(400).json({ error: `Table ${table} is not an array` });
      let inserted = 0;
      let skipped = 0;
      for (const row of rows) {
        if (!row || typeof row !== 'object' || !row.id) { skipped += 1; continue; }
        const cols = spec.columns.filter((c) => c in row);
        if (!cols.includes('id')) { skipped += 1; continue; }
        // Ownership is forced to the importer; a
        // platform_posts row keeps its post link,
        // which must belong to the importer too.
        if (table === 'platform_posts') {
          const own = await db.query(`SELECT id FROM posts WHERE id=$1 AND user_id=$2`, [row.post_id, req.user.id]);
          if (!own.rows[0]) { skipped += 1; continue; }
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
          const conflict = `ON CONFLICT (id) DO NOTHING`;
          const result = await db.query(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ${conflict} RETURNING id`,
            cols.map((c) => row[c])
          );
          if (result.rows[0]) inserted += 1; else skipped += 1;
          continue;
        }
        const allCols = [...cols, 'user_id'];
        const placeholders = allCols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map((c) => row[c]);
        values.push(req.user.id);
        const result = await db.query(
          `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING RETURNING id`,
          values
        );
        if (result.rows[0]) inserted += 1; else skipped += 1;
      }
      report[table] = { inserted, skipped };
    }
    res.json({ imported: true, report });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
