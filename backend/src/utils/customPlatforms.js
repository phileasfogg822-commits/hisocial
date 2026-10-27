// Phase 11: generic "paste URL + API" platform connector,
// tiered. A custom platform is one row the user creates:
// a name, a base URL, and — for the full tier — the post
// endpoint and an API key.
//
// Tiers:
// - full: the app POSTs to the platform's API. The
//   platform must accept JSON {content, media_urls}.
// - readonly: connected for reading only (analytics
//   later); posting is refused with a clear error, not
//   attempted and failed confusingly at the API.
// - manual: the app never calls the platform. A publish
//   attempt records a manual instruction ("publish this
//   post yourself at <base_url>") instead of pretending
//   the post went out. A real manual-task queue is later
//   work (supervised inbox, Phase 18); this tier does
//   not fake it.
//
// Security note: the API key is stored in the database
// like the other platforms' access tokens (plaintext,
// same as social_accounts). Token encryption is Phase
// 28 work and covers all of them together.
const TIERS = ['full', 'readonly', 'manual'];

function customPlatformId(slug) {
  return `custom_${slug}`;
}

function isCustomPlatformId(platformId) {
  return typeof platformId === 'string' && platformId.startsWith('custom_');
}

function slugFromPlatformId(platformId) {
  return platformId.slice('custom_'.length);
}

// Slugs become part of the platform id used in posts,
// so they must be URL- and id-safe: lowercase letters,
// digits, underscores, hyphens, 2–40 chars.
function validateSlug(raw) {
  const slug = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(slug)) {
    return { ok: false, error: 'Slug must be 2–40 lowercase letters, digits, underscores, or hyphens' };
  }
  return { ok: true, slug };
}

function validateCustomPlatform(input) {
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, error: 'Platform name is required' };
  if (name.length > 100) return { ok: false, error: 'Platform name is too long (max 100 chars)' };
  const slugCheck = validateSlug(input.slug);
  if (!slugCheck.ok) return slugCheck;
  const tier = String(input.tier || '');
  if (!TIERS.includes(tier)) return { ok: false, error: `Tier must be one of: ${TIERS.join(', ')}` };
  let baseUrl = String(input.base_url || '').trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(baseUrl)) return { ok: false, error: 'Base URL must start with http:// or https://' };
  let postPath = String(input.post_path || '').trim();
  if (tier === 'full') {
    if (!postPath.startsWith('/')) return { ok: false, error: 'Full-tier platforms need a post path starting with / (for example: /api/posts)' };
  } else {
    postPath = postPath || null;
  }
  const authType = String(input.auth_type || 'bearer');
  if (!['bearer', 'header'].includes(authType)) return { ok: false, error: 'Auth type must be bearer or header' };
  let authHeader = String(input.auth_header || '').trim() || null;
  if (authType === 'header' && !authHeader) return { ok: false, error: 'Header auth needs a header name (for example: X-API-Key)' };
  return {
    ok: true,
    platform: {
      name,
      slug: slugCheck.slug,
      tier,
      base_url: baseUrl,
      post_path: postPath,
      auth_type: authType,
      auth_header: authType === 'header' ? authHeader : null,
    },
  };
}

function tierCanPost(tier) {
  return tier === 'full';
}

// Pure request builder, so tests can assert the exact
// request without hitting any platform.
function buildPostRequest(def, content, mediaUrls) {
  const headers = { 'Content-Type': 'application/json' };
  if (def.api_key) {
    if (def.auth_type === 'header' && def.auth_header) headers[def.auth_header] = def.api_key;
    else headers.Authorization = `Bearer ${def.api_key}`;
  }
  return {
    url: `${def.base_url}${def.post_path}`,
    headers,
    body: { content, media_urls: mediaUrls || [] },
  };
}

module.exports = {
  TIERS,
  customPlatformId,
  isCustomPlatformId,
  slugFromPlatformId,
  validateSlug,
  validateCustomPlatform,
  tierCanPost,
  buildPostRequest,
};
