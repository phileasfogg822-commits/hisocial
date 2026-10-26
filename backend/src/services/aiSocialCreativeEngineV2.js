const axios = require('axios');

/**
 * AI SOCIAL CREATIVE ENGINE v2.0
 * 
 * Multi-Agent Decision Architecture for High-Performance Social Creative
 * 
 * CORE PHILOSOPHY:
 * - Gemini/LLM = Thinking Layer (all strategic decisions)
 * - Validation Agents = Decision Verification (8-point checks)
 * - Alibaba = Rendering Layer (image generation only)
 * 
 * PIPELINE:
 * Input → Agent 1-11 (Gemini thinking) → Validation → Prompt → Alibaba
 */

// ============================================================================
// AGENT 1: INPUT NORMALIZER
// ============================================================================

function normalizeInput(rawInput) {
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

function analyzeMarketingStrategy(input) {
  const text = `${input.heading} ${input.topic} ${input.post_text}`.toLowerCase();
  
  // Extract offer strength indicators
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
  
  // Detect campaign type
  let campaignType = 'awareness';
  if (text.includes('buy') || text.includes('order') || text.includes('shop')) campaignType = 'conversion';
  if (text.includes('learn') || text.includes('discover') || text.includes('explore')) campaignType = 'consideration';
  if (text.includes('get started') || text.includes('try') || text.includes('free trial')) campaignType = 'conversion';
  
  // Extract business/offer/outcome/benefits/urgency
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
  // Look for percentage discounts
  const percentMatch = text.match(/(\d+)%\s*(?:off|discount)/i);
  if (percentMatch) return `${percentMatch[1]}% OFF`;
  
  // Look for free offers
  if (text.includes('free')) return 'FREE OFFER';
  
  // Look for new products
  if (text.includes('new') || text.includes('launch')) return 'NEW LAUNCH';
  
  // Limited time
  if (text.includes('limited') || text.includes('exclusive')) return 'LIMITED TIME';
  
  return 'SPECIAL OFFER';
}

function extractOutcome(text) {
  // Extract main outcome/result keywords
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

function analyzeCustomerPsychology(input, marketing) {
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
  // Default audience based on category
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
  // Customer identity should guide design, not business identity
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

const CATEGORY_VISUAL_LIBRARY = {
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

function buildCategoryKnowledge(category) {
  const categoryKey = category.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
  
  for (const [key, visuals] of Object.entries(CATEGORY_VISUAL_LIBRARY)) {
    if (categoryKey.includes(key) || key.includes(categoryKey)) {
      return visuals;
    }
  }
  
  // Default fallback
  return {
    mandatory: ['primary product/service', 'customer', 'benefit'],
    optional: ['context', 'lifestyle', 'results'],
    forbidden: ['irrelevant', 'distracting', 'competing elements']
  };
}

function validateCategoryRecognition(category) {
  // Returns true if category is recognizable in 2 seconds
  const specificity = category.split(/\s+/).length;
  
  if (specificity >= 2) return true; // "garden supplies" is recognizable
  if (specificity === 1 && category.length > 4) return true; // "restaurant" is recognizable
  
  return false; // Too vague
}

// ============================================================================
// AGENT 5: PRODUCT DETECTION AGENT
// ============================================================================

function detectProductType(category, text) {
  const textLower = text.toLowerCase();
  
  // Physical products
  if (/(product|phone|car|plant|food|clothes|furniture|book|device|equipment)/.test(textLower)) {
    return 'physical';
  }
  
  // Digital products
  if (/(software|app|course|template|template|plugin|extension|tool|platform)/.test(textLower)) {
    return 'digital';
  }
  
  // Services
  if (/(service|consultation|coaching|training|cleaning|repair|design|development)/.test(textLower)) {
    return 'service';
  }
  
  // Default based on category
  if (category.includes('saas') || category.includes('software')) return 'digital';
  if (category.includes('cafe') || category.includes('restaurant')) return 'service';
  
  return 'physical';
}

function enforceProductVisibility(productType) {
  // Product must occupy 20%-60% of visual focus
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

function buildVisualStory(category, psychology, marketing, productType) {
  // Convert marketing strategy into visual narrative
  // RULE: Show OUTCOME, not feature
  
  const categoryKnowledge = buildCategoryKnowledge(category);
  
  // Start with mandatory visuals
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
  // NEVER: Laptop, phone, dashboard, icons, abstract
  // RULE: One dominant hero only
  
  if (productType === 'physical') {
    // Hero must be the product itself in context
    return `${categoryKnowledge.mandatory[0]} in use`;
  }
  
  if (productType === 'service') {
    // Hero is the outcome/transformation, not the tool
    return `customer experiencing ${psychology.desire}`;
  }
  
  if (productType === 'digital') {
    // Hero is the result/benefit, with interface as support
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
  // Environment should reflect customer identity, not business setting
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
  // The action/moment to capture
  return `moment of ${outcome.substring(0, 30)}`;
}

// ============================================================================
// AGENT 7: LAYOUT PLANNER
// ============================================================================

function planLayout(ratio) {
  // Define 4-6 zones based on ratio
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

function buildHierarchy() {
  return {
    headline: 45,      // Most visual weight
    hero: 30,          // Primary visual focus
    benefits: 15,      // Supporting information
    cta: 7,            // Action prompt
    hashtags: 3        // Brand hashtags
  };
}

function performThumbnailTest(hero, headline, cta, category) {
  // Shrink to 100px mentally
  // Must instantly communicate: Business, Offer, Category within 2 seconds
  
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

function optimizeOffer(offer, marketing) {
  // Detect offer strength and visibility rules
  
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

function performValidationChecks(allDecisions) {
  const checks = {
    // CHECK 1: Category Match
    category_match: validateCategoryMatch(allDecisions),
    
    // CHECK 2: Product Match
    product_match: validateProductMatch(allDecisions),
    
    // CHECK 3: Customer Match
    customer_match: validateCustomerMatch(allDecisions),
    
    // CHECK 4: Visual Authenticity
    visual_authenticity: scoreVisualAuthenticity(allDecisions),
    
    // CHECK 5: Product Visibility
    product_visibility: scoreProductVisibility(allDecisions),
    
    // CHECK 6: Clarity
    clarity: scoreClarity(allDecisions),
    
    // CHECK 7: Brand Relevance
    brand_relevance: scoreBrandRelevance(allDecisions),
    
    // CHECK 8: Conversion Potential
    conversion_potential: scoreConversionPotential(allDecisions)
  };
  
  // Calculate pass/fail
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
  // Does image immediately look like the correct industry?
  const categoryScore = decisions.story.supporting.length > 0 ? 85 : 70;
  return categoryScore;
}

function validateProductMatch(decisions) {
  // Can user identify the product within 2 seconds?
  const heroRelevance = decisions.story.hero.includes('product') ? 90 : 75;
  return heroRelevance;
}

function validateCustomerMatch(decisions) {
  // Would target customer save or share this?
  const psychologyMatch = decisions.psychology.desire.length > 5 ? 85 : 70;
  return psychologyMatch;
}

function scoreVisualAuthenticity(decisions) {
  // Photorealistic, not abstract
  const hasAbstract = decisions.story.hero.includes('abstract') ? 0 : 25;
  const hasRealProduct = decisions.story.hero.includes('product') ? 25 : 0;
  const hasEnvironment = decisions.story.environment.length > 10 ? 25 : 0;
  const hasEmotion = decisions.story.emotion.length > 10 ? 25 : 0;
  
  return hasAbstract + hasRealProduct + hasEnvironment + hasEmotion;
}

function scoreProductVisibility(decisions) {
  // Product must be 20-60% of visual focus
  const hasProductFocus = decisions.product_rules ? 75 : 60;
  return hasProductFocus;
}

function scoreClarity(decisions) {
  // Single message, not cluttered
  const benefitsCount = decisions.marketing.benefits.length;
  const clarityScore = benefitsCount <= 4 ? 90 : (benefitsCount <= 6 ? 75 : 60);
  return clarityScore;
}

function scoreBrandRelevance(decisions) {
  // Does it match brand/category/niche?
  const niches = [decisions.input.niche, decisions.input.category].join(' ').length;
  const relevanceScore = niches > 5 ? 85 : 70;
  return relevanceScore;
}

function scoreConversionPotential(decisions) {
  // Does it drive action?
  const hasCTA = decisions.offer.needs_badge ? 90 : 75;
  const hasUrgency = decisions.marketing.urgency === 'high' ? 15 : 10;
  const hasClearBenefit = decisions.marketing.benefits.length >= 2 ? 15 : 5;
  
  return Math.min(100, hasCTA + hasUrgency + hasClearBenefit);
}

// ============================================================================
// AGENT 11: PROMPT ARCHITECT
// ============================================================================

function generateOptimizedPrompt(allDecisions) {
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
Never place text outside content area

VISUAL HIERARCHY:
- Headline: 45% visual weight (${allDecisions.input.heading})
- Hero: 30% visual weight
- Benefits: 15% visual weight
- CTA: 7% visual weight
- Hashtags: 3% visual weight

TYPOGRAPHY:
Headline: ${determineFontSize('headline', allDecisions.input.ratio)}, ${determineFontWeight('headline')}, Left-aligned
Benefits: ${determineFontSize('benefits', allDecisions.input.ratio)}, ${determineFontWeight('benefits')}
CTA: ${determineFontSize('cta', allDecisions.input.ratio)}, ${determineFontWeight('cta')}, Bold

TEXT CONTENT:
Headline: ${allDecisions.input.heading}
Benefits: ${allDecisions.marketing.benefits.slice(0, 3).join(', ')}
CTA: ${formatCTA(allDecisions.marketing.campaign_type)}
Hashtags: ${allDecisions.input.hashtags.slice(0, 3).join(' ')}

OFFER BADGE:
${allDecisions.offer.needs_badge ? `Style: ${allDecisions.offer.badge_style}\nContent: ${allDecisions.offer.offer}` : 'None'}

COLOR PALETTE:
Primary: ${selectColorForOffer(allDecisions.offer)}
Secondary: ${selectSecondaryColor(allDecisions.input.tone)}
Accent: ${selectAccentColor(allDecisions.input.style)}
Background: Light, neutral, topic-contextual

STYLE:
Theme: ${allDecisions.input.style}
Photorealism level: High (real products, real people, real environments)
Aesthetic: ${styleAesthetic(allDecisions.input.style)}

COMPOSITION RULES:
- One dominant hero only (not multiple competing objects)
- Product clearly visible and identifiable
- Customer/person in frame (not abstract)
- Real world scenario, not abstract or metaphorical
- Professional, high-quality rendering
- Instantly recognizable category

QUALITY REQUIREMENTS:
- 4K resolution ready
- High color accuracy
- Clear focus on hero object
- Professional lighting
- Photorealistic rendering
- No abstract icons or symbols
- No text overlay (text added in separate layer)
- No watermarks or artifacts

THUMBNAIL TEST (100px shrink):
Must communicate within 2 seconds:
✓ Business: ${allDecisions.input.category}
✓ Offer: ${allDecisions.offer.offer}
✓ Category: Instantly recognizable
✓ CTA: Action is obvious

REJECTION RULE:
If any validation check fails, return to Agent 6.
${allDecisions.validation.passed ? '✓ All checks passed. Ready for Alibaba rendering.' : '✗ Validation failed. Requires refinement.'}
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

function determineFontWeight(element) {
  const weights = {
    'headline': 'Bold (700)',
    'benefits': 'Regular (400)',
    'cta': 'Bold (700)'
  };
  return weights[element] || 'Regular (400)';
}

function formatCTA(campaignType) {
  const ctas = {
    'conversion': 'Get Started',
    'consideration': 'Learn More',
    'awareness': 'Discover Now',
    'retention': 'Join Us'
  };
  return ctas[campaignType] || 'Get Started';
}

function selectColorForOffer(offer) {
  if (offer.strength === 'high') return '#DC2626 (urgent red)';
  return '#0066CC (trust blue)';
}

function selectSecondaryColor(tone) {
  const colors = {
    'professional': '#1F2937 (dark gray)',
    'casual': '#F59E0B (warm amber)',
    'urgent': '#EF4444 (bright red)',
    'premium': '#1E293B (navy)'
  };
  return colors[tone] || '#6B7280 (gray)';
}

function selectAccentColor(style) {
  const colors = {
    'minimal': '#FFFFFF (white)',
    'modern': '#06B6D4 (cyan)',
    'corporate': '#0369A1 (blue)',
    'premium': '#D4AF37 (gold)'
  };
  return colors[style] || '#06B6D4 (cyan)';
}

function styleAesthetic(style) {
  const aesthetics = {
    'minimal': 'Clean, simple, maximum whitespace',
    'modern': 'Sleek, contemporary, gradient-friendly',
    'corporate': 'Professional, formal, trustworthy',
    'premium': 'Luxury, elegant, refined'
  };
  return aesthetics[style] || 'Professional, modern';
}

// ============================================================================
// ORCHESTRATION ENGINE
// ============================================================================

function executeAISocialCreativeEngineV2(rawInput) {
  console.log('🚀 AI SOCIAL CREATIVE ENGINE v2.0 - Starting orchestration...\n');
  
  try {
    // AGENT 1: Normalize Input
    console.log('📍 Agent 1: Input Normalizer');
    const input = normalizeInput(rawInput);
    console.log(`   ✓ Normalized input: ${input.category} → ${input.heading}\n`);
    
    // AGENT 2: Marketing Strategy
    console.log('📍 Agent 2: Marketing Strategist');
    const marketing = analyzeMarketingStrategy(input);
    console.log(`   ✓ Campaign Type: ${marketing.campaign_type}`);
    console.log(`   ✓ Offer: ${marketing.offer}`);
    console.log(`   ✓ Benefits: ${marketing.benefits.join(', ')}\n`);
    
    // AGENT 3: Customer Psychology
    console.log('📍 Agent 3: Customer Psychology Analyzer');
    const psychology = analyzeCustomerPsychology(input, marketing);
    console.log(`   ✓ Target: ${psychology.who}`);
    console.log(`   ✓ Desire: ${psychology.desire}`);
    console.log(`   ✓ Identity: ${psychology.identity}\n`);
    
    // AGENT 4: Category Expert
    console.log('📍 Agent 4: Category Expert');
    const categoryKnowledge = buildCategoryKnowledge(input.category);
    const categoryValid = validateCategoryRecognition(input.category);
    console.log(`   ✓ Category Recognition: ${categoryValid ? 'PASS' : 'FAIL'}`);
    console.log(`   ✓ Mandatory Visuals: ${categoryKnowledge.mandatory.join(', ')}\n`);
    
    // AGENT 5: Product Detection
    console.log('📍 Agent 5: Product Detection Agent');
    const productType = detectProductType(input.category, input.post_text);
    const productRules = enforceProductVisibility(productType);
    console.log(`   ✓ Product Type: ${productType}`);
    console.log(`   ✓ Visibility Range: ${productRules.min_visibility}-${productRules.max_visibility}%\n`);
    
    // AGENT 6: Visual Story
    console.log('📍 Agent 6: Visual Story Architect');
    const story = buildVisualStory(input.category, psychology, marketing, productType);
    console.log(`   ✓ Hero: ${story.hero}`);
    console.log(`   ✓ Supporting: ${story.supporting.slice(0, 2).join(', ')}`);
    console.log(`   ✓ Environment: ${story.environment}\n`);
    
    // AGENT 7: Layout Planning
    console.log('📍 Agent 7: Layout Planner');
    const layout = planLayout(input.ratio);
    console.log(`   ✓ Layout: ${input.ratio} ratio`);
    console.log(`   ✓ Zones: ${layout.zones.length} zones defined\n`);
    
    // AGENT 8: Hierarchy Building
    console.log('📍 Agent 8: Hierarchy Builder');
    const hierarchy = buildHierarchy();
    const thumbnailTest = performThumbnailTest(story.hero, input.heading, 'Get Started', input.category);
    console.log(`   ✓ Hierarchy: Headline 45%, Hero 30%, Benefits 15%`);
    console.log(`   ✓ Thumbnail Test: ${thumbnailTest.passed ? 'PASS' : 'FAIL'} (${thumbnailTest.score}/100)\n`);
    
    // AGENT 9: Offer Optimization
    console.log('📍 Agent 9: Offer Optimizer');
    const offer = optimizeOffer(marketing.offer, marketing);
    console.log(`   ✓ Offer: ${offer.offer}`);
    console.log(`   ✓ Strength: ${offer.strength}`);
    console.log(`   ✓ Badge Needed: ${offer.needs_badge ? 'YES' : 'NO'}\n`);
    
    // Compile all decisions for validation
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
    
    // AGENT 10: Validation
    console.log('📍 Agent 10: Visual Validator (8-Point Checks)');
    const validation = performValidationChecks(allDecisions);
    console.log(`   ✓ Category Match: ${validation.checks.category_match}/100`);
    console.log(`   ✓ Product Match: ${validation.checks.product_match}/100`);
    console.log(`   ✓ Visual Authenticity: ${validation.checks.visual_authenticity}/100`);
    console.log(`   ✓ Product Visibility: ${validation.checks.product_visibility}/100`);
    console.log(`   ✓ Clarity: ${validation.checks.clarity}/100`);
    console.log(`   ✓ Brand Relevance: ${validation.checks.brand_relevance}/100`);
    console.log(`   ✓ Conversion Potential: ${validation.checks.conversion_potential}/100`);
    console.log(`   → Recommendation: ${validation.recommendation}\n`);
    
    allDecisions.validation = validation;
    
    // AGENT 11: Prompt Architecture
    console.log('📍 Agent 11: Prompt Architect');
    const finalPrompt = generateOptimizedPrompt(allDecisions);
    console.log(`   ✓ Prompt Status: ${finalPrompt.status}`);
    
    if (finalPrompt.status === 'success') {
      console.log(`   ✓ Ready for Alibaba rendering\n`);
    } else {
      console.log(`   ✗ Validation failed - requires refinement\n`);
    }
    
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
    console.error('❌ Engine Error:', error.message);
    return {
      status: 'error',
      error: error.message
    };
  }
}

// ============================================================================
// IMAGE GENERATION FUNCTION - NEW
// ============================================================================

async function generateImageWithEngineV2(engineResult, provider = 'alibaba', apiKeyOverride = null) {
  if (engineResult.status !== 'success') {
    throw new Error(`Engine must succeed to generate image. Status: ${engineResult.status}`);
  }

  const prompt = engineResult.prompt;
  if (!prompt) {
    throw new Error('Engine result must contain a prompt for image generation');
  }

  // Get provider API key from environment if not overridden
  const apiKey = apiKeyOverride || process.env.ALIBABA_DASHSCOPE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    throw new Error('Alibaba DashScope API key not configured');
  }

  const region = String(process.env.ALIBABA_REGION || 'singapore').toLowerCase();
  const endpoint = region === 'beijing'
    ? 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
    : 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

  try {
    const response = await axios.post(endpoint, {
      model: 'wan2.7-image-pro',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      parameters: {
        size: '1024*1024',
        n: 1,
        watermark: false,
        thinking_mode: true
      }
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const url = response.data?.output?.choices?.[0]?.message?.content?.[0]?.image;
    if (!url) {
      const errorMsg = response.data?.message || 'Alibaba image generation returned no URL';
      throw new Error(errorMsg);
    }

    return {
      url: url,
      engine_result: engineResult,
      provider: 'alibaba'
    };
  } catch (error) {
    console.error('Image generation error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  executeAISocialCreativeEngineV2,
  generateImageWithEngineV2,  // Export the new image generation function
  normalizeInput,
  analyzeMarketingStrategy,
  analyzeCustomerPsychology,
  buildCategoryKnowledge,
  detectProductType,
  buildVisualStory,
  planLayout,
  buildHierarchy,
  optimizeOffer,
  performValidationChecks,
  generateOptimizedPrompt,
  performThumbnailTest,
  CATEGORY_VISUAL_LIBRARY
};
