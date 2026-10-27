// Phase 4: account groups API.
//
// Groups belong to the currently selected app user (req.user).
// Every lookup scopes by that user, and a group or account
// owned by someone else is answered with 404, never 403 —
// so one user cannot probe another user's groups or accounts.
//
// Endpoints (all require a selected profile):
//   GET    /api/groups            list own groups with accounts
//   POST   /api/groups            create a group {name, description?}
//   GET    /api/groups/ungrouped  own active accounts with no group
//   GET    /api/groups/:id        one group with its accounts
//   PUT    /api/groups/:id        rename / change description
//   DELETE /api/groups/:id        delete group; accounts become ungrouped
//   POST   /api/groups/:id/accounts        assign {socialAccountId}
//   DELETE /api/groups/:id/accounts/:accountId  unassign
//
// Deleting a group never deletes accounts: the FK is
// ON DELETE SET NULL, so accounts survive as ungrouped.
const express = require('express');
const router = express.Router();
const { validateGroupName, canAssignAccount } = require('../utils/groups');

const requireProfile = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No profile selected' });
  next();
};

async function loadGroup(db, userId, groupId) {
  const result = await db.query(
    'SELECT id, user_id, name, description, created_at, updated_at FROM account_groups WHERE id = $1 AND user_id = $2',
    [groupId, userId],
  );
  return result.rows[0] || null;
}

async function groupAccounts(db, userId, groupId) {
  const result = await db.query(
    `SELECT id, platform, platform_user_id, platform_username, platform_display_name,
            platform_avatar_url, is_active, connected_at
     FROM social_accounts
     WHERE user_id = $1 AND group_id = $2 AND is_active = true
     ORDER BY connected_at ASC`,
    [userId, groupId],
  );
  return result.rows;
}

router.get('/', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const groups = await db.query(
      'SELECT id, user_id, name, description, created_at, updated_at FROM account_groups WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.id],
    );
    const withAccounts = [];
    for (const group of groups.rows) {
      withAccounts.push({ ...group, accounts: await groupAccounts(db, req.user.id, group.id) });
    }
    res.json(withAccounts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/ungrouped', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT id, platform, platform_user_id, platform_username, platform_display_name,
              platform_avatar_url, is_active, connected_at
       FROM social_accounts
       WHERE user_id = $1 AND group_id IS NULL AND is_active = true
       ORDER BY connected_at ASC`,
      [req.user.id],
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const checked = validateGroupName(req.body?.name);
  if (!checked.ok) return res.status(400).json({ error: checked.error });
  try {
    const result = await db.query(
      `INSERT INTO account_groups (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, name, description, created_at, updated_at`,
      [req.user.id, checked.name, req.body?.description ? String(req.body.description).trim() : null],
    );
    res.status(201).json({ ...result.rows[0], accounts: [] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A group with this name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const group = await loadGroup(db, req.user.id, req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json({ ...group, accounts: await groupAccounts(db, req.user.id, group.id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  const checked = validateGroupName(req.body?.name);
  if (!checked.ok) return res.status(400).json({ error: checked.error });
  try {
    const group = await loadGroup(db, req.user.id, req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const result = await db.query(
      `UPDATE account_groups SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, user_id, name, description, created_at, updated_at`,
      [checked.name, req.body?.description !== undefined ? (req.body.description ? String(req.body.description).trim() : null) : group.description, req.params.id, req.user.id],
    );
    res.json({ ...result.rows[0], accounts: await groupAccounts(db, req.user.id, group.id) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A group with this name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      'DELETE FROM account_groups WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    // Accounts survive: the FK is ON DELETE SET NULL.
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/accounts', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const group = await loadGroup(db, req.user.id, req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const accountResult = await db.query(
      'SELECT id, user_id, is_active FROM social_accounts WHERE id = $1',
      [req.body?.socialAccountId],
    );
    const account = accountResult.rows[0];
    if (!account || !canAssignAccount({ accountUserId: account.user_id, groupUserId: req.user.id, accountActive: account.is_active })) {
      return res.status(404).json({ error: 'Account not found' });
    }
    await db.query(
      'UPDATE social_accounts SET group_id = $1, updated_at = NOW() WHERE id = $2',
      [group.id, account.id],
    );
    res.json({ ...group, accounts: await groupAccounts(db, req.user.id, group.id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/accounts/:accountId', requireProfile, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const group = await loadGroup(db, req.user.id, req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const result = await db.query(
      'UPDATE social_accounts SET group_id = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND group_id = $3 RETURNING id',
      [req.params.accountId, req.user.id, group.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found in this group' });
    res.json({ ...group, accounts: await groupAccounts(db, req.user.id, group.id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
