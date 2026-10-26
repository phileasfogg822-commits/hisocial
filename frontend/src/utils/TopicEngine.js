/**
 * =====================================================
 * TOPIC INTELLIGENCE ENGINE (V2)
 * Domain-Aware, Tone-Aware, Open-Domain Topic Generator
 * Works for ANY niche -- not automation-specific
 * Detects domain from niche + category text and
 * shapes topic framing based on tone.
 * =====================================================
 */

// ─── Per-domain data ─────────────────────────────────────────────────────────

const DOMAINS = {

  ecommerce: {
    painPoints: [
      'losing sales due to cart abandonment',
      'struggling to convert website visitors into paying customers',
      'spending too much on ads with poor return on spend',
      'missing repeat customers due to weak retention strategy',
      'wasting time on manual order and inventory management',
      'competing on price instead of value and brand',
      'not following up with leads who showed buying intent',
    ],
    outcomes: [
      'building a high-converting product experience',
      'automating order fulfilment and post-purchase follow-ups',
      'creating a customer loyalty and retention engine',
      'scaling product sales without scaling ad spend',
      'turning one-time buyers into long-term brand advocates',
      'reducing refunds and increasing customer satisfaction',
    ],
    objects: [
      'online store', 'product page', 'checkout flow', 'email sequence',
      'abandoned cart workflow', 'customer loyalty program',
      'product recommendation system', 'inventory management pipeline',
    ],
    contexts: [
      'in your ecommerce store', 'for your online business',
      'across your customer journey', 'in your Shopify or WooCommerce store',
      'for your product-based business',
    ],
  },

  health: {
    painPoints: [
      'struggling with patient retention and follow-through',
      'losing appointments due to manual booking and no-shows',
      'overwhelming administrative burden on clinical staff',
      'missing opportunities to build patient trust digitally',
      'wasting time on repetitive intake and paperwork processes',
      'failing to educate patients between appointments',
    ],
    outcomes: [
      'streamlining patient management from booking to follow-up',
      'building a digital health education and engagement system',
      'automating appointment reminders and patient communications',
      'creating scalable wellness and coaching delivery systems',
      'improving patient outcomes through proactive engagement',
    ],
    objects: [
      'patient management system', 'appointment booking flow',
      'wellness coaching program', 'clinical intake workflow',
      'patient follow-up sequence', 'health education pipeline',
    ],
    contexts: [
      'in your clinic or practice', 'for your patients',
      'in your wellness program', 'across your patient journey',
      'for healthcare professionals',
    ],
  },

  finance: {
    painPoints: [
      'losing clients due to lack of financial clarity and communication',
      'spending hours each week on manual financial reporting',
      'missing investment opportunities due to slow decision-making',
      'struggling to communicate financial value to non-technical clients',
      'drowning in compliance paperwork instead of strategic work',
    ],
    outcomes: [
      'building automated financial reporting and insights systems',
      'creating clear financial communication that wins client trust',
      'streamlining compliance and bookkeeping workflows',
      'helping clients make faster and smarter financial decisions',
      'turning data into compelling financial narratives',
    ],
    objects: [
      'financial reporting system', 'investment decision framework',
      'client reporting dashboard', 'budgeting workflow',
      'compliance management pipeline', 'accounting automation system',
    ],
    contexts: [
      'in your financial practice', 'for your investment portfolio',
      'across your client base', 'in your accounting workflow',
      'for financial advisors and planners',
    ],
  },

  education: {
    painPoints: [
      'struggling to keep learners engaged through online courses',
      'wasting time on manual grading and repetitive feedback',
      'losing students due to poor course structure or pacing',
      'leaving course revenue on the table from under-promoted content',
      'managing multiple student cohorts with no scalable system',
    ],
    outcomes: [
      'building engaging online learning experiences that retain students',
      'automating student progress tracking and personalised feedback',
      'creating a scalable course delivery and certification system',
      'turning expertise and knowledge into recurring passive income',
      'building an audience and community around your teaching',
    ],
    objects: [
      'online course', 'learning management system', 'student onboarding flow',
      'coaching program', 'curriculum design', 'community platform',
      'student retention strategy',
    ],
    contexts: [
      'in your online course', 'for your students and learners',
      'in your coaching program', 'across your educational platform',
      'for educators and knowledge creators',
    ],
  },

  lifestyle: {
    painPoints: [
      'struggling to build a consistent personal brand that attracts followers',
      'posting content without a strategy and seeing no real results',
      'feeling burned out from managing social media with no system',
      'missing engagement opportunities due to inconsistent presence',
      'not monetising a personal brand that already has an audience',
    ],
    outcomes: [
      'building a recognisable and trusted personal brand online',
      'creating a consistent content system that grows your audience',
      'turning lifestyle and passion into a content-driven business',
      'monetising your personal brand through smart content funnels',
      'turning followers into paying clients or customers',
    ],
    objects: [
      'personal brand strategy', 'content calendar', 'social media presence',
      'brand story', 'audience growth system', 'content monetisation pipeline',
      'lifestyle brand identity',
    ],
    contexts: [
      'in your personal brand', 'for your audience',
      'across your social platforms', 'in your lifestyle content strategy',
      'for creators and influencers',
    ],
  },

  agency: {
    painPoints: [
      'losing clients due to slow delivery and communication gaps',
      'unable to scale without constantly hiring more staff',
      'wasting hours on repetitive client onboarding tasks every week',
      'leaving recurring revenue on the table from existing clients',
      'drowning in manual reporting and project status updates',
    ],
    outcomes: [
      'building a scalable and repeatable client delivery system',
      'automating client onboarding and project reporting',
      'creating productised services that generate predictable revenue',
      'streamlining agency operations so the team focuses on impact',
      'building retention systems that extend client lifetime value',
    ],
    objects: [
      'client onboarding system', 'agency delivery workflow',
      'proposal and contract pipeline', 'client reporting dashboard',
      'service delivery process', 'retainer management system',
    ],
    contexts: [
      'inside your agency', 'for your retainer clients',
      'in your service delivery', 'across your project pipeline',
      'for agency owners and managers',
    ],
  },

  tech: {
    painPoints: [
      'losing users in the first week due to poor onboarding',
      'wasting engineering time answering preventable support questions',
      'struggling to communicate product value to non-technical buyers',
      'seeing great features go unnoticed due to poor user education',
      'slow deployment cycles blocking product growth',
    ],
    outcomes: [
      'building onboarding experiences that activate and retain users',
      'automating technical documentation and user education',
      'communicating product value clearly to business decision-makers',
      'accelerating feature adoption through smart in-app guidance',
      'reducing churn by improving product-market fit communication',
    ],
    objects: [
      'user onboarding flow', 'product documentation system',
      'feature adoption strategy', 'SaaS dashboard experience',
      'API integration guide', 'developer community pipeline',
    ],
    contexts: [
      'in your SaaS product', 'for your end users',
      'in your tech stack', 'across your product lifecycle',
      'for software teams and founders',
    ],
  },

  realestate: {
    painPoints: [
      'losing warm leads due to slow follow-up response times',
      'spending hours manually qualifying leads that never convert',
      'struggling to nurture buyers through long property decision cycles',
      'missing market opportunities without a consistent content presence',
      'overwhelmed by manual client communication across too many channels',
    ],
    outcomes: [
      'building automated lead nurturing pipelines for property buyers',
      'creating consistent property marketing and content systems',
      'automating client follow-ups while maintaining a personal touch',
      'turning cold enquiries into qualified buyers on autopilot',
      'building trust and authority in a competitive local market',
    ],
    objects: [
      'lead nurturing pipeline', 'property listing system',
      'client follow-up sequence', 'market analysis workflow',
      'buyer qualification process', 'CRM and contact management system',
    ],
    contexts: [
      'in your real estate business', 'for your property listings',
      'across your buyer and seller pipeline', 'in your property market',
      'for real estate agents and brokers',
    ],
  },

  fitness: {
    painPoints: [
      'struggling to retain members after the first month',
      'losing potential clients due to no consistent online presence',
      'unable to scale coaching beyond limited one-on-one hours',
      'missing recurring revenue from a loyal community you already have',
      'spending too much time on admin instead of coaching',
    ],
    outcomes: [
      'building an online fitness program that earns while you train',
      'creating a member retention and community engagement system',
      'scaling coaching with group programmes and digital products',
      'building a brand that attracts clients without paid ads',
      'automating programme delivery and client check-ins',
    ],
    objects: [
      'online training programme', 'membership community',
      'coaching delivery system', 'client progress tracker',
      'fitness content calendar', 'lead generation funnel',
    ],
    contexts: [
      'for your coaching clients', 'in your fitness business',
      'across your online programme', 'for gym owners and PT coaches',
      'in your health and wellness brand',
    ],
  },

  food: {
    painPoints: [
      'struggling to maintain consistent restaurant footfall',
      'losing potential customers without a strong online presence',
      'wasting money on promotions that do not bring repeat visits',
      'failing to build loyalty with existing customers',
      'managing orders and reservations manually without a system',
    ],
    outcomes: [
      'building a loyal local customer base through content and community',
      'creating a consistent brand presence across social media',
      'turning first-time diners into regular returning customers',
      'reaching new audiences through engaging food content',
      'generating bookings and orders directly through social platforms',
    ],
    objects: [
      'restaurant brand story', 'customer loyalty programme',
      'social media content plan', 'menu promotion strategy',
      'customer review pipeline', 'online ordering experience',
    ],
    contexts: [
      'for your restaurant or cafe', 'in your food business',
      'across your customer base', 'in your local community',
      'for food entrepreneurs and chefs',
    ],
  },

  fashion: {
    painPoints: [
      'struggling to stand out in a saturated fashion market',
      'losing sales to competitors with a stronger online presence',
      'not converting social media followers into paying customers',
      'wasting budget on campaigns that do not drive brand loyalty',
      'struggling to communicate brand identity and values consistently',
    ],
    outcomes: [
      'building a fashion brand identity that attracts the right audience',
      'creating content that converts followers into customers',
      'building a consistent seasonal content and campaign calendar',
      'turning brand story into a customer loyalty asset',
      'leveraging social proof and styling content for organic growth',
    ],
    objects: [
      'brand identity and tone of voice', 'seasonal content calendar',
      'product styling strategy', 'influencer collaboration pipeline',
      'customer community and loyalty programme', 'launch campaign plan',
    ],
    contexts: [
      'in your fashion brand', 'for your target audience',
      'across your seasonal collections', 'in your online store',
      'for fashion founders and stylists',
    ],
  },

  default: {
    painPoints: [
      'wasting time on tasks that could be systemised',
      'missing growth opportunities without a clear strategy',
      'struggling to scale while staying consistent in quality',
      'losing potential customers without a strong digital presence',
      'running the business reactively instead of proactively',
      'spending more time managing operations than delivering value',
    ],
    outcomes: [
      'building systems that create consistent and scalable results',
      'creating a content and marketing strategy that works long-term',
      'developing a clear brand presence that attracts the right clients',
      'streamlining from chaos to a structured and growing business',
      'turning a scattered approach into a focused growth engine',
    ],
    objects: [
      'core business strategy', 'operations workflow', 'growth pipeline',
      'customer experience system', 'content and marketing plan',
      'sales and conversion process',
    ],
    contexts: [
      'in your business', 'for your team and clients',
      'across your core operations', 'in your industry and market',
      'for business owners and entrepreneurs',
    ],
  },
};

// ─── Tone-specific hook templates ─────────────────────────────────────────────

const TONE_TEMPLATES = {
  professional: [
    ({ pain, context }) =>
      `The strategic cost of ${pain} ${context} — and how leading teams are fixing it`,
    ({ outcome, object }) =>
      `How high-performing teams leverage ${outcome} to transform their ${object}`,
    ({ pain, outcome }) =>
      `From ${pain} to ${outcome}: a practical framework for business leaders`,
    ({ object, outcome }) =>
      `Why the most competitive businesses invest in ${outcome} for their ${object}`,
  ],
  casual: [
    ({ pain }) =>
      `Real talk — if you're still ${pain}, here is what you are missing`,
    ({ outcome, context }) =>
      `The moment everything clicked when we started ${outcome} ${context}`,
    ({ pain, outcome }) =>
      `Nobody warns you how costly ${pain} is until you discover ${outcome}`,
    ({ object }) =>
      `We completely transformed our ${object} and honestly wish we had done it sooner`,
  ],
  motivational: [
    ({ outcome, context }) =>
      `You are one decision away from ${outcome} ${context}`,
    ({ pain, outcome }) =>
      `Stop accepting ${pain}. Start ${outcome}. The time is now.`,
    ({ outcome }) =>
      `The businesses winning right now all chose ${outcome} — will you?`,
    ({ pain, outcome }) =>
      `What if ${pain} was the last obstacle before your breakthrough through ${outcome}`,
  ],
  inspirational: [
    ({ outcome, context }) =>
      `You are one decision away from ${outcome} ${context}`,
    ({ pain, outcome }) =>
      `The journey from ${pain} to ${outcome} starts with one small step`,
    ({ outcome, context }) =>
      `Imagine what becomes possible when you commit to ${outcome} ${context}`,
  ],
  storytelling: [
    ({ pain, outcome }) =>
      `We were ${pain} until the day we committed to ${outcome} — here is what changed`,
    ({ object, outcome }) =>
      `The story of how one ${object} was completely transformed through ${outcome}`,
    ({ pain }) =>
      `Six months ago we were ${pain}. Here is what that journey taught us.`,
    ({ outcome, context }) =>
      `The day we started ${outcome} ${context} — and why we never looked back`,
  ],
  educational: [
    ({ pain, outcome }) =>
      `Why ${pain} happens and the step-by-step approach to ${outcome}`,
    ({ object, outcome }) =>
      `A complete guide to ${outcome} for your ${object}`,
    ({ pain }) =>
      `Understanding the root cause of ${pain} — and what research actually shows`,
    ({ outcome, object }) =>
      `Everything you need to know about ${outcome} before you change your ${object}`,
  ],
  funny: [
    ({ pain }) =>
      `Signs you are still ${pain} — a painfully relatable thread`,
    ({ outcome, context }) =>
      `We tried ${outcome} ${context} and honestly it is embarrassing how well it worked`,
    ({ pain, outcome }) =>
      `${pain}? In this market? Allow me to introduce ${outcome}`,
    ({ object }) =>
      `Our ${object} was a disaster until we finally stopped pretending it was fine`,
  ],
  serious: [
    ({ pain, context }) =>
      `The real and measurable impact of ${pain} ${context} — backed by evidence`,
    ({ outcome, object }) =>
      `Why ${outcome} is no longer optional for a competitive ${object}`,
    ({ pain, outcome }) =>
      `Businesses that ignore ${pain} are 3x more likely to miss targets — ${outcome} changes that`,
  ],
  sarcastic: [
    ({ pain }) =>
      `Ah yes, ${pain} — because who needs results anyway`,
    ({ outcome }) =>
      `Controversial opinion: ${outcome} actually works. I know, shocking.`,
    ({ pain, outcome }) =>
      `Sure, keep ${pain}. Or, radical idea — try ${outcome} instead`,
  ],
};

// Generic templates used when no specific tone match
const GENERIC_TEMPLATES = [
  ({ pain, context }) =>
    `Why most businesses are ${pain} ${context} without realising it`,
  ({ outcome, context }) =>
    `What happens when you commit to ${outcome} ${context}`,
  ({ pain, outcome }) =>
    `The hidden cost of ${pain} — and how ${outcome} changes everything`,
  ({ object, outcome }) =>
    `Turning your ${object} into a results-driven system through ${outcome}`,
  ({ pain }) =>
    `Are you still ${pain}? There is a smarter way to approach this`,
  ({ pain, outcome }) =>
    `From ${pain} to ${outcome} — without adding more to your plate`,
  ({ outcome, object }) =>
    `How ${outcome} completely reframes what your ${object} is capable of`,
  ({ pain, context }) =>
    `Most businesses accept ${pain} ${context} as normal. It is not.`,
];

// ─── Domain Detection ─────────────────────────────────────────────────────────

function detectDomain(niche, category) {
  const text = (String(niche || '') + ' ' + String(category || '')).toLowerCase();
  if (/ecommerce|e-commerce|online store|shopify|dropship|woocommerce|retail|selling|product/.test(text)) return 'ecommerce';
  if (/health|medical|healthcare|wellness|clinic|patient|hospital|nutrition|therapy/.test(text)) return 'health';
  if (/fitness|gym|personal trainer|coach|workout|crossfit|yoga|training/.test(text)) return 'fitness';
  if (/finance|investment|trading|accounting|crypto|fintech|wealth|banking|mortgage/.test(text)) return 'finance';
  if (/education|learning|course|coaching|teaching|edtech|school|tutor|curriculum/.test(text)) return 'education';
  if (/lifestyle|travel|fashion|beauty|food|style|personal brand|creator|influencer/.test(text)) return 'lifestyle';
  if (/fashion|clothing|apparel|style|brand|boutique|designer|wardrobe/.test(text)) return 'fashion';
  if (/restaurant|cafe|food|cuisine|catering|chef|kitchen|dining|bakery/.test(text)) return 'food';
  if (/real estate|property|housing|realty|mortgage|rental|landlord|agent|broker/.test(text)) return 'realestate';
  if (/agency|marketing|design|branding|creative|advertising|social media|pr/.test(text)) return 'agency';
  if (/tech|software|saas|developer|coding|app|startup|digital|cloud|ai|automation/.test(text)) return 'tech';
  return 'default';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Main Generator ───────────────────────────────────────────────────────────

/**
 * Generate one smart topic shaped by niche, category, and tone.
 * @param {Object} options
 * @param {string} options.niche     - e.g. "online selling and hot products"
 * @param {string} options.category  - e.g. "ecommerce"
 * @param {string} options.tone      - e.g. "professional", "casual", "storytelling"
 * @returns {string}
 */
export function generateTopic({ niche = '', category = '', tone = '' } = {}) {
  const domain = detectDomain(niche, category);
  const domainData = DOMAINS[domain] || DOMAINS.default;

  const toneTemplates = TONE_TEMPLATES[tone] || [];
  const allTemplates = [...toneTemplates, ...GENERIC_TEMPLATES];

  const templateFn = pick(allTemplates);
  return templateFn({
    pain:    pick(domainData.painPoints),
    outcome: pick(domainData.outcomes),
    context: pick(domainData.contexts),
    object:  pick(domainData.objects),
  });
}

/**
 * Generate multiple unique topics.
 * @param {number} count
 * @param {Object} options - { niche, category, tone }
 * @returns {string[]}
 */
export function generateMultipleTopics(count = 5, options = {}) {
  const topics = [];
  const seen = new Set();
  let attempts = 0;
  while (topics.length < count && attempts < count * 5) {
    const t = generateTopic(options);
    if (!seen.has(t)) {
      seen.add(t);
      topics.push(t);
    }
    attempts++;
  }
  return topics;
}
