const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

function addHostFromUrl(hosts, value) {
  const raw = String(value || '').trim();
  if (!raw) return;

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const parsed = new URL(normalized);
    if (parsed.hostname) hosts.add(String(parsed.hostname).toLowerCase());
  } catch {
    // Ignore invalid URL-like env values
  }
}

function getConfiguredLocalMediaHosts() {
  const hosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal',
    'backend',
    'socialhub_backend',
  ]);

  [
    process.env.LOCAL_BACKEND_URL,
    process.env.PUBLIC_BACKEND_URL,
    process.env.BACKEND_PUBLIC_URL,
    process.env.FRONTEND_URL,
    process.env.REACT_APP_API_URL,
  ].forEach((value) => addHostFromUrl(hosts, value));

  return hosts;
}

const localMediaHosts = getConfiguredLocalMediaHosts();

function clampNumber(value, min, max, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeLayer(layer = {}, index = 0) {
  const type = String(layer.type || '').toLowerCase();
  const base = {
    id: String(layer.id || `layer_${index}`),
    type,
    visible: layer.visible !== false,
    locked: layer.locked === true,
    x: clampNumber(layer.x, -20000, 20000, 0),
    y: clampNumber(layer.y, -20000, 20000, 0),
    width: clampNumber(layer.width, 1, 20000, 200),
    height: clampNumber(layer.height, 1, 20000, 80),
    opacity: clampNumber(layer.opacity, 0, 1, 1),
    rotation: clampNumber(layer.rotation, -360, 360, 0),
    zIndex: clampNumber(layer.zIndex, -1000, 1000, index),
  };

  if (type === 'image') {
    return {
      ...base,
      src: String(layer.src || '').trim(),
    };
  }

  if (type === 'text') {
    return {
      ...base,
      content: String(layer.content || ''),
      fontSize: clampNumber(layer.fontSize, 8, 300, 32),
      fontFamily: String(layer.fontFamily || 'Arial, sans-serif'),
      color: String(layer.color || '#ffffff'),
      maxWidth: clampNumber(layer.maxWidth, 20, 5000, base.width),
      align: ['left', 'center', 'right'].includes(layer.align) ? layer.align : 'left',
    };
  }

  if (type === 'shape') {
    return {
      ...base,
      shape: layer.shape === 'circle' ? 'circle' : 'rectangle',
      fill: String(layer.fill || '#1E3A5F'),
    };
  }

  return null;
}

function styleCommon(layer) {
  return [
    'position:absolute',
    `left:${layer.x}px`,
    `top:${layer.y}px`,
    `width:${layer.width}px`,
    `height:${layer.height}px`,
    `opacity:${layer.opacity}`,
    `transform:rotate(${layer.rotation}deg)`,
    'transform-origin:center center',
    `z-index:${layer.zIndex}`,
    'box-sizing:border-box',
  ].join(';');
}

function renderLayerHtml(layer) {
  if (!layer.visible) return '';

  if (layer.type === 'image') {
    const src = escapeHtml(layer.src || '');
    return `<img src="${src}" style="${styleCommon(layer)};object-fit:fill;" />`;
  }

  if (layer.type === 'text') {
    const text = escapeHtml(layer.content || '');
    const fontFamily = escapeHtml(layer.fontFamily || 'Arial, sans-serif');
    const color = escapeHtml(layer.color || '#ffffff');
    const width = clampNumber(layer.maxWidth, 20, 5000, layer.width);
    return `<div style="${styleCommon({ ...layer, width })};font-family:${fontFamily};font-size:${layer.fontSize}px;color:${color};text-align:${layer.align};line-height:1.25;white-space:pre-wrap;overflow-wrap:anywhere;">${text}</div>`;
  }

  if (layer.type === 'shape') {
    const fill = escapeHtml(layer.fill || '#1E3A5F');
    const radius = layer.shape === 'circle' ? '9999px' : '8px';
    return `<div style="${styleCommon(layer)};background:${fill};border-radius:${radius};"></div>`;
  }

  return '';
}

function buildHtml({ baseImageSrc, width, height, layers }) {
  const layerMarkup = layers.map((layer) => renderLayerHtml(layer)).join('\n');
  const baseSrc = escapeHtml(baseImageSrc);

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: transparent; }
      #stage { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
      #base { position: absolute; inset: 0; width: ${width}px; height: ${height}px; object-fit: cover; z-index: 0; }
    </style>
  </head>
  <body>
    <div id="stage">
      <img id="base" src="${baseSrc}" />
      ${layerMarkup}
    </div>
  </body>
</html>
`;
}

function resolveImageSource(src = '') {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('/uploads/')) {
    const base = String(process.env.LOCAL_BACKEND_URL || process.env.PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
    return `${base}${raw}`;
  }
  return raw;
}

function getMimeTypeForFilename(filename = '') {
  const ext = path.extname(String(filename || '')).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.avif':
      return 'image/avif';
    case '.heic':
      return 'image/heic';
    case '.heif':
      return 'image/heif';
    default:
      return 'image/png';
  }
}

function getLocalUploadPathFromSrc(src = '') {
  const raw = String(src || '').trim();
  if (!raw) return null;

  if (raw.startsWith('/uploads/')) {
    const relative = decodeURIComponent(raw.slice('/uploads/'.length));
    const filePath = path.join(uploadsDir, relative);
    const safeRelative = path.relative(uploadsDir, filePath);
    if (safeRelative.startsWith('..') || path.isAbsolute(safeRelative)) return null;
    return fs.existsSync(filePath) ? filePath : null;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const pathname = decodeURIComponent(parsed.pathname || '');
  const hostname = String(parsed.hostname || '').toLowerCase();
  if (!pathname.startsWith('/uploads/')) return null;
  if (!localMediaHosts.has(hostname)) return null;

  const relative = pathname.slice('/uploads/'.length);
  const filePath = path.join(uploadsDir, relative);
  const safeRelative = path.relative(uploadsDir, filePath);
  if (safeRelative.startsWith('..') || path.isAbsolute(safeRelative)) return null;
  return fs.existsSync(filePath) ? filePath : null;
}

async function toDataUrl(src = '', options = {}) {
  const { strict = false, context = 'image' } = options;
  const localPath = getLocalUploadPathFromSrc(src);
  if (localPath) {
    const buffer = await fs.promises.readFile(localPath);
    const mime = getMimeTypeForFilename(localPath);
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${mime};base64,${base64}`;
  }

  const resolved = resolveImageSource(src);
  if (!resolved || resolved.startsWith('data:image/')) return resolved;

  try {
    const response = await axios.get(resolved, {
      responseType: 'arraybuffer',
      timeout: 20000,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    const mime = String(response.headers?.['content-type'] || 'image/png').split(';')[0] || 'image/png';
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    if (strict) {
      throw new Error(`Failed to load ${context} source: ${resolved}. ${error.message || 'Unknown fetch error'}`);
    }
    return resolved;
  }
}

async function composeImageWithLayers({ baseImageSrc, layers = [], outputWidth = null, outputHeight = null }) {
  const width = Math.max(1, Math.round(Number(outputWidth) || 1080));
  const height = Math.max(1, Math.round(Number(outputHeight) || 1080));

  const normalizedLayers = (Array.isArray(layers) ? layers : [])
    .map((layer, index) => normalizeLayer(layer, index))
    .filter(Boolean)
    .filter((layer) => layer.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  const hydratedLayers = await Promise.all(
    normalizedLayers.map(async (layer) => {
      if (layer.type !== 'image') return layer;
      return {
        ...layer,
        src: await toDataUrl(layer.src || '', { strict: true, context: `layer ${layer.id || 'image'}` }),
      };
    })
  );

  const hydratedBase = await toDataUrl(baseImageSrc || '');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(buildHtml({ baseImageSrc: hydratedBase, width, height, layers: hydratedLayers }), { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      const waitForImage = (img) => new Promise((resolve) => {
        if (!img) return resolve();
        if (img.complete) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

      const images = Array.from(document.querySelectorAll('img'));
      await Promise.race([
        Promise.all(images.map((img) => waitForImage(img))),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    });

    const buffer = await page.screenshot({ type: 'png', omitBackground: false });
    return {
      buffer,
      width,
      height,
      layerCount: hydratedLayers.length,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  composeImageWithLayers,
  normalizeLayer,
};
