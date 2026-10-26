// museQueue.js — Muse bridge queue for one HiSocial instance.
// Mount in backend/src/index.js (see scripts/apply-muse-queue.sh):
//   app.use('/api/muse-queue', require('./routes/museQueue'));
//
// Mount exactly like the other HiSocial routers:
//   app.use('/api/muse-queue', require('./routes/museQueue'));
// Handlers read the pool from req.app.locals.db, the existing HiSocial
// pattern, so no factory argument is needed.
//
// Auth:
// - Job creation (POST /jobs) uses the app session (req.user), like the
//   other /api routes. Only the owning user may create jobs for themselves.
// - Bridge endpoints (next/heartbeat/asset/result) use a per-instance
//   Bearer token from MUSE_BRIDGE_TOKEN. If that token is not configured,
//   bridge endpoints return 503 and claim nothing. The token is never
//   logged and never returned in any response.
// - A bridge worker may only touch jobs in THIS instance's database. It
//   cannot see another instance, because each instance has its own database
//   and its own token.
//
// Job lifecycle: queued -> leased (15 min) -> done | error.
// An expired lease returns the job to queued on the next claim attempt.
// Asset upload does not finish a job; the result submission does.
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  LEASE_MS, validateJobInput, tokensMatch, isClaimable,
} = require('./museQueueLogic');

const router = express.Router();
  const getDb = (req) => req.app.locals.db;

  const requireAppUser = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    return next();
  };

  const requireBridge = (req, res, next) => {
    const expected = String(process.env.MUSE_BRIDGE_TOKEN || '').trim();
    if (!expected) {
      return res.status(503).json({ error: 'Muse bridge is not configured for this instance' });
    }
    const auth = String(req.headers.authorization || '');
    const supplied = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
    if (!tokensMatch(expected, supplied)) {
      return res.status(401).json({ error: 'Invalid bridge token' });
    }
    return next();
  };

  const checkLease = (job, leaseToken) => {
    if (!job) return 'Job not found';
    if (job.status !== 'leased') return 'Job is not leased';
    if (job.lease_token !== leaseToken) return 'Lease token does not match';
    if (new Date(job.lease_expires_at).getTime() <= Date.now()) {
      return 'Lease expired';
    }
    return null;
  };

  // POST /api/muse-queue/jobs — create a job (app user).
  router.post('/jobs', requireAppUser, async (req, res) => {
    const error = validateJobInput(req.body || {});
    if (error) return res.status(400).json({ error });
    const {
      kind, prompt, style, size, language, group_name: groupName, account_label: accountLabel,
    } = req.body;
    try {
      const result = await getDb(req).query(
        `INSERT INTO muse_jobs
         (user_id, kind, prompt, style, size, language, group_name, account_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.user.id, kind, String(prompt).trim(), style || null, size || null,
          language || null, groupName || null, accountLabel || null],
      );
      return res.status(201).json({ job: result.rows[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/muse-queue/jobs — list my jobs (app user).
  router.get('/jobs', requireAppUser, async (req, res) => {
    try {
      const result = await getDb(req).query(
        'SELECT * FROM muse_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
        [req.user.id],
      );
      return res.json({ jobs: result.rows });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/muse-queue/next?kind=image — claim the oldest claimable job.
  router.get('/next', requireBridge, async (req, res) => {
    const kind = req.query.kind ? String(req.query.kind) : null;
    try {
      const candidates = await getDb(req).query(
        `SELECT * FROM muse_jobs
         WHERE status IN ('queued','leased')
         ${kind ? 'AND kind=$1' : ''}
         ORDER BY created_at ASC LIMIT 20`,
        kind ? [kind] : [],
      );
      const now = Date.now();
      const job = candidates.rows.find((row) => isClaimable(row, now));
      if (!job) return res.json({ job: null });
      const leaseToken = crypto.randomUUID();
      const expires = new Date(now + LEASE_MS).toISOString();
      const claimed = await getDb(req).query(
        `UPDATE muse_jobs SET status='leased', lease_token=$1, leased_at=NOW(),
         lease_expires_at=$2, updated_at=NOW()
         WHERE id=$3 AND (status='queued' OR (status='leased' AND lease_expires_at <= NOW()))
         RETURNING *`,
        [leaseToken, expires, job.id],
      );
      if (claimed.rowCount === 0) return res.json({ job: null });
      return res.json({ job: claimed.rows[0], lease_token: leaseToken });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // POST /api/muse-queue/jobs/:id/heartbeat — extend the lease.
  router.post('/jobs/:id/heartbeat', requireBridge, async (req, res) => {
    try {
      const current = await getDb(req).query('SELECT * FROM muse_jobs WHERE id=$1', [req.params.id]);
      const job = current.rows[0];
      const leaseError = checkLease(job, req.body?.lease_token);
      if (leaseError) return res.status(409).json({ error: leaseError });
      const expires = new Date(Date.now() + LEASE_MS).toISOString();
      await getDb(req).query(
        'UPDATE muse_jobs SET lease_expires_at=$1, updated_at=NOW() WHERE id=$2',
        [expires, job.id],
      );
      return res.json({ ok: true, lease_expires_at: expires });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Asset upload: image files only, per-job folder, never executable.
  const uploadDir = path.join(__dirname, '..', 'uploads', 'muse');
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(uploadDir, String(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `asset-${Date.now()}${ext}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = ['.png', '.jpg', '.jpeg', '.webp'].includes(
        path.extname(file.originalname || '').toLowerCase(),
      );
      cb(ok ? null : new Error('Only PNG, JPG and WebP images are accepted'), ok);
    },
  });

  // POST /api/muse-queue/jobs/:id/asset — upload the generated image.
  router.post('/jobs/:id/asset', requireBridge, upload.single('file'), async (req, res) => {
    try {
      const current = await getDb(req).query('SELECT * FROM muse_jobs WHERE id=$1', [req.params.id]);
      const job = current.rows[0];
      const leaseError = checkLease(job, req.body?.lease_token);
      if (leaseError) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(409).json({ error: leaseError });
      }
      if (!req.file) return res.status(400).json({ error: 'file is required' });
      const mediaUrl = `/uploads/muse/${job.id}/${path.basename(req.file.path)}`;
      await getDb(req).query(
        'UPDATE muse_jobs SET media_path=$1, media_url=$2, updated_at=NOW() WHERE id=$3',
        [req.file.path, mediaUrl, job.id],
      );
      return res.json({ ok: true, media_url: mediaUrl });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // POST /api/muse-queue/jobs/:id/result — finish (or fail) a leased job.
  router.post('/jobs/:id/result', requireBridge, async (req, res) => {
    try {
      const current = await getDb(req).query('SELECT * FROM muse_jobs WHERE id=$1', [req.params.id]);
      const job = current.rows[0];
      const leaseError = checkLease(job, req.body?.lease_token);
      if (leaseError) return res.status(409).json({ error: leaseError });
      const status = req.body?.status === 'error' ? 'error' : 'done';
      const result = await getDb(req).query(
        `UPDATE muse_jobs SET status=$1, result_text=$2, output=$3,
         error_message=$4, lease_token=NULL, updated_at=NOW()
         WHERE id=$5 RETURNING *`,
        [status, req.body?.result_text || null,
          req.body?.output ? JSON.stringify(req.body.output) : null,
          status === 'error' ? (req.body?.error_message || 'Bridge reported an error') : null,
          job.id],
      );
      return res.json({ job: result.rows[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

module.exports = router;
