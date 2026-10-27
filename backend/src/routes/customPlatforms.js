// Phase 11: CRUD for user-defined generic platforms.
// API keys are never returned: the list reports only
// has_api_key. Keys are stored like the other platforms'
// tokens (see utils/customPlatforms.js security note).
const express = require('express');
const { validateCustomPlatform } = require('../utils/customPlatforms');

const requireProfile = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No profile selected' });
  next();
};

const router = express.Router();

function mask(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tier: row.tier,
    base_url: row.base_url,
    post_path: row.post_path,
    auth_type: row.auth_type,
    auth_header: row.auth_header,
    has_api_key: Boolean(row.api_key),
  };
}

router.get('/', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const result = await db.query(
    `SELECT * FROM custom_platforms WHERE user_id=$1 AND is_active=true ORDER BY created_at ASC`,
    [req.user.id]
  );
  res.json(result.rows.map(mask));
});

router.post('/', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const checked = validateCustomPlatform(req.body || {});
  if (!checked.ok) return res.status(400).json({ error: checked.error });
  const p = checked.platform;
  const apiKey = req.body.api_key ? String(req.body.api_key) : null;
  if (p.tier === 'full' && !apiKey) {
    // A full-tier platform without a key would fail
    // every post; require it up front, not at publish.
    return res.status(400).json({ error: 'Full-tier platforms need an API key' });
  }
  try {
    const result = await db.query(
      `INSERT INTO custom_platforms (user_id, name, slug, tier, base_url, post_path, api_key, auth_type, auth_header)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, p.name, p.slug, p.tier, p.base_url, p.post_path, apiKey, p.auth_type, p.auth_header]
    );
    res.status(201).json(mask(result.rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: `A custom platform with slug "${p.slug}" already exists` });
    throw e;
  }
});

router.put('/:id', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const checked = validateCustomPlatform(req.body || {});
  if (!checked.ok) return res.status(400).json({ error: checked.error });
  const p = checked.platform;
  const hasNewKey = typeof req.body.api_key === 'string' && req.body.api_key.length > 0;
  try {
    const result = await db.query(
      `UPDATE custom_platforms SET name=$1, slug=$2, tier=$3, base_url=$4, post_path=$5,
         api_key=CASE WHEN $6 THEN $7 ELSE api_key END, auth_type=$8, auth_header=$9, updated_at=NOW()
       WHERE id=$10 AND user_id=$11 AND is_active=true RETURNING *`,
      [p.name, p.slug, p.tier, p.base_url, p.post_path, hasNewKey, req.body.api_key || null, p.auth_type, p.auth_header, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Custom platform not found' });
    res.json(mask(result.rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: `A custom platform with slug "${p.slug}" already exists` });
    throw e;
  }
});

router.delete('/:id', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const result = await db.query(
    `UPDATE custom_platforms SET is_active=false, updated_at=NOW() WHERE id=$1 AND user_id=$2 AND is_active=true RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Custom platform not found' });
  res.json({ deleted: true });
});

module.exports = router;
