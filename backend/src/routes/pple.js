const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { composeImageWithLayers } = require('../services/ppleRenderer');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function getPublicBackendBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

const ppleOutputDir = path.join(__dirname, '..', '..', 'uploads', 'pple');
fs.mkdirSync(ppleOutputDir, { recursive: true });

router.get('/templates', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const result = await db.query(
    `SELECT id, name, canvas_width, canvas_height, layers, created_at, updated_at
     FROM pple_templates
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [req.user.id]
  );
  res.json({ templates: result.rows });
});

router.post('/templates', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const {
    id,
    name,
    layers = [],
    canvas_width = 1080,
    canvas_height = 1080,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Template name is required' });
  }

  const templateId = id ? String(id) : uuidv4();

  const result = await db.query(
    `INSERT INTO pple_templates (id, user_id, name, canvas_width, canvas_height, layers)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (id)
     DO UPDATE SET
       name = EXCLUDED.name,
       canvas_width = EXCLUDED.canvas_width,
       canvas_height = EXCLUDED.canvas_height,
       layers = EXCLUDED.layers,
       updated_at = NOW()
     WHERE pple_templates.user_id = EXCLUDED.user_id
     RETURNING id, name, canvas_width, canvas_height, layers, created_at, updated_at`,
    [
      templateId,
      req.user.id,
      String(name).trim(),
      Math.max(1, Number(canvas_width) || 1080),
      Math.max(1, Number(canvas_height) || 1080),
      JSON.stringify(Array.isArray(layers) ? layers : []),
    ]
  );

  if (!result.rows[0]) {
    return res.status(403).json({ error: 'Template update not permitted' });
  }

  res.json({ template: result.rows[0] });
});

router.delete('/templates/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const result = await db.query(
    `DELETE FROM pple_templates WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.id]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
  res.json({ deleted: true, id: result.rows[0].id });
});

router.post('/render', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const {
      baseImage,
      baseImageUrl,
      layers = [],
      outputWidth,
      outputHeight,
      name,
    } = req.body || {};

    let source = baseImageUrl || baseImage?.url;
    
    // If no base image provided, use a data URL for a blank white canvas
    if (!source) {
      // Create a blank white image as data URL (1x1 white pixel, can be scaled)
      source = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22%3E%3Crect fill=%22white%22 width=%221%22 height=%221%22/%3E%3C/svg%3E';
    }

    const rendered = await composeImageWithLayers({
      baseImageSrc: source,
      layers,
      outputWidth: outputWidth || baseImage?.width,
      outputHeight: outputHeight || baseImage?.height,
    });

    const filename = `pple_${uuidv4()}.png`;
    const outputPath = path.join(ppleOutputDir, filename);
    fs.writeFileSync(outputPath, rendered.buffer);

    const publicBaseUrl = getPublicBackendBaseUrl(req);
    const localUrl = `${req.protocol}://${req.get('host')}/uploads/pple/${filename}`;
    const publicUrl = `${publicBaseUrl}/uploads/pple/${filename}`;

    const inserted = await db.query(
      `INSERT INTO media_uploads (user_id, original_name, storage_path, mime_type, file_size, local_url, public_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, original_name, mime_type, file_size, local_url, public_url, created_at`,
      [
        req.user.id,
        name ? String(name) : filename,
        outputPath,
        'image/png',
        rendered.buffer.length,
        localUrl,
        publicUrl,
      ]
    );

    res.json({
      image: {
        id: inserted.rows[0].id,
        url: inserted.rows[0].public_url || inserted.rows[0].local_url,
        local_url: inserted.rows[0].local_url,
        preview_url: inserted.rows[0].local_url,
        public_url: inserted.rows[0].public_url,
        width: rendered.width,
        height: rendered.height,
        layerCount: rendered.layerCount,
      },
    });
  } catch (e) {
    console.error('PPLE render error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to render PPLE image' });
  }
});

router.post('/render-and-schedule', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const {
      baseImage,
      baseImageUrl,
      layers = [],
      outputWidth,
      outputHeight,
      content,
      platforms,
      scheduled_at,
      facebook_page_ids = [],
      linkedin_target_ids = [],
      name,
    } = req.body || {};

    if (!content || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'content and platforms are required' });
    }

    let source = baseImageUrl || baseImage?.url;
    
    // If no base image provided, use a data URL for a blank white canvas
    if (!source) {
      // Create a blank white image as data URL (1x1 white pixel, can be scaled)
      source = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22%3E%3Crect fill=%22white%22 width=%221%22 height=%221%22/%3E%3C/svg%3E';
    }

    const scheduleDate = new Date(scheduled_at);
    if (!scheduled_at || Number.isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
      return res.status(400).json({ error: 'scheduled_at must be a valid future datetime' });
    }

    const rendered = await composeImageWithLayers({
      baseImageSrc: source,
      layers,
      outputWidth: outputWidth || baseImage?.width,
      outputHeight: outputHeight || baseImage?.height,
    });

    const filename = `pple_${uuidv4()}.png`;
    const outputPath = path.join(ppleOutputDir, filename);
    fs.writeFileSync(outputPath, rendered.buffer);

    const publicBaseUrl = getPublicBackendBaseUrl(req);
    const publicUrl = `${publicBaseUrl}/uploads/pple/${filename}`;
    const localUrl = `${req.protocol}://${req.get('host')}/uploads/pple/${filename}`;

    await db.query(
      `INSERT INTO media_uploads (user_id, original_name, storage_path, mime_type, file_size, local_url, public_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req.user.id,
        name ? String(name) : filename,
        outputPath,
        'image/png',
        rendered.buffer.length,
        localUrl,
        publicUrl,
      ]
    );

    const postResult = await db.query(
      `INSERT INTO posts (user_id, content, platforms, media_urls, status, scheduled_at, facebook_page_ids, linkedin_target_ids)
       VALUES ($1,$2,$3,$4,'scheduled',$5,$6,$7)
       RETURNING *`,
      [
        req.user.id,
        String(content),
        platforms,
        [publicUrl, localUrl],
        scheduleDate,
        Array.isArray(facebook_page_ids) ? facebook_page_ids.map(String).filter(Boolean) : [],
        Array.isArray(linkedin_target_ids) ? linkedin_target_ids.map(String).filter(Boolean) : [],
      ]
    );

    res.json({
      scheduled: true,
      post: postResult.rows[0],
      image: {
        url: publicUrl,
        local_url: localUrl,
        preview_url: localUrl,
        public_url: publicUrl,
        width: rendered.width,
        height: rendered.height,
        layerCount: rendered.layerCount,
      },
    });
  } catch (e) {
    console.error('PPLE render-and-schedule error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to render and schedule image' });
  }
});

module.exports = router;
