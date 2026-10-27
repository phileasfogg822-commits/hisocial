// Phase 12: the single AI provider registry. Before this
// phase the provider list was hardcoded inline in
// routes/ai.js, the Settings list was hardcoded again in
// the frontend (missing Alibaba and Muse entirely), and
// there was no record of any test result anywhere.
//
// One spec per provider: id, name, env var, text/image
// capability, and how it can be connection-tested:
// - 'text': a live text probe (cheap, real request).
// - 'image-manual': image-only providers have no free
//   probe endpoint — running a generation as a "test"
//   would spend a generation and poll an async job, so
//   the test honestly reports untestable and the way to
//   verify is generating one image.
// - 'queue': Muse. It is the preferred generator, but it
//   does not take an API key and has no live endpoint
//   here — it connects via the task queue, which lands
//   in Phase 14. Until then its test honestly reports
//   unavailable in this environment, not success.
//
// Presence rule (same as before): an env var counts as
// configured only when set and not a 'your_' placeholder.
const PROVIDER_SPECS = [
  {
    id: 'muse',
    name: 'Muse (Meta Muse)',
    envVar: null,
    hasText: true,
    hasImage: true,
    testKind: 'queue',
    preferred: true,
    note: 'Preferred generator. Connects via the task queue (Phase 14); no worker is connected in this environment.',
  },
  { id: 'openai', name: 'OpenAI GPT-4o', envVar: 'OPENAI_API_KEY', hasText: true, hasImage: true, testKind: 'text' },
  { id: 'gemini', name: 'Google Gemini Flash Latest', envVar: 'GEMINI_API_KEY', hasText: true, hasImage: false, testKind: 'text' },
  { id: 'bigmodel', name: 'BigModel GLM / CogView', envVar: 'BIGMODEL_API_KEY', hasText: true, hasImage: true, testKind: 'text' },
  { id: 'alibaba', name: 'Alibaba Wan2.7', envVar: 'ALIBABA_DASHSCOPE_API_KEY', hasText: false, hasImage: true, testKind: 'image-manual' },
  { id: 'deapi', name: 'DEAPI Flux Image', envVar: 'DEAPI_API_KEY', hasText: false, hasImage: true, testKind: 'image-manual' },
  { id: 'anthropic', name: 'Anthropic Claude', envVar: 'ANTHROPIC_API_KEY', hasText: true, hasImage: false, testKind: 'text' },
  { id: 'grok', name: 'xAI Grok', envVar: 'GROK_API_KEY', hasText: true, hasImage: false, testKind: 'text' },
];

function isConfigured(spec, env = process.env) {
  if (!spec.envVar) return false;
  const value = env[spec.envVar];
  return Boolean(value) && !String(value).startsWith('your_');
}

function displayName(spec, env = process.env) {
  if (spec.id === 'alibaba') {
    const region = String(env.ALIBABA_REGION || 'singapore').toLowerCase();
    return `Alibaba Wan2.7 (${region})`;
  }
  return spec.name;
}

// Every spec, with configured + display name resolved.
// This is what GET /api/ai/providers returns (plus the
// last test status, merged by the route).
function listProviders(env = process.env) {
  return PROVIDER_SPECS.map((spec) => ({
    id: spec.id,
    name: displayName(spec, env),
    envVar: spec.envVar,
    hasText: spec.hasText,
    hasImage: spec.hasImage,
    testKind: spec.testKind,
    preferred: Boolean(spec.preferred),
    note: spec.note || null,
    configured: isConfigured(spec, env),
  }));
}

// Providers the generation fallback chain may actually
// call today: configured, live text-capable API
// providers. Muse is excluded until the Phase 14 queue
// exists — listing it here would send generation into a
// testProvider that cannot call it.
function availableTextProviders(env = process.env) {
  return listProviders(env).filter((p) => p.configured && p.testKind === 'text');
}

function getProviderSpec(id) {
  return PROVIDER_SPECS.find((spec) => spec.id === id) || null;
}

module.exports = {
  PROVIDER_SPECS,
  isConfigured,
  listProviders,
  availableTextProviders,
  getProviderSpec,
};
