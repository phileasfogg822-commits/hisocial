/**
 * =========================================
 * VISUAL INTELLIGENCE ENGINE v1.0
 * Strategic Decision-Making Layer for Creative Generation
 * 18 Phases: Input → Rendering Instructions
 * =========================================
 */

/* PHASE 1: INPUT NORMALIZATION */
function normalizeInput(input) {
  return {
    tone: String(input.tone || 'professional').toLowerCase().trim(),
    niche: String(input.niche || '').toLowerCase().trim(),
    category: String(input.category || '').toLowerCase().trim(),
    topic: String(input.topic || '').toLowerCase().trim(),
    post_text: String(input.post_text || '').toLowerCase().trim(),
    heading: String(input.heading || '').trim(),
    hashtags: String(input.hashtags || '').split('#').filter(Boolean).map(h => h.trim()),
    ratio: String(input.ratio || '1:1'),
    style: String(input.style || 'minimal').toLowerCase().trim(),
  };
}

/* PHASE 2: CONTENT DECOMPOSITION */
function decomposeContent(normalized) {
  const businessKeywords = normalized.niche || normalized.category;
  const offerMatch = normalized.topic.match(/(in \d+ \w+|today|asap|free|unlimited)/i);
  const offer = offerMatch ? offerMatch[0] : 'Service';

  // Extract urgency signals
  const urgencyPatterns = {
    today: /today|now|asap|urgent/i,
    limited: /limited|exclusive|only|rare/i,
    time: /\d+\s*(day|hour|minute|second)/i,
  };

  const urgency = Object.entries(urgencyPatterns)
    .filter(([, regex]) => regex.test(normalized.post_text))
    .map(([key]) => key);

  // Extract benefits from post text
  const benefits = [];
  if (/fast|quick|speed/.test(normalized.post_text)) benefits.push('speed');
  if (/easy|simple|no code/.test(normalized.post_text)) benefits.push('simplicity');
  if (/grow|scale|expand|boost/.test(normalized.post_text)) benefits.push('growth');
  if (/trust|reliable|secure|safe/.test(normalized.post_text)) benefits.push('trust');
  if (/transform|revolutio|powerful/.test(normalized.post_text)) benefits.push('transformation');

  return {
    business: businessKeywords,
    offer,
    outcome: extractOutcome(normalized.topic),
    benefits: benefits.length > 0 ? benefits : ['efficiency'],
    urgency: urgency.length > 0 ? urgency : [],
  };
}

function extractOutcome(topic) {
  const outcomeMap = {
    'online presence': 'visibility',
    'more customers': 'growth',
    'sales': 'revenue',
    'leads': 'opportunity',
    'traffic': 'reach',
    'engagement': 'interaction',
    'website': 'online_business',
    'app': 'digital_solution',
  };

  for (const [key, value] of Object.entries(outcomeMap)) {
    if (topic.includes(key)) return value;
  }

  return topic.split(/\s+/).slice(0, 2).join('_');
}

/* PHASE 3: MARKETING INTENT EXTRACTION */
function extractMarketingIntent(normalized, decomposed) {
  const cta = /click|get|start|book|launch|claim|order/i.test(normalized.post_text);
  const educational = /discover|learn|guide|how to|tips/i.test(normalized.post_text);
  const comparative = /vs|better|faster|superior/i.test(normalized.post_text);

  if (cta) return 'conversion';
  if (comparative) return 'consideration';
  if (educational) return 'awareness';
  return 'conversion'; // Default to conversion for business posts
}

/* PHASE 4: VISUAL ENTITY EXTRACTION */
function extractVisualEntities(normalized, decomposed) {
  // RULE: Visualize the customer/business, NOT the service
  const businessEntityMap = {
    'website': 'digital_business',
    'app': 'tech_startup',
    'car wash': 'car_wash_business',
    'restaurant': 'restaurant',
    'clinic': 'health_clinic',
    'salon': 'beauty_salon',
    'gym': 'fitness_center',
    'real estate': 'property',
    'accounting': 'business_office',
    'marketing': 'creative_agency',
    'photography': 'studio',
    'consulting': 'professional_office',
  };

  let primary = 'business_professional';
  for (const [key, value] of Object.entries(businessEntityMap)) {
    if (normalized.category.includes(key) || normalized.niche.includes(key)) {
      primary = value;
      break;
    }
  }

  const supportingEntities = [];
  if (decomposed.urgency.includes('time')) supportingEntities.push('clock', 'speed');
  if (decomposed.benefits.includes('growth')) supportingEntities.push('chart', 'uptrend');
  if (decomposed.benefits.includes('trust')) supportingEntities.push('shield', 'checkmark');
  if (decomposed.benefits.includes('simplicity')) supportingEntities.push('interface', 'smooth');

  return {
    primary,
    secondary: normalized.niche || normalized.category,
    supporting: supportingEntities.slice(0, 3),
  };
}

/* PHASE 5: VISUAL PSYCHOLOGY ENGINE */
function selectColorPalette(normalized, decomposed, entities) {
  const psychologyMap = {
    'trust': { primary: '#0066CC', secondary: '#E8F0F8', accent: '#00AA33' },
    'luxury': { primary: '#1a1a1a', secondary: '#FFD700', accent: '#8B7355' },
    'nature': { primary: '#2D5016', secondary: '#E8F5E9', accent: '#4CAF50' },
    'urgency': { primary: '#DC2626', secondary: '#FEF2F2', accent: '#F59E0B' },
    'technology': { primary: '#0F172A', secondary: '#E0F2FE', accent: '#06B6D4' },
    'health': { primary: '#065F46', secondary: '#F0FDF4', accent: '#FFFFFF' },
    'finance': { primary: '#002D5C', secondary: '#F0F7FF', accent: '#0066CC' },
    'beauty': { primary: '#5B2C5F', secondary: '#FAF7F2', accent: '#FF69B4' },
  };

  // Determine dominant psychology
  let psychology = 'trust'; // default
  if (decomposed.urgency.length > 0) psychology = 'urgency';
  if (normalized.niche.includes('tech')) psychology = 'technology';
  if (normalized.niche.includes('health')) psychology = 'health';
  if (normalized.niche.includes('beauty')) psychology = 'beauty';
  if (normalized.niche.includes('finance')) psychology = 'finance';

  return psychologyMap[psychology] || psychologyMap.trust;
}

/* PHASE 6: STYLE ENGINE */
function determineStyleRules(style, normalized) {
  const styleRules = {
    minimal: {
      name: 'minimal',
      hero_count: 1,
      icon_max: 4,
      font_max: 2,
      whitespace_min: 35,
      whitespace_max: 60,
      approach: 'ultra clean, subtle, spacious',
    },
    premium: {
      name: 'premium',
      hero_count: 1,
      icon_max: 3,
      font_max: 2,
      whitespace_min: 40,
      whitespace_max: 55,
      approach: 'dark backgrounds, high contrast, luxury',
    },
    corporate: {
      name: 'corporate',
      hero_count: 1,
      icon_max: 5,
      font_max: 3,
      whitespace_min: 25,
      whitespace_max: 40,
      approach: 'grid layouts, conservative, structured',
    },
    modern: {
      name: 'modern',
      hero_count: 1,
      icon_max: 4,
      font_max: 2,
      whitespace_min: 30,
      whitespace_max: 50,
      approach: 'bold typography, clean lines, contemporary',
    },
  };

  return styleRules[style] || styleRules.minimal;
}

/* PHASE 7: HERO OBJECT ENGINE */
function selectHeroObject(entities, normalized) {
  // RULE: Business > Service
  const heroMap = {
    'car_wash_business': 'busy car wash with customers',
    'restaurant': 'vibrant restaurant interior with customers',
    'health_clinic': 'modern medical clinic waiting area',
    'beauty_salon': 'elegant salon environment',
    'fitness_center': 'active gym with people training',
    'property': 'stunning real estate property',
    'professional_office': 'modern professional workspace',
    'creative_agency': 'dynamic creative studio',
    'tech_startup': 'innovative tech office environment',
    'digital_business': 'professional digital workspace',
  };

  const hero = heroMap[entities.primary] || 'professional business environment';

  return {
    object: hero,
    detail_level: 'high',
    realism: 'photorealistic',
    emotional_appeal: 'professional and trustworthy',
  };
}

/* PHASE 8: LAYOUT ENGINE */
function defineLayoutZones(ratio) {
  const [width, height] = ratio.split(':').map(Number);
  const aspectRatio = width / height;

  return {
    ratio: ratio,
    grid: '100x100',
    zones: {
      safe_top: { start: 0, end: 30, description: 'safe zone - no text' },
      headline: { start: 31, end: 60, description: 'heading - max 3 words per line' },
      benefits_cta: { start: 61, end: 90, description: 'benefits, icons, CTA' },
      safe_bottom: { start: 91, end: 100, description: 'safe zone - no text' },
    },
    margins: {
      left: 10,
      right: 10,
      content_width: 80,
    },
  };
}

/* PHASE 9: INFORMATION HIERARCHY */
function defineHierarchy(decomposed, style) {
  const hierarchy = {
    headline: 45,
    hero: 30,
    benefits: 15,
    cta: 7,
    hashtags: 3,
  };

  return hierarchy;
}

/* PHASE 10: HEADLINE OPTIMIZATION */
function optimizeHeadline(heading) {
  const words = heading.split(/\s+/);
  const lines = [];
  let currentLine = [];

  for (const word of words) {
    currentLine.push(word);
    if (currentLine.length === 3 || words.indexOf(word) === words.length - 1) {
      lines.push(currentLine.join(' '));
      currentLine = [];
    }
  }

  return {
    original: heading,
    optimized: lines.join('\n'),
    lines: lines,
    typography: {
      h1: '72-120px',
      h2: '40-60px',
      body: '24-36px',
      cta: '28-40px',
    },
  };
}

/* PHASE 11: BENEFIT EXTRACTION ENGINE */
function extractBenefits(decomposed, normalized) {
  const benefitIconMap = {
    speed: 'clock icon',
    simplicity: 'checkmark icon',
    growth: 'upward chart icon',
    trust: 'shield icon',
    transformation: 'star icon',
    efficiency: 'lightning bolt icon',
    security: 'lock icon',
    support: 'headset icon',
  };

  const benefits = decomposed.benefits.slice(0, 4).map((benefit) => ({
    name: benefit,
    icon: benefitIconMap[benefit] || 'feature icon',
    description: generateBenefitDescription(benefit, normalized),
  }));

  return benefits;
}

function generateBenefitDescription(benefit, normalized) {
  const descriptions = {
    speed: 'Lightning-fast setup',
    simplicity: 'No technical skills needed',
    growth: 'Scale your business',
    trust: 'Secure and reliable',
    transformation: 'Complete solution',
    efficiency: 'Maximize productivity',
    security: 'Enterprise-grade security',
    support: '24/7 support included',
  };
  return descriptions[benefit] || benefit;
}

/* PHASE 12: CTA ENGINE */
function generateCTA(normalized, decomposed, intent) {
  const verbMap = {
    conversion: ['Get Started', 'Launch Now', 'Claim Offer', 'Get Website Now'],
    awareness: ['Discover More', 'Learn How', 'See Inside'],
    consideration: ['Compare Now', 'See Difference'],
    retention: ['Try Premium', 'Upgrade Now'],
  };

  const ctaOptions = verbMap[intent] || verbMap.conversion;
  return {
    text: ctaOptions[0],
    alternatives: ctaOptions,
    icon: 'arrow-right',
    position: 'lower-right',
  };
}

/* PHASE 13: DEPTH ENGINE */
function defineLayers() {
  return {
    layers: [
      { level: 1, name: 'background', description: 'full-width immersive background' },
      { level: 2, name: 'environment', description: 'contextual setting' },
      { level: 3, name: 'hero', description: 'primary business object' },
      { level: 4, name: 'benefits', description: 'icons and text elements' },
      { level: 5, name: 'typography', description: 'headline and body text' },
      { level: 6, name: 'cta', description: 'call-to-action button' },
    ],
    minimum_layers: 5,
  };
}

/* PHASE 14: WHITESPACE ENGINE */
function calculateWhitespace(style) {
  const styleTargets = {
    minimal: { min: 40, max: 60, target: 50 },
    premium: { min: 40, max: 55, target: 48 },
    corporate: { min: 25, max: 40, target: 33 },
    modern: { min: 30, max: 50, target: 40 },
  };

  return styleTargets[style] || styleTargets.minimal;
}

/* PHASE 15: BALANCE ENGINE */
function defineBalance() {
  return {
    rule: 'Text Left + Visual Right OR Visual Left + Text Right',
    avoid: 'centering everything',
    balance_score: 'visual_weight_left ≈ visual_weight_right',
  };
}

/* PHASE 16: THUMBNAIL TEST */
function generateThumbnailTest(hero, heading, cta) {
  return {
    shrink_to: '100px',
    must_identify: {
      business: 'within 1 second',
      offer: 'within 2 seconds',
      cta: 'within 2 seconds',
    },
    test_items: [
      `Hero object: ${hero.object}`,
      `Heading: ${heading.optimized.replace(/\n/g, ' ')}`,
      `CTA: ${cta.text}`,
    ],
  };
}

/* PHASE 17: SOCIAL PLATFORM OPTIMIZATION */
function optimizeForPlatform(normalized) {
  const platformRules = {
    instagram: {
      priority: 'visual-first',
      headline: 'large, bold',
      text: 'minimal',
      hero: 'strong, eye-catching',
    },
    linkedin: {
      priority: 'professional',
      headline: 'corporate-friendly',
      text: 'data-driven, moderate',
      hero: 'business-oriented',
    },
    facebook: {
      priority: 'cta-first',
      headline: 'friendly, conversational',
      text: 'moderate to detailed',
      hero: 'relatable, warm',
    },
  };

  return platformRules.instagram; // Default; extend based on platform parameter
}

/* PHASE 18: RENDERING PROMPT CREATION */
function createRenderingInstructions(allDecisions) {
  return {
    hero_object: allDecisions.hero.object,
    hero_detail: allDecisions.hero.detail_level,
    layout_zones: allDecisions.layout.zones,
    color_palette: allDecisions.colors,
    typography: {
      headline: allDecisions.headline.typography.h1,
      body: allDecisions.headline.typography.body,
      cta: allDecisions.headline.typography.cta,
    },
    icons: allDecisions.benefits.map((b) => b.icon),
    cta: allDecisions.cta.text,
    background: `full-width ${allDecisions.intent} background supporting ${allDecisions.decomposed.business}`,
    lighting: 'professional, bright, welcoming',
    style: allDecisions.style.approach,
    layers: allDecisions.layers.layers,
    whitespace_target: allDecisions.whitespace.target,
    headline_text: allDecisions.headline.optimized,
    benefits: allDecisions.benefits,
  };
}

/* GOLDEN RULES VALIDATION */
function validateDesignDecisions(decisions) {
  const scores = {
    clarity: 0,
    hierarchy: 0,
    readability: 0,
    brand_relevance: 0,
    conversion: 0,
  };

  // Clarity: Simple message, one hero
  scores.clarity = decisions.hero.object && decisions.headline.lines.length <= 3 ? 90 : 70;

  // Hierarchy: Benefits extracted, CTA defined
  scores.hierarchy = decisions.benefits.length >= 3 && decisions.cta.text ? 85 : 70;

  // Readability: Headline optimized, whitespace target
  scores.readability = decisions.headline.lines.length <= 3 ? 90 : 75;

  // Brand relevance: Colors selected, style matched
  scores.brand_relevance = decisions.colors && decisions.style ? 85 : 70;

  // Conversion: CTA present, urgency signals
  scores.conversion = decisions.cta && decisions.decomposed.urgency.length > 0 ? 90 : 75;

  const allAboveThreshold = Object.values(scores).every((s) => s >= 75);

  return {
    scores,
    passed: allAboveThreshold,
    avg_score: Math.round(Object.values(scores).reduce((a, b) => a + b) / 5),
    recommendation: allAboveThreshold ? 'APPROVED_FOR_RENDERING' : 'REQUIRES_REFINEMENT',
  };
}

/* MAIN ENGINE FUNCTION */
function executeVisualIntelligenceEngine(input) {
  // PHASE 1
  const normalized = normalizeInput(input);

  // PHASE 2
  const decomposed = decomposeContent(normalized);

  // PHASE 3
  const intent = extractMarketingIntent(normalized, decomposed);

  // PHASE 4
  const entities = extractVisualEntities(normalized, decomposed);

  // PHASE 5
  const colors = selectColorPalette(normalized, decomposed, entities);

  // PHASE 6
  const styleRules = determineStyleRules(normalized.style, normalized);

  // PHASE 7
  const hero = selectHeroObject(entities, normalized);

  // PHASE 8
  const layout = defineLayoutZones(normalized.ratio);

  // PHASE 9
  const hierarchy = defineHierarchy(decomposed, styleRules);

  // PHASE 10
  const headline = optimizeHeadline(normalized.heading);

  // PHASE 11
  const benefits = extractBenefits(decomposed, normalized);

  // PHASE 12
  const cta = generateCTA(normalized, decomposed, intent);

  // PHASE 13
  const layers = defineLayers();

  // PHASE 14
  const whitespace = calculateWhitespace(normalized.style);

  // PHASE 15
  const balance = defineBalance();

  // PHASE 16
  const thumbnail = generateThumbnailTest(hero, headline, cta);

  // PHASE 17
  const platformOptimization = optimizeForPlatform(normalized);

  // Consolidate all decisions
  const allDecisions = {
    input: normalized,
    decomposed,
    intent,
    entities,
    colors,
    style: styleRules,
    hero,
    layout,
    hierarchy,
    headline,
    benefits,
    cta,
    layers,
    whitespace,
    balance,
    thumbnail,
    platformOptimization,
  };

  // PHASE 18
  const renderingInstructions = createRenderingInstructions(allDecisions);

  // VALIDATION
  const validation = validateDesignDecisions(allDecisions);

  return {
    status: 'success',
    decisions: allDecisions,
    rendering_instructions: renderingInstructions,
    validation,
  };
}

module.exports = {
  executeVisualIntelligenceEngine,
  normalizeInput,
  decomposeContent,
  extractMarketingIntent,
  extractVisualEntities,
  selectColorPalette,
  determineStyleRules,
  selectHeroObject,
  defineLayoutZones,
  defineHierarchy,
  optimizeHeadline,
  extractBenefits,
  generateCTA,
  defineLayers,
  calculateWhitespace,
  defineBalance,
  generateThumbnailTest,
  optimizeForPlatform,
  createRenderingInstructions,
  validateDesignDecisions,
};
