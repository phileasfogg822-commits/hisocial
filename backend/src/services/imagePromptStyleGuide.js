/**
 * ==========================================
 * AI VISUAL DIRECTOR ENGINE (V4) — Node.js/CommonJS build
 * Context-Aware | Scene-Based | Non-Repetitive
 * Mirrors frontend/src/utils/ImagePromptStyleGuide.js exactly.
 * ==========================================
 */

/* =========================
   STYLE SYSTEM
========================= */

const VISUAL_STYLES = {
  minimal: {
    style: 'ultra clean minimal product style',
    details: 'thin lines, subtle depth, soft geometry',
    lighting: 'soft diffused lighting',
  },
  flat: {
    style: 'flat vector illustration',
    details: 'solid shapes, crisp edges, no depth',
    lighting: 'even flat lighting',
  },
  realistic: {
    style: 'realistic product render',
    details: 'real-world materials, subtle reflections',
    lighting: 'soft studio lighting',
  },
  three_d: {
    style: 'modern 3D product visualization',
    details: 'smooth 3D forms, gradients, floating elements',
    lighting: 'ambient light with soft rim glow',
  },
  cinematic: {
    style: 'cinematic product hero scene',
    details: 'depth, dramatic composition, premium feel',
    lighting: 'directional cinematic lighting',
  },
};

/* =========================
   TEMPLATE → STYLE MAP
========================= */

const TEMPLATE_STYLE_MAP = {
  tech:        'minimal',
  business:    'realistic',
  growth:      'three_d',
  products:    'realistic',
  educational: 'flat',
  lifestyle:   'cinematic',
};

/* =========================
   COLOR SYSTEM (LOCKED)
========================= */

const COLOR_SYSTEM = {
  base: 'white and light blue palette',
  accent: 'soft blue gradients and cyan highlights',
  background: 'clean white or very light blue background',
};

/* =========================
   TEXT CLEANING
========================= */

function cleanText(value = '') {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/#[a-zA-Z0-9_]+/g, ' ')
    .replace(/\b(click|buy|download|learn|follow|share|dm|contact)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceSummary(text = '') {
  return (
    String(text)
      .split(/[.!?]/)
      .map((s) => s.trim())
      .find(Boolean)
      ?.slice(0, 140) || ''
  );
}

/* =========================
   CORE MESSAGE
========================= */

function detectEmotion(text = '') {
  const t = text.toLowerCase();
  if (/growth|scale|progress|expand/.test(t)) return 'progress and momentum';
  if (/stress|overwhelm|exhaust|burnout|too many|messy/.test(t)) return 'relief and simplicity';
  if (/expensive|cost|paying|wasting|burning|money/.test(t)) return 'financial clarity and relief';
  if (/fast|speed|instant|quick/.test(t)) return 'speed and efficiency';
  if (/control|system|organiz|structure/.test(t)) return 'control and structure';
  if (/automat|workflow|pipeline/.test(t)) return 'smart automation and ease';
  if (/social|content|post|brand/.test(t)) return 'creative energy and impact';
  return 'clarity and focus';
}

function extractCoreMessage(content = '') {
  const cleaned = cleanText(content);
  return { statement: sentenceSummary(cleaned), emotion: detectEmotion(cleaned) };
}

/* =========================
   ENTITY EXTRACTION
========================= */

const METAPHOR_INDICATORS = /\b(like|as if|imagine|trying to|feels? like|acting like|picture|just like|the way)\b/;

function isMetaphorContext(text, keyword) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;
  const win = text.slice(Math.max(0, idx - 60), idx + 60);
  return METAPHOR_INDICATORS.test(win);
}

function extractEntities(text = '') {
  const t = cleanText(text).toLowerCase();
  const entities = { objects: [], environment: [], attributes: [] };

  // ── PHYSICAL OBJECTS (only when NOT used as a metaphor) ──
  if (/\b(bike|bicycle|motorcycle|scooter)\b/.test(t) && !isMetaphorContext(t, 'bike') && !isMetaphorContext(t, 'scooter'))
    entities.objects.push('modern scooter');
  if (/\bcar\b/.test(t) && !isMetaphorContext(t, 'car'))
    entities.objects.push('modern car');
  if (/\b(phone|smartphone)\b/.test(t) && !isMetaphorContext(t, 'phone'))
    entities.objects.push('smartphone device');
  if (/\b(laptop|computer)\b/.test(t) && !isMetaphorContext(t, 'laptop') && !isMetaphorContext(t, 'computer'))
    entities.objects.push('laptop workstation');

  // ── DIGITAL / SAAS / SOCIAL OBJECTS ──
  if (/\b(browser|tab|tabs|chrome|firefox|safari)\b/.test(t)) {
    entities.objects.push('multiple open browser tabs on a screen');
    entities.environment.push('digital workspace');
  }
  if (/\b(dashboard|analytics|metrics|report|chart)\b/.test(t)) {
    entities.objects.push('clean analytics dashboard');
    entities.environment.push('digital interface environment');
  }
  if (/\b(tool|tools|software|platform|saas|subscription|app|apps)\b/.test(t)) {
    if (!entities.objects.length) entities.objects.push('sleek software interface');
    if (!entities.environment.length) entities.environment.push('digital productivity workspace');
  }
  if (/\b(social media|instagram|facebook|linkedin|twitter|tiktok|post|feed)\b/.test(t)) {
    if (!entities.objects.length) entities.objects.push('social media content layout');
    if (!entities.environment.length) entities.environment.push('clean social media interface environment');
  }
  if (/\b(workflow|automat|pipeline|system|process)\b/.test(t)) {
    if (!entities.objects.length) entities.objects.push('automated workflow diagram');
    entities.attributes.push('streamlined efficiency');
  }
  if (/\b(money|pay|cost|price|budget|expensive|cheap|saving|revenue|income|earn)\b/.test(t))
    entities.attributes.push('financial clarity');

  // ── PHYSICAL ENVIRONMENTS (only non-metaphor) ──
  if (/\b(commute|commuting)\b/.test(t) && !isMetaphorContext(t, 'commut'))
    entities.environment.push('urban road');
  if (/\b(office|workspace|desk)\b/.test(t)) {
    if (!entities.environment.some((e) => e.includes('digital')))
      entities.environment.push('clean office environment');
  }
  if (/\b(city|urban|street)\b/.test(t) && !isMetaphorContext(t, 'city')) {
    if (!entities.environment.length) entities.environment.push('modern city environment');
  }

  // ── ATTRIBUTES ──
  if (/\b(fast|speed|quick|instant|rapid)\b/.test(t)) entities.attributes.push('high speed');
  if (/\b(effici|optim|streamlin)\b/.test(t)) entities.attributes.push('operational efficiency');
  if (/\b(automat|ai\b|artificial intelligence)\b/.test(t)) entities.attributes.push('intelligent automation');
  if (/\b(simple|clean|minimal|easy)\b/.test(t)) entities.attributes.push('simplicity and clarity');
  if (/\b(growth|scale|grow|expand)\b/.test(t)) entities.attributes.push('growth and scale');
  if (/\b(stress|overwhelm|exhaust|burnout|busy)\b/.test(t)) entities.attributes.push('relief from overload');

  return entities;
}

/* =========================
   FALLBACK VISUAL SIGNALS
========================= */

function extractVisualSignals(text = '') {
  const words = cleanText(text).toLowerCase().split(/\s+/);
  return [...new Set(words.filter((w) => w.length > 4))].slice(0, 6);
}

function mapToVisualObjects(keywords = []) {
  if (!keywords.length) return ['abstract geometric shapes', 'soft structured forms'];
  return keywords.slice(0, 3);
}

/* =========================
   SCENE GENERATOR
========================= */

function buildSceneFromEntities(core, entities) {
  const { objects, environment, attributes } = entities;
  const mainObject = objects[0] || 'clean conceptual product visual';
  const envPhrase = environment.length ? `placed in a ${environment[0]}` : 'on a clean minimal background';
  const attrPhrase = attributes.length ? attributes.join(' and ') : 'performance and usability';
  const conceptPhrase = core.statement
    ? `representing the concept of ${core.statement.replace(/["']/g, '')}`
    : '';

  return [
    `a clean product-style scene featuring ${mainObject}`,
    envPhrase,
    `visually highlighting ${attrPhrase}`,
    conceptPhrase,
  ].filter(Boolean).join(', ');
}

/* =========================
   DYNAMIC COMPOSITION
========================= */

const COMPOSITIONS = [
  'center-focused composition with surrounding negative space',
  'balanced asymmetrical layout',
  'central hero object with minimal supporting elements',
  'depth-based layered composition',
];

function generateDynamicComposition() {
  return COMPOSITIONS[Math.floor(Math.random() * COMPOSITIONS.length)];
}

/* =========================
   THEME EXTRACTION FROM HASHTAGS
========================= */

function extractThemesFromHashtags(hashtags = '') {
  const tags = String(hashtags || '')
    .split(/[\s#]+/)
    .filter((tag) => tag.length > 2)
    .slice(0, 6);

  const themeMap = {
    social: 'social media and community',
    content: 'creative content production',
    marketing: 'strategic marketing outreach',
    growth: 'exponential business growth',
    automation: 'intelligent workflow automation',
    productivity: 'enhanced productivity and efficiency',
    business: 'professional business success',
    ai: 'artificial intelligence innovation',
    digital: 'digital transformation',
    creative: 'creative excellence',
    design: 'modern design aesthetics',
    strategy: 'strategic planning and execution',
    branding: 'brand identity and visibility',
    engagement: 'audience engagement and interaction',
    impact: 'meaningful impact and results',
  };

  return tags
    .map((tag) => themeMap[tag.toLowerCase()] || tag)
    .join(', ');
}

function generateIconsFromHashtags(hashtags = '') {
  const tags = String(hashtags || '')
    .split(/[\s#]+/)
    .filter((tag) => tag.length > 2)
    .slice(0, 5);

  const iconMap = {
    social: 'social network nodes',
    content: 'document and media icons',
    marketing: 'megaphone and target icons',
    growth: 'upward trending chart icon',
    automation: 'gears and workflow icons',
    productivity: 'checkmark and efficiency icons',
    business: 'briefcase and success icons',
    ai: 'neural network and brain icons',
    digital: 'digital interface icons',
    creative: 'palette and design icons',
    design: 'layout and design icons',
    strategy: 'chess piece and planning icons',
    branding: 'brand and identity icons',
    engagement: 'handshake and interaction icons',
    impact: 'star and result icons',
  };

  return tags
    .map((tag) => iconMap[tag.toLowerCase()] || 'abstract geometric icon')
    .slice(0, 4);
}

/* =========================
   RANDOM ICON AREA GENERATOR
========================= */

function generateRandomIconAreaContent(themes) {
  const options = [
    'key benefits with descriptive labels',
    'special offers and promotional highlights',
    'call-to-action buttons with text',
    'bullet point advantages list',
    'feature checkmarks with descriptions',
    'value proposition highlights',
    'testimonial or social proof indicators',
  ];
  
  const randomOption = options[Math.floor(Math.random() * options.length)];
  return randomOption;
}

/* =========================
   DYNAMIC BACKGROUND GENERATOR
========================= */

function generateDynamicBackground(concept, themes) {
  const conceptLower = String(concept || '').toLowerCase();
  
  // Detect context-based backgrounds with FULL-WIDTH emphasis
  if (/social|instagram|facebook|linkedin|tiktok|twitter/.test(conceptLower)) {
    return 'full-width vibrant social media feed aesthetic background with gradient energy, connected users sharing content across entire canvas, dynamic social engagement scene';
  }
  if (/grow|scale|expand|increase|boost/.test(conceptLower)) {
    return 'full-width dynamic upward growth visualization background with rising elements, momentum and expansion energy filling entire space, ascending trajectory scene';
  }
  if (/automat|workflow|process|pipeline/.test(conceptLower)) {
    return 'full-width active workflow background in motion with interconnected processes, automation systems operating smoothly, industrial/tech environment filling canvas';
  }
  if (/market|sell|offer|deal|promo/.test(conceptLower)) {
    return 'full-width compelling marketplace background showing active commerce, products displayed, shopping environment filling entire space with attractive presentation';
  }
  if (/create|design|build|innovate/.test(conceptLower)) {
    return 'full-width creative workspace background in action, design elements being crafted, innovation happening across canvas in real-time';
  }
  if (/team|collaborate|together|community/.test(conceptLower)) {
    return 'full-width vibrant team collaboration background with people working together, community engagement energy filling entire image';
  }
  if (/success|achieve|win|victory|accomplish/.test(conceptLower)) {
    return 'full-width celebratory success environment background with achievement symbols, winning momentum and energy across entire canvas';
  }
  if (/learn|educate|train|skill|master/.test(conceptLower)) {
    return 'full-width active learning environment background with educational content in use, knowledge transfer happening across space';
  }
  if (/fast|speed|quick|instant|rapid/.test(conceptLower)) {
    return 'full-width dynamic high-speed environment background showing motion and rapid action, velocity and quickness filling canvas';
  }
  
  // Theme-based backgrounds
  if (themes.includes('creative')) return 'full-width vibrant creative studio background with design work in progress, artistic energy filling entire space';
  if (themes.includes('growth')) return 'full-width dynamic growth trajectory background with expanding upward momentum across canvas';
  if (themes.includes('business')) return 'full-width professional business environment background showing commerce and success filling space';
  if (themes.includes('digital')) return 'full-width modern digital interface environment background with technology in action';
  if (themes.includes('automation')) return 'full-width efficient automated system background operating with smooth workflow';
  
  // Default
  return 'full-width bright energetic background with active motion, engaging and dynamic atmosphere filling entire canvas';
}

/* =========================
   SPECIALIZED PROMPT BUILDERS (DATA-DRIVEN, CONCISE)
========================= */

// Analyze post heading to extract tone and urgency
function analyzeHeadingTone(heading) {
  const headingLower = String(heading || '').toLowerCase();
  const tones = {
    urgency: /asap|today|now|urgent|limited|hurry|quick|fast|24\s*hour/i.test(headingLower),
    celebration: /amazing|awesome|incredible|fantastic|transform|revolutio|exclusive|special/i.test(headingLower),
    education: /learn|master|guide|training|course|skill|discover|unlocking|unleash/i.test(headingLower),
    professional: /business|professional|corporate|enterprise|solution|system/i.test(headingLower),
    casual: /just|easy|simple|fun|cool|free|bonus|hack/i.test(headingLower),
  };
  return Object.entries(tones)
    .filter(([, value]) => value)
    .map(([tone]) => tone);
}

// Generate context-specific icon descriptions
function generateSpecificIconDescription(heading, themes, contentType) {
  const tone = analyzeHeadingTone(heading);
  
  if (contentType.includes('benefits')) {
    return 'checkmark icons, star badges, and value labels showing key benefits and features';
  } else if (contentType.includes('offers')) {
    return 'discount badges, limited-time icons, and price highlight symbols';
  } else if (contentType.includes('call-to-action')) {
    return 'action buttons, arrow indicators, and engagement prompts';
  } else if (contentType.includes('bullet')) {
    return 'numbered points, key highlights, and feature list items';
  } else if (contentType.includes('testimonial')) {
    return 'user avatars, testimonial quotes, and social proof indicators';
  } else if (contentType.includes('checkmarks')) {
    return 'verification checkmarks, quality assurance icons, and feature confirmations';
  } else if (contentType.includes('proposition')) {
    return 'value icons, benefit symbols, and solution indicators';
  }
  return 'contextual icons representing core benefits and features';
}

/* =========================
   FINAL PROMPT BUILDER - CONCISE AND SPECIFIC
========================= */

function buildStyledImagePrompt(concept, options = {}) {
  const {
    template,
    visualStyle,
    aspectRatio = '1:1',
    additionalElements = [],
    heading = '',
    hashtags = '',
  } = options;

  const resolvedStyle =
    VISUAL_STYLES[template] ? template :
    TEMPLATE_STYLE_MAP[template] ? TEMPLATE_STYLE_MAP[template] :
    VISUAL_STYLES[visualStyle] ? visualStyle :
    'minimal';

  const core = extractCoreMessage(concept);
  const entities = extractEntities(concept);
  
  const fallbackKeywords = [
    ...extractVisualSignals(concept),
    ...additionalElements.map((e) => String(e).toLowerCase().trim()).filter(Boolean),
  ];
  const fallbackVisuals = mapToVisualObjects(fallbackKeywords);
  const visual = VISUAL_STYLES[resolvedStyle] || VISUAL_STYLES.minimal;
  const composition = generateDynamicComposition();

  // Extract themes and generate specific content
  const themes = extractThemesFromHashtags(hashtags);
  const dynamicBackground = generateDynamicBackground(concept, themes.split(', '));
  const iconAreaContent = generateRandomIconAreaContent(themes);
  const specificIcons = generateSpecificIconDescription(heading, themes, iconAreaContent);

  // Format heading for display (max 3 words per line)
  const formattedHeading = String(heading || '')
    .split(/\s+/)
    .slice(0, 7)
    .reduce((lines, word, idx) => {
      if (idx % 3 === 0) lines.push(word);
      else lines[lines.length - 1] += ` ${word}`;
      return lines;
    }, [])
    .join('\n');

  // Extract key words from heading and concept for specificity
  const keyWords = String(heading || '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 4)
    .join(', ');

  return [
    `A professional, high-quality social media image with full-width background and integrated text elements.`,

    `LAYOUT & COMPOSITION:
      Full-width ${visual.style} design. Background fills 100% of canvas showing ${dynamicBackground.substring(0, 60)}...
      Heading "${formattedHeading}" displayed prominently in left-aligned position, large and bold.
      Lower section features ${specificIcons} with descriptive labels and text integration.
    `,

    `BACKGROUND: ${dynamicBackground}. Professional, immersive, directly supporting the message "${keyWords}". No empty spaces.`,

    `HEADING: "${formattedHeading}" - Large, bold, left-aligned, bright contrasting color against background.`,

    `VISUAL ELEMENTS: ${specificIcons}. Modern flat vector style, vibrant colors matching theme palette. Distributed across lower section with clear text labels.`,

    `TEXT INTEGRATION: All text elements readable and seamlessly integrated. Heading left-aligned. Icon labels and benefit text clearly visible. Typography professional and polished.`,

    `SCENE CONTEXT: ${entities.objects.join(', ') || 'Professional focal point'}. Emphasizing ${entities.attributes.join(', ') || 'topic relevance'}. Mood: ${core.emotion}, energetic, professional.`,

    `STYLE SPECIFICS: ${visual.style}. Lighting: ${visual.lighting}. Details: ${visual.details}. Composition: ${composition}.`,

    `VISUAL PALETTE: ${COLOR_SYSTEM.base} with ${COLOR_SYSTEM.accent} accents. Professional, cohesive design optimized for social media sharing.`,

    `Quality: 4k, ultra high-quality, sharp, professional grade. No visible borders or zone divisions. All elements integrated seamlessly.`,
  ]
    .join(' ')
    .replace(/["'\u2018\u2019\u201c\u201d]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* =========================
   VALIDATION
========================= */

function validateImagePrompt(prompt) {
  const text = String(prompt || '').toLowerCase();
  const warnings = [];
  if (!text.includes('avoid:')) warnings.push('Missing Avoid section.');
  if (!text.includes('composition:')) warnings.push('Missing Composition section.');
  if (!text.includes('quality:')) warnings.push('Missing Quality section.');
  if (text.length < 280) warnings.push('Prompt too short for consistent output control.');
  return {
    isValid: warnings.length === 0,
    warnings,
    recommendation: warnings.length === 0 ? 'Prompt is well-structured.' : `Fix: ${warnings.join(' | ')}`,
  };
}

/* =========================
   EXPORTS
========================= */

module.exports = {
  buildStyledImagePrompt,
  validateImagePrompt,
  VISUAL_STYLES,
  COLOR_SYSTEM,
  TEMPLATE_STYLE_MAP,
};
