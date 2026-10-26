const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

function getPublicBackendBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');

  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}`;
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${extension}`);
  },
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
]);

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(String(file.mimetype || '').toLowerCase())) {
      return cb(new Error('Only image uploads are supported'));
    }
    cb(null, true);
  },
});

router.post('/upload', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const db = req.app.locals.db;
    const publicBaseUrl = getPublicBackendBaseUrl(req);
    const fileRecords = [];

    for (const file of files) {
      const localUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      const publicUrl = `${publicBaseUrl}/uploads/${file.filename}`;
      const inserted = await db.query(
        `INSERT INTO media_uploads (user_id, original_name, storage_path, mime_type, file_size, local_url, public_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, original_name, mime_type, file_size, local_url, public_url, created_at`,
        [
          req.user.id,
          file.originalname || file.filename,
          file.path,
          file.mimetype || null,
          Number(file.size || 0),
          localUrl,
          publicUrl,
        ]
      );

      const record = inserted.rows[0];
      fileRecords.push({
        id: record.id,
        name: record.original_name,
        mime_type: record.mime_type,
        file_size: Number(record.file_size || 0),
        url: record.public_url || record.local_url,
        local_url: record.local_url,
        thumbnail_url: record.public_url || record.local_url,
        created_at: record.created_at,
      });
    }

    const urls = fileRecords.map((file) => file.url);

    res.json({
      uploaded: urls.length,
      urls,
      files: fileRecords,
    });
  } catch (e) {
    console.error('Media upload failed:', e.message);
    res.status(500).json({ error: 'Failed to upload media files' });
  }
});

// Returns current tunnel / public-URL status so the frontend Settings view can show
// whether Instagram image uploads are properly configured.
router.get('/tunnel-status', requireAuth, (_req, res) => {
  const tunnelUrl = String(process.env.PUBLIC_BACKEND_URL || '').trim();
  const active = Boolean(tunnelUrl && !tunnelUrl.startsWith('http://localhost') && !tunnelUrl.startsWith('http://127.'));
  res.json({
    active,
    tunnel_url: active ? tunnelUrl : null,
    instagram_ready: active,
    message: active
      ? `Tunnel active — Instagram image uploads will use ${tunnelUrl}`
      : 'No public URL configured. Add cloudflared to docker-compose or set PUBLIC_BACKEND_URL.',
  });
});

module.exports = router;
