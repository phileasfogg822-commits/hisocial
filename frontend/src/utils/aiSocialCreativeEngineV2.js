/**
 * AI SOCIAL CREATIVE ENGINE v2.0 - FRONTEND VERSION
 * 
 * ES6 Module for React Frontend
 * Identical functionality to backend version
 */

// ============================================================================
// AGENT 1: INPUT NORMALIZER
// ============================================================================

export function normalizeInput(rawInput) {
  return {
    tone: rawInput.tone || 'professional',
    niche: rawInput.niche || '',
    category: rawInput.category || '',
    topic: rawInput.topic || '',
    post_text: rawInput.post_text || '',
    heading: rawInput.heading || '',
    hashtags: Array.isArray(rawInput.hashtags) 
      ? rawInput.hashtags 
      : (rawInput.hashtags || '').split(/[\s,#]+/).filter(Boolean),
    ratio: rawInput.ratio || '1:1',
    style: rawInput.style || 'modern'
  };
}

// ============================================================================
// AGENT 2: MARKETING STRATEGIST
// ============================================================================

export function analyzeMarketingStrategy(input) {
  const text = `${input.heading} ${input.topic} ${input.post_text}`.toLowerCase();
  
  const strongOfferPatterns = [
    /\d+%\s*(?:off|discount)/i,
    /limited\s*stock/i,
    /first\s*\d+/i,
    /exclusive/i,
    /free\s*(?:shipping|delivery)/i,
    /flash\s*sale/i,
    /limited\s*time/i
  ];
  
  const offerStrength = strongOfferPatterns.some(pattern => pattern.test(text)) ? 'high' : 'medium';
  
  let campaignType = 'awareness';
  if (text.includes('buy') || text.includes('order') || text.includes('shop')) campaignType = 'conversion';
  if (text.includes('learn') || text.includes('discover') || text.includes('explore')) campaignType = 'consideration';
  if (text.includes('get started') || text.includes('try') || text.includes('free trial')) campaignType = 'conversion';
  
  const business = extractBusiness(input);
  const offer = extractOffer(text);
  const outcome = extractOutcome(text);
  const benefits = extractBenefits(text);
  const urgency = urgencyLevel(text);
  
  return {
    business,
    offer,
    outcome,
    benefits,
    urgency,
    offer_strength: offerStrength,
    campaign_type: campaignType
  };
}

function extractBusiness(input) {
  return input.niche || input.category || 'business';
}

function extractOffer(text) {
  const percentMatch = text.match(/(\d+)%\s*(?:off|discount)/i);
  if (percentMatch) return `${percentMatch[1]}% OFF`;
  if (text.includes('free')) return 'FREE OFFER';
  if (text.includes('new') || text.includes('launch')) return 'NEW LAUNCH';
  if (text.includes('limited') || text.includes('exclusive')) return 'LIMITED TIME';
  return 'SPECIAL OFFER';
}

function extractOutcome(text) {
  const outcomeKeywords = ['achieve', 'get', 'create', 'build', 'grow', 'transform', 'become'];
  for (const keyword of outcomeKeywords) {
    const index = text.indexOf(keyword);
    if (index !== -1) {
      const endIndex = Math.min(index + 50, text.length);
      return text.substring(index, endIndex).split(/[.!?\n]/)[0].trim();
    }
  }
  return 'Achieve your goals';
}

function extractBenefits(text) {
  const benefits = [];
  const benefitPatterns = {
    'speed': /fast|quick|instant|speed|rapid|rush/i,
    'simplicity': /easy|simple|straightforward|hassle-free|automated/i,
    'growth': /grow|scale|expand|increase|boost/i,
    'trust': /secure|safe|trusted|reliable|verified/i,
    'quality': /premium|high-quality|professional|expert/i,
    'savings': /save|discount|cheap|affordable|budget/i,
    'innovation': /innovation|next-gen|cutting-edge|revolutionary/i,
    'support': /support|help|assistance|team|service/i
  };
  
  for (const [benefit, pattern] of Object.entries(benefitPatterns)) {
    if (pattern.test(text) && benefits.length < 4) {
      benefits.push(benefit);
    }
  }
  
  return benefits.length > 0 ? benefits : ['quality', 'growth'];
}

function urgencyLevel(text) {
  const urgentPatterns = [
    /today|now|immediate|urgent|asap|quickly/i,
    /limited\s*(?:time|stock|offer)/i,
    /first\s*\d+/i,
    /ends?\s*(?:today|tonight|soon)/i
  ];
  
  const urgentCount = urgentPatterns.filter(p => p.test(text)).length;
  return urgentCount >= 2 ? 'high' : (urgentCount === 1 ? 'medium' : 'low');
}

// ============================================================================
// AGENT 3: CUSTOMER PSYCHOLOGY ANALYZER
// ============================================================================

export function analyzeCustomerPsychology(input, marketing) {
  const text = `${input.heading} ${input.topic}`.toLowerCase();
  
  return {
    who: identifyTargetAudience(input, marketing),
    what: identifyWhatTheyWant(marketing),
    why: identifyWhyTheyWant(text),
    fear: identifyFear(text),
    desire: identifyDesire(text),
    identity: identifyIdentity(input, marketing)
  };
}

function identifyTargetAudience(input, marketing) {
  const audiences = {
    'restaurant': 'food lovers',
    'cafe': 'coffee enthusiasts',
    'gym': 'fitness seekers',
    'clinic': 'health-conscious individuals',
    'ecommerce': 'savvy shoppers',
    'website': 'business owners',
    'saas': 'professionals',
    'garden': 'gardening enthusiasts',
    'beauty': 'beauty-conscious consumers',
    'tech': 'tech-savvy users'
  };
  
  for (const [category, audience] of Object.entries(audiences)) {
    if (input.category.toLowerCase().includes(category) || input.niche.toLowerCase().includes(category)) {
      return audience;
    }
  }
  
  return 'target customers';
}

function identifyWhatTheyWant(marketing) {
  return marketing.offer || 'your solution';
}

function identifyWhyTheyWant(text) {
  const reasons = [];
  if (text.includes('save')) reasons.push('save time');
  if (text.includes('money') || text.includes('save')) reasons.push('save money');
  if (text.includes('grow') || text.includes('expand')) reasons.push('grow their business');
  if (text.includes('health') || text.includes('fit')) reasons.push('improve health');
  if (text.includes('quality')) reasons.push('get quality');
  
  return reasons.length > 0 ? reasons.join(', ') : 'achieve their goals';
}

function identifyFear(text) {
  const fears = {
    'waste': 'wasting money on wrong solution',
    'fail': 'failing to achieve results',
    'time': 'wasting time',
    'complexity': 'complexity overwhelming them',
    'quality': 'getting low quality',
    'support': 'not getting support',
    'scam': 'being scammed'
  };
  
  for (const [key, fear] of Object.entries(fears)) {
    if (text.includes(key)) return fear;
  }
  
  return 'not getting results';
}

function identifyDesire(text) {
  const desires = {
    'success': 'become successful',
    'grow': 'grow their business',
    'health': 'be healthy and fit',
    'quality': 'enjoy quality',
    'peace': 'have peace of mind',
    'luxury': 'live luxuriously',
    'transform': 'transform their life',
    'belong': 'feel part of community'
  };
  
  for (const [key, desire] of Object.entries(desires)) {
    if (text.includes(key)) return desire;
  }
  
  return 'achieve success';
}

function identifyIdentity(input, marketing) {
  const identities = {
    'entrepreneur': 'innovative business builder',
    'professional': 'ambitious career climber',
    'health': 'health-conscious self-improver',
    'eco': 'environmentally conscious citizen',
    'luxury': 'discerning luxury enthusiast',
    'practical': 'pragmatic problem solver',
    'creative': 'creative innovator',
    'community': 'community-oriented person'
  };
  
  for (const [key, identity] of Object.entries(identities)) {
    if (input.niche.toLowerCase().includes(key) || input.category.toLowerCase().includes(key)) {
      return identity;
    }
  }
  
  return 'successful person';
}

// ============================================================================
// AGENT 4: CATEGORY EXPERT
// ============================================================================

export const CATEGORY_VISUAL_LIBRARY = {
  'restaurant': {
    mandatory: ['food', 'plates', 'ingredients', 'dining setup', 'vibrant colors'],
    optional: ['chef', 'customers enjoying', 'ambiance', 'table setting'],
    forbidden: ['laptops', 'dashboards', 'abstract icons']
  },
  'cafe': {
    mandatory: ['coffee', 'cups', 'beans', 'steam', 'warm atmosphere'],
    optional: ['barista', 'customers', 'pastries', 'cozy seating'],
    forbidden: ['corporate', 'technical', 'abstract']
  },
  'garden_supplies': {
    mandatory: ['plants', 'pots', 'soil', 'green leaves', 'natural materials'],
    optional: ['watering can', 'herbs', 'eco packaging', 'sunlight'],
    forbidden: ['plastic', 'synthetic', 'corporate']
  },
  'gym': {
    mandatory: ['weights', 'equipment', 'fit people', 'movement', 'energy'],
    optional: ['trainer', 'endorphin', 'transformation', 'strength'],
    forbidden: ['exhaustion', 'pain', 'negative emotion']
  },
  'clinic': {
    mandatory: ['medical setting', 'caring professionals', 'patient', 'modern equipment'],
    optional: ['wellness', 'recovery', 'results', 'trust'],
    forbidden: ['pain', 'needles', 'suffering']
  },
  'car_wash': {
    mandatory: ['car', 'water', 'foam', 'shine', 'cleanliness'],
    optional: ['happy customer', 'sparkle', 'detail work', 'transformation'],
    forbidden: ['dirt', 'grime', 'neglect']
  },
  'ecommerce': {
    mandatory: ['product', 'customer hands', 'satisfaction', 'product benefit'],
    optional: ['packaging', 'unboxing', 'quality detail', 'lifestyle context'],
    forbidden: ['warehouse', 'logistics', 'backend']
  },
  'website_builder': {
    mandatory: ['website on screen', 'happy business owner', 'modern design', 'results'],
    optional: ['devices', 'analytics', 'growth', 'transformation'],
    forbidden: ['code', 'technical', 'dashboard']
  },
  'saas': {
    mandatory: ['interface', 'results/metrics', 'happy user', 'productivity'],
    optional: ['collaboration', 'growth', 'automation', 'efficiency'],
    forbidden: ['code', 'bugs', 'errors']
  }
};

export function buildCategoryKnowledge(category) {
  const categoryKey = category.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
  
  for (const [key, visuals] of Object.entries(CATEGORY_VISUAL_LIBRARY)) {
    if (categoryKey.includes(key) || key.includes(categoryKey)) {
      return visuals;
    }
  }
  
  return {
    mandatory: ['primary product/service', 'customer', 'benefit'],
    optional: ['context', 'lifestyle', 'results'],
    forbidden: ['irrelevant', 'distracting', 'competing elements']
  };
}

export function validateCategoryRecognition(category) {
  const specificity = category.split(/\s+/).length;
  if (specificity >= 2) return true;
  if (specificity === 1 && category.length > 4) return true;
  return false;
}

// ============================================================================
// AGENT 5: PRODUCT DETECTION AGENT
// ============================================================================

export function detectProductType(category, text) {
  const textLower = text.toLowerCase();
  
  if (/(product|phone|car|plant|food|clothes|furniture|book|device|equipment)/.test(textLower)) {
    return 'physical';
  }
  
  if (/(software|app|course|template|plugin|extension|tool|platform)/.test(textLower)) {
    return 'digital';
  }
  
  if (/(service|consultation|coaching|training|cleaning|repair|design|development)/.test(textLower)) {
    return 'service';
  }
  
  if (category.includes('saas') || category.includes('software')) return 'digital';
  if (category.includes('cafe') || category.includes('restaurant')) return 'service';
  
  return 'physical';
}

export function enforceProductVisibility(productType) {
  return {
    min_visibility: 20,
    max_visibility: 60,
    required: productType === 'physical',
    hero_object_must_be: productType === 'physical' ? 'product' : null
  };
}

// ============================================================================
// AGENT 6: VISUAL STORY ARCHITECT
// ============================================================================

export function buildVisualStory(category, psychology, marketing, productType) {
  const categoryKnowledge = buildCategoryKnowledge(category);
  
  const story = {
    hero: selectHeroForStory(category, psychology, productType, categoryKnowledge),
    supporting: selectSupportingVisuals(categoryKnowledge, marketing.benefits),
    environment: buildEnvironmentContext(psychology, category),
    emotion: mapEmotionToVisuals(psychology.desire),
    action: identifyKeyAction(marketing.outcome)
  };
  
  return story;
}

function selectHeroForStory(category, psychology, productType, categoryKnowledge) {
  if (productType === 'physical') {
    return `${categoryKnowledge.mandatory[0]} in use`;
  }
  
  if (productType === 'service') {
    return `customer experiencing ${psychology.desire}`;
  }
  
  if (productType === 'digital') {
    return `${psychology.who} achieving results with ${category}`;
  }
  
  return 'customer in moment of success';
}

function selectSupportingVisuals(categoryKnowledge, benefits) {
  return categoryKnowledge.mandatory.slice(1, 3).concat(
    categoryKnowledge.optional.slice(0, 1)
  );
}

function buildEnvironmentContext(psychology, category) {
  const environments = {
    'home': 'modern home setting',
    'office': 'professional office',
    'outdoor': 'natural outdoor setting',
    'studio': 'creative studio',
    'retail': 'upscale retail',
    'garden': 'beautiful garden',
    'kitchen': 'modern kitchen'
  };
  
  for (const [key, env] of Object.entries(environments)) {
    if (psychology.identity.includes(key)) return env;
  }
  
  return 'professional, well-lit setting';
}

function mapEmotionToVisuals(desire) {
  const emotionMap = {
    'success': 'triumphant, confident moment',
    'growth': 'upward, expanding energy',
    'health': 'vitality, energy, glow',
    'peace': 'calm, serene, composed',
    'luxury': 'elegant, refined, premium',
    'community': 'together, connected, belonging',
    'transformation': 'before-to-after sense',
    'achievement': 'milestone, victory moment'
  };
  
  for (const [emotion, visual] of Object.entries(emotionMap)) {
    if (desire.includes(emotion)) return visual;
  }
  
  return 'positive, confident moment';
}

function identifyKeyAction(outcome) {
  return `moment of ${outcome.substring(0, 30)}`;
}

// ============================================================================
// AGENT 7: LAYOUT PLANNER
// ============================================================================

export function planLayout(ratio) {
  const layouts = {
    '1:1': {
      zones: [
        { name: 'safe_top', percentage: '0-20%', content: 'nothing' },
        { name: 'headline', percentage: '20-50%', content: 'text-headline' },
        { name: 'hero', percentage: '35-70%', content: 'product-hero' },
        { name: 'benefits', percentage: '60-85%', content: 'icons-text' },
        { name: 'cta', percentage: '80-95%', content: 'call-to-action' },
        { name: 'safe_bottom', percentage: '90-100%', content: 'nothing' }
      ],
      left_margin: 10,
      right_margin: 10
    },
    '16:9': {
      zones: [
        { name: 'safe_left', percentage: '0-10%', content: 'nothing' },
        { name: 'headline', percentage: '5-30%', content: 'text-headline' },
        { name: 'hero', percentage: '25-75%', content: 'product-hero' },
        { name: 'benefits', percentage: '50-80%', content: 'icons-text' },
        { name: 'cta', percentage: '75-90%', content: 'call-to-action' },
        { name: 'safe_right', percentage: '90-100%', content: 'nothing' }
      ],
      left_margin: 10,
      right_margin: 10
    },
    '9:16': {
      zones: [
        { name: 'safe_top', percentage: '0-10%', content: 'nothing' },
        { name: 'headline', percentage: '10-35%', content: 'text-headline' },
        { name: 'hero', percentage: '25-65%', content: 'product-hero' },
        { name: 'benefits', percentage: '55-80%', content: 'icons-text' },
        { name: 'cta', percentage: '80-95%', content: 'call-to-action' },
        { name: 'safe_bottom', percentage: '95-100%', content: 'nothing' }
      ],
      left_margin: 10,
      right_margin: 10
    }
  };
  
  return layouts[ratio] || layouts['1:1'];
}

// ============================================================================
// AGENT 8: HIERARCHY BUILDER
// ============================================================================

export function buildHierarchy() {
  return {
    headline: 45,
    hero: 30,
    benefits: 15,
    cta: 7,
    hashtags: 3
  };
}

export function performThumbnailTest(hero, headline, cta, category) {
  const components = {
    category_visible: category.length > 0,
    hero_recognizable: hero.length > 10,
    headline_readable: headline.length > 0,
    cta_visible: cta.length > 0
  };
  
  const passCount = Object.values(components).filter(Boolean).length;
  
  return {
    passed: passCount >= 3,
    components,
    score: Math.round((passCount / 4) * 100)
  };
}

// ============================================================================
// AGENT 9: OFFER OPTIMIZER
// ============================================================================

export function optimizeOffer(offer, marketing) {
  const strongOffers = ['15% OFF', 'FREE', 'LIMITED', 'EXCLUSIVE', 'NEW'];
  const isStrong = strongOffers.some(o => offer.toUpperCase().includes(o));
  
  return {
    offer: offer,
    strength: isStrong ? 'high' : 'medium',
    needs_badge: isStrong,
    badge_style: determineBadgeStyle(offer),
    visibility_percentage: isStrong ? 25 : 15
  };
}

function determineBadgeStyle(offer) {
  const offerLower = offer.toLowerCase();
  
  if (offerLower.includes('new')) return 'NEW_LAUNCH';
  if (offerLower.includes('free')) return 'FREE_OFFER';
  if (offerLower.includes('%')) return 'DISCOUNT_BADGE';
  if (offerLower.includes('limited') || offerLower.includes('exclusive')) return 'LIMITED_OFFER';
  if (offerLower.includes('first')) return 'EXCLUSIVE_BADGE';
  
  return 'OFFER_BADGE';
}

// ============================================================================
// AGENT 10: VISUAL VALIDATOR (8-POINT CHECKS)
// ============================================================================

export function performValidationChecks(allDecisions) {
  const checks = {
    category_match: validateCategoryMatch(allDecisions),
    product_match: validateProductMatch(allDecisions),
    customer_match: validateCustomerMatch(allDecisions),
    visual_authenticity: scoreVisualAuthenticity(allDecisions),
    product_visibility: scoreProductVisibility(allDecisions),
    clarity: scoreClarity(allDecisions),
    brand_relevance: scoreBrandRelevance(allDecisions),
    conversion_potential: scoreConversionPotential(allDecisions)
  };
  
  const thresholds = {
    visual_authenticity: 80,
    product_visibility: 75,
    clarity: 85,
    brand_relevance: 80,
    conversion_potential: 75
  };
  
  let passed = true;
  for (const [check, threshold] of Object.entries(thresholds)) {
    if (checks[check] < threshold) {
      passed = false;
    }
  }
  
  return {
    passed,
    checks,
    recommendation: passed ? 'APPROVED_FOR_RENDERING' : 'REQUIRES_REFINEMENT',
    failed_checks: Object.entries(checks)
      .filter(([k, v]) => thresholds[k] && v < thresholds[k])
      .map(([k, v]) => `${k}: ${v}/100 (need ${thresholds[k]})`)
  };
}

function validateCategoryMatch(decisions) {
  const categoryScore = decisions.story.supporting.length > 0 ? 85 : 70;
  return categoryScore;
}

function validateProductMatch(decisions) {
  const heroRelevance = decisions.story.hero.includes('product') ? 90 : 75;
  return heroRelevance;
}

function validateCustomerMatch(decisions) {
  const psychologyMatch = decisions.psychology.desire.length > 5 ? 85 : 70;
  return psychologyMatch;
}

function scoreVisualAuthenticity(decisions) {
  const hasAbstract = decisions.story.hero.includes('abstract') ? 0 : 25;
  const hasRealProduct = decisions.story.hero.includes('product') ? 25 : 0;
  const hasEnvironment = decisions.story.environment.length > 10 ? 25 : 0;
  const hasEmotion = decisions.story.emotion.length > 10 ? 25 : 0;
  
  return hasAbstract + hasRealProduct + hasEnvironment + hasEmotion;
}

function scoreProductVisibility(decisions) {
  const hasProductFocus = decisions.product_rules ? 75 : 60;
  return hasProductFocus;
}

function scoreClarity(decisions) {
  const benefitsCount = decisions.marketing.benefits.length;
  const clarityScore = benefitsCount <= 4 ? 90 : (benefitsCount <= 6 ? 75 : 60);
  return clarityScore;
}

function scoreBrandRelevance(decisions) {
  const niches = [decisions.input.niche, decisions.input.category].join(' ').length;
  const relevanceScore = niches > 5 ? 85 : 70;
  return relevanceScore;
}

function scoreConversionPotential(decisions) {
  const hasCTA = decisions.offer.needs_badge ? 90 : 75;
  const hasUrgency = decisions.marketing.urgency === 'high' ? 15 : 10;
  const hasClearBenefit = decisions.marketing.benefits.length >= 2 ? 15 : 5;
  
  return Math.min(100, hasCTA + hasUrgency + hasClearBenefit);
}

// ============================================================================
// AGENT 11: PROMPT ARCHITECT
// ============================================================================

export function generateOptimizedPrompt(allDecisions) {
  if (!allDecisions.validation.passed) {
    return {
      status: 'validation_failed',
      error: 'Design failed validation checks',
      failed_checks: allDecisions.validation.failed_checks,
      recommendation: 'Please refine strategy and try again'
    };
  }
  
  const prompt = `
SCENE COMPOSITION:
${allDecisions.story.hero}
Setting: ${allDecisions.story.environment}
Emotion: ${allDecisions.story.emotion}
Action: ${allDecisions.story.action}

HERO OBJECT:
${allDecisions.story.hero}
Visibility: ${allDecisions.offer.visibility_percentage}% of composition
Detail level: Photorealistic, product clearly identifiable

SUPPORTING ELEMENTS:
${allDecisions.story.supporting.map((s, i) => `- ${s} (positioned in zone ${i + 1})`).join('\n')}

BACKGROUND:
${allDecisions.story.environment}
Full width, topic-relevant context
Occupies ${85 - allDecisions.offer.visibility_percentage}% of background

LAYOUT ZONES:
${allDecisions.layout.zones.map(z => `${z.name}: ${z.percentage} - ${z.content}`).join('\n')}
Left margin: 10%
Right margin: 10%

VISUAL HIERARCHY:
- Headline: 45% visual weight
- Hero: 30% visual weight
- Benefits: 15% visual weight
- CTA: 7% visual weight
- Hashtags: 3% visual weight

TYPOGRAPHY:
Headline: ${determineFontSize('headline', allDecisions.input.ratio)}, Bold, Left-aligned
Benefits: ${determineFontSize('benefits', allDecisions.input.ratio)}, Regular
CTA: ${determineFontSize('cta', allDecisions.input.ratio)}, Bold

COMPOSITION RULES:
- One dominant hero only
- Product clearly visible
- Customer/person in frame
- Real world scenario
- Professional rendering
- Instantly recognizable category

QUALITY REQUIREMENTS:
- 4K resolution ready
- High photorealism
- Clear focus
- Professional lighting
- No abstract icons
- No text overlay

THUMBNAIL TEST:
Must communicate within 2 seconds:
✓ Business: ${allDecisions.input.category}
✓ Offer: ${allDecisions.offer.offer}
✓ Category: Instantly recognizable

RECOMMENDATION:
${allDecisions.validation.passed ? '✓ APPROVED_FOR_RENDERING' : '✗ REQUIRES_REFINEMENT'}
  `.trim();
  
  return {
    status: 'success',
    prompt,
    validation: allDecisions.validation,
    decisions_summary: {
      hero: allDecisions.story.hero,
      offer: allDecisions.offer.offer,
      target_audience: allDecisions.psychology.who,
      category: allDecisions.input.category,
      style: allDecisions.input.style,
      thumbnail_score: allDecisions.thumbnail_test.score
    }
  };
}

function determineFontSize(element, ratio) {
  const sizes = {
    'headline': ratio === '1:1' ? '48px' : '64px',
    'benefits': ratio === '1:1' ? '24px' : '32px',
    'cta': ratio === '1:1' ? '20px' : '28px'
  };
  return sizes[element] || '24px';
}

// ============================================================================
// MAIN ORCHESTRATION ENGINE
// ============================================================================

export function executeAISocialCreativeEngineV2(rawInput) {
  try {
    const input = normalizeInput(rawInput);
    const marketing = analyzeMarketingStrategy(input);
    const psychology = analyzeCustomerPsychology(input, marketing);
    const categoryKnowledge = buildCategoryKnowledge(input.category);
    const categoryValid = validateCategoryRecognition(input.category);
    const productType = detectProductType(input.category, input.post_text);
    const productRules = enforceProductVisibility(productType);
    const story = buildVisualStory(input.category, psychology, marketing, productType);
    const layout = planLayout(input.ratio);
    const hierarchy = buildHierarchy();
    const thumbnailTest = performThumbnailTest(story.hero, input.heading, 'Get Started', input.category);
    const offer = optimizeOffer(marketing.offer, marketing);
    
    const allDecisions = {
      input,
      marketing,
      psychology,
      category_knowledge: categoryKnowledge,
      product_type: productType,
      product_rules: productRules,
      story,
      layout,
      hierarchy,
      offer,
      thumbnail_test: thumbnailTest
    };
    
    const validation = performValidationChecks(allDecisions);
    allDecisions.validation = validation;
    
    const finalPrompt = generateOptimizedPrompt(allDecisions);
    
    return {
      status: finalPrompt.status,
      recommendation: validation.recommendation,
      prompt: finalPrompt.prompt,
      validation,
      decisions: {
        hero: story.hero,
        offer: offer.offer,
        target_audience: psychology.who,
        category: input.category,
        benefits: marketing.benefits,
        style: input.style
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}
