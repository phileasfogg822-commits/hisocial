const axios = require('axios');

// AI Provider Configuration
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini'; // 'gemini' or 'bigmodel'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BIGMODEL_API_KEY = process.env.BIGMODEL_API_KEY;

// Current provider being used (set during pipeline execution)
let currentProvider = AI_PROVIDER;

// ─────────────────────────────────────────────
// PHASE DEFINITIONS
// ─────────────────────────────────────────────

const phases = [
  {
    number: 1,
    name: 'Input Normalization',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 1: Input Normalizer.
Convert raw user input into structured JSON. Return ONLY valid JSON, no markdown.
Output format:
{
  "tone": string,
  "niche": string,
  "category": string,
  "topic": string,
  "normalized_summary": string
}`,
        JSON.stringify(ctx.input)
      );
    }
  },

  {
    number: 2,
    name: 'Content Decomposition & Marketing Strategy',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 2: Marketing Strategist.
Analyze the input and extract marketing structure. Return ONLY valid JSON.
Output format:
{
  "business": string,
  "offer": string,
  "outcome": string,
  "benefits": [string],
  "urgency": string,
  "offer_strength": "low"|"medium"|"high",
  "campaign_type": "awareness"|"consideration"|"conversion"|"retention"
}`,
        JSON.stringify(ctx.phase1)
      );
    }
  },

  {
    number: 3,
    name: 'Customer Psychology Analysis',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 3: Customer Psychology Analyst.
RULE: Never design for the business. Always design for the customer identity.
Return ONLY valid JSON.
Output format:
{
  "who": string,
  "what": string,
  "why": string,
  "fear": string,
  "desire": string,
  "identity": string,
  "emotional_trigger": string,
  "buying_motivation": string
}`,
        `Business context: ${JSON.stringify(ctx.phase2)}\nOriginal input: ${JSON.stringify(ctx.input)}`
      );
    }
  },

  {
    number: 4,
    name: 'Visual Entity Extraction & Category Expert',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 4: Category Expert + Visual Entity Extractor.
Build category knowledge. Extract visual subjects.
RULE: Never visualize the service. Visualize the customer outcome.
Return ONLY valid JSON.
Output format:
{
  "category_knowledge": {
    "mandatory_visuals": [string],
    "optional_visuals": [string]
  },
  "visual_entities": {
    "primary": string,
    "secondary": string,
    "support": [string]
  },
  "category_recognizable_in_2s": boolean,
  "rejection_reason": string|null
}`,
        `Category: ${ctx.input.category}\nBusiness: ${JSON.stringify(ctx.phase2)}\nCustomer: ${JSON.stringify(ctx.phase3)}`
      );
    }
  },

  {
    number: 5,
    name: 'Product Detection & Visibility',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 5: Product Detection Agent.
Determine product type and visibility rules.
PHYSICAL PRODUCT RULE: If product is physical, hero_object MUST be the product.
Product must occupy 20%-60% of visual focus.
Return ONLY valid JSON.
Output format:
{
  "product_type": "physical"|"digital"|"service"|"software",
  "hero_object": string,
  "product_visibility_percent": number,
  "is_hero_the_product": boolean,
  "product_priority_order": [string]
}`,
        JSON.stringify({ phase2: ctx.phase2, phase4: ctx.phase4, input: ctx.input })
      );
    }
  },

  {
    number: 6,
    name: 'Visual Psychology & Color Engine',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 6: Visual Psychology Engine.
Map emotions to colors. Build the color system.
RULES:
- 60% background, 30% primary, 10% accent
- Never exceed 3 major colors
Return ONLY valid JSON.
Output format:
{
  "emotion_map": { "primary_emotion": string, "secondary_emotion": string },
  "color_palette": {
    "background": string,
    "primary": string,
    "accent": string,
    "neutral": string,
    "hex_codes": { "background": string, "primary": string, "accent": string }
  },
  "psychology_rationale": string
}`,
        JSON.stringify({ customer: ctx.phase3, category: ctx.phase4, input: ctx.input })
      );
    }
  },

  {
    number: 7,
    name: 'Style Engine',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 7: Style Engine.
Determine design style. Apply the correct rules.
Styles: minimal | premium | luxury | corporate | modern | futuristic | playful | editorial
MINIMAL RULES: One hero, one color family, max 4 icons, max 2 fonts, 35%-60% whitespace
PREMIUM RULES: Dark bg, high contrast, subtle gradients, large typography, reduced clutter
CORPORATE RULES: Grid layouts, conservative colors, structured spacing, data-first
Return ONLY valid JSON.
Output format:
{
  "chosen_style": string,
  "style_rationale": string,
  "style_rules_applied": [string],
  "fonts": { "heading": string, "body": string },
  "max_icons": number,
  "whitespace_target_percent": number
}`,
        JSON.stringify({ input: ctx.input, psychology: ctx.phase6, customer: ctx.phase3 })
      );
    }
  },

  {
    number: 8,
    name: 'Hero Object Selection',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 8: Hero Object Engine.
Select ONE and ONLY ONE hero object.
RULE: Business > Service. Visualize outcome, not tool.
NEVER use: Laptop, Phone, Dashboard, Icons, abstract cubes
ALWAYS prefer: The actual business, product, or customer outcome
Return ONLY valid JSON.
Output format:
{
  "hero_object": string,
  "hero_rationale": string,
  "rejected_options": [string],
  "hero_quality_checks": {
    "high_detail": boolean,
    "high_realism": boolean,
    "brand_relevant": boolean,
    "emotionally_recognizable": boolean
  }
}`,
        JSON.stringify({ phase2: ctx.phase2, phase4: ctx.phase4, phase5: ctx.phase5, input: ctx.input })
      );
    }
  },

  {
    number: 9,
    name: 'Layout Planning',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 9: Layout Planner.
Generate layout map based on the image ratio.
RATIO ZONES for 1:1: Top Safe(0-30%), Headline(31-60%), Benefits(61-80%), CTA(81-90%), Bottom Safe(91-100%)
SIDE MARGINS: 10% left, 10% right. Never place text outside content area.
Return ONLY valid JSON.
Output format:
{
  "ratio": string,
  "grid": {
    "top_safe_zone": "0-30%",
    "headline_zone": "31-60%",
    "benefits_zone": "61-80%",
    "cta_zone": "81-90%",
    "bottom_safe_zone": "91-100%"
  },
  "side_margins": { "left": "10%", "right": "10%" },
  "content_area_width": "80%",
  "layout_style": "text_left_visual_right"|"visual_left_text_right"|"centered"
}`,
        JSON.stringify({ style: ctx.phase7, input: ctx.input })
      );
    }
  },

  {
    number: 10,
    name: 'Visual Hierarchy & Information Weight',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 10: Hierarchy Builder.
Calculate visual weight percentages. Visual weight follows hierarchy, not content length.
Standard weights: headline 45%, hero 30%, benefits 15%, cta 7%, hashtags 3%
THUMBNAIL TEST: Mentally shrink to 100px. Must communicate Business + Offer + Category in 2 seconds.
Return ONLY valid JSON.
Output format:
{
  "hierarchy": {
    "headline_weight": number,
    "hero_weight": number,
    "benefits_weight": number,
    "cta_weight": number,
    "hashtags_weight": number
  },
  "thumbnail_test_pass": boolean,
  "thumbnail_communicates": { "business": boolean, "offer": boolean, "category": boolean },
  "total_weight_check": number
}`,
        JSON.stringify({ layout: ctx.phase9, hero: ctx.phase8, input: ctx.input })
      );
    }
  },

  {
    number: 11,
    name: 'Headline Optimization',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 11: Headline Optimizer.
RULES: Max 3 words per line. Break into multiple lines. Typography: H1 72-120px, H2 40-60px, Body 24-36px, CTA 28-40px.
Convert the heading into a broken multi-line version optimized for visual hierarchy.
Return ONLY valid JSON.
Output format:
{
  "original_headline": string,
  "optimized_headline": string,
  "headline_lines": [string],
  "typography": { "h1_size": string, "h2_size": string, "body_size": string, "cta_size": string }
}`,
        JSON.stringify({ heading: ctx.generated_content?.headline, input: ctx.input, hierarchy: ctx.phase10 })
      );
    }
  },

  {
    number: 12,
    name: 'Benefit Extraction & Icon Mapping',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 12: Benefit Extraction Engine + Icon Mapper.
Extract 2-4 key benefits. Map each to an icon.
Icon options: clock(speed), chart(growth), shield(trust), lock(security), monitor(website), phone(mobile), trophy(success), headset(support), star(quality), heart(care), leaf(eco), globe(reach)
RULES: 2-4 icons ideal, never exceed 5.
Return ONLY valid JSON.
Output format:
{
  "benefits": [{ "label": string, "icon": string, "visual_representation": string }],
  "benefit_count": number,
  "icon_count_check_pass": boolean
}`,
        JSON.stringify({ phase2: ctx.phase2, post_content: ctx.generated_content?.post_content })
      );
    }
  },

  {
    number: 13,
    name: 'CTA Engine',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 13: CTA Engine.
Convert weak CTA into a strong action CTA.
RULES: Must start with a verb. Must be short. Max 4 words.
Good CTAs: Get Started, Book Today, Launch Now, Claim Offer, Get Website Now, Shop Now, Order Today
Bad CTAs: Learn More, Click Here, Find Out
Also determine if an offer badge is needed.
Return ONLY valid JSON.
Output format:
{
  "original_cta": string,
  "optimized_cta": string,
  "cta_verb": string,
  "word_count": number,
  "offer_badge_needed": boolean,
  "offer_badge_text": string|null
}`,
        JSON.stringify({ phase2: ctx.phase2, offer_strength: ctx.phase2?.offer_strength })
      );
    }
  },

  {
    number: 14,
    name: 'Depth & Layer Engine',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 14: Depth Engine.
Define visual layers. Minimum 5 layers required or design appears flat.
Layers: Background → Environment → Hero → Typography → Icons → CTA → Decorative
Return ONLY valid JSON.
Output format:
{
  "layers": [{ "layer_number": number, "layer_name": string, "layer_content": string, "depth_position": string }],
  "total_layers": number,
  "depth_check_pass": boolean,
  "depth_rationale": string
}`,
        JSON.stringify({ hero: ctx.phase8, style: ctx.phase7, layout: ctx.phase9 })
      );
    }
  },

  {
    number: 15,
    name: 'Whitespace & Balance Engine',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 15: Whitespace & Balance Engine.
Target: 35%-60% empty space. Professional designs use 40%-50% empty.
Low-quality designs: 10%-20% empty.
Balance: Text Left + Visual Right OR Visual Left + Text Right. Never center everything.
Return ONLY valid JSON.
Output format:
{
  "whitespace_target_percent": number,
  "whitespace_quality_tier": "professional"|"acceptable"|"cluttered",
  "balance_rule": string,
  "visual_weight_left": number,
  "visual_weight_right": number,
  "balance_score": number,
  "balance_pass": boolean
}`,
        JSON.stringify({ layout: ctx.phase9, style: ctx.phase7, hierarchy: ctx.phase10 })
      );
    }
  },

  {
    number: 16,
    name: 'Platform Optimization',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 16: Social Platform Optimizer.
Instagram: Large headline, minimal text, strong hero
LinkedIn: Corporate tone, more whitespace, data-driven
Facebook: Clear CTA, friendly imagery
Return ONLY valid JSON.
Output format:
{
  "recommended_platforms": [string],
  "primary_platform": string,
  "platform_adjustments": [string],
  "hashtag_strategy": string
}`,
        JSON.stringify({ input: ctx.input, phase2: ctx.phase2, style: ctx.phase7 })
      );
    }
  },

  {
    number: 17,
    name: 'Visual Story Architecture',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 17: Visual Story Architect.
Convert marketing into a SCENE. Visuals must represent OUTCOME, not feature.
BAD: checkmarks, tech dashboards, abstract cubes
GOOD: happy customers, real products, lifestyle outcomes
ABSTRACT WORD TRANSLATOR: trust→shield, growth→graph, eco→green leaves, speed→clock
Return ONLY valid JSON.
Output format:
{
  "scene_description": string,
  "hero_in_scene": string,
  "supporting_elements": [string],
  "atmosphere": string,
  "lighting": string,
  "emotional_feeling": string,
  "story_rule_pass": boolean,
  "rejected_abstract_elements": [string]
}`,
        JSON.stringify({
          hero: ctx.phase8,
          customer: ctx.phase3,
          category: ctx.phase4,
          benefits: ctx.phase12,
          post: ctx.generated_content
        })
      );
    }
  },

  {
    number: 18,
    name: 'Visual Validation (All Checks)',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 18: Visual Validator.
Run all validation checks. Score each 0-100. Minimum passing score: 75-85 depending on check.
Return ONLY valid JSON.
Output format:
{
  "checks": {
    "category_match": { "score": number, "pass": boolean, "note": string },
    "product_match": { "score": number, "pass": boolean, "note": string },
    "customer_match": { "score": number, "pass": boolean, "note": string },
    "visual_authenticity": { "score": number, "pass": boolean, "minimum": 80, "note": string },
    "product_visibility": { "score": number, "pass": boolean, "minimum": 75, "note": string },
    "clarity": { "score": number, "pass": boolean, "minimum": 85, "note": string },
    "brand_relevance": { "score": number, "pass": boolean, "minimum": 80, "note": string },
    "conversion_potential": { "score": number, "pass": boolean, "minimum": 75, "note": string }
  },
  "all_pass": boolean,
  "failed_checks": [string],
  "action": "proceed"|"rebuild_scene",
  "rebuild_reason": string|null
}`,
        JSON.stringify({
          story: ctx.phase17,
          hero: ctx.phase8,
          category: ctx.phase4,
          customer: ctx.phase3,
          cta: ctx.phase13,
          hierarchy: ctx.phase10
        })
      );
    }
  },

  {
    number: 19,
    name: 'Final Prompt Architecture',
    run: async (ctx) => {
      return await callClaude(
        `You are Agent 19: Prompt Architect (FINAL).
Only generate the image prompt AFTER all validation passes.
HERO OBJECT RULE: Only ONE dominant hero. Never mix laptop + phone + dashboard + product + plant all together.
Build a highly detailed, photorealistic image generation prompt.
Return ONLY valid JSON.
Output format:
{
  "prompt": string,
  "scene": string,
  "hero_object": string,
  "supporting_objects": [string],
  "background": string,
  "lighting": string,
  "composition": string,
  "color_palette": string,
  "typography_instruction": string,
  "offer_badge": string|null,
  "cta_text": string,
  "style": string,
  "negative_prompt": string,
  "full_prompt_for_alibaba": string
}`,
        JSON.stringify({
          story: ctx.phase17,
          hero: ctx.phase8,
          layout: ctx.phase9,
          colors: ctx.phase6,
          style: ctx.phase7,
          headline: ctx.phase11,
          benefits: ctx.phase12,
          cta: ctx.phase13,
          layers: ctx.phase14,
          validation: ctx.phase18,
          generated_content: ctx.generated_content
        })
      );
    }
  }
];

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

async function callAI(systemPrompt, userMessage, provider = currentProvider) {
  try {
    console.log(`   🔄 Calling AI: ${provider.toUpperCase()}`);
    console.log(`      📤 Prompt chars: system=${systemPrompt?.length || 0}, user=${userMessage?.length}`);
    
    let result;
    if (provider === 'gemini') {
      result = await callGemini(systemPrompt, userMessage);
    } else if (provider === 'bigmodel') {
      result = await callBigModel(systemPrompt, userMessage);
    } else {
      throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    console.log(`      ✅ Response received: ${JSON.stringify(result).substring(0, 100)}...`);
    return result;
  } catch (error) {
    console.error(`❌ Error calling ${provider}:`, error.message);
    // Fallback to alternate provider if available
    const fallback = provider === 'gemini' ? 'bigmodel' : 'gemini';
    if (fallback === 'bigmodel' && !BIGMODEL_API_KEY) throw error;
    if (fallback === 'gemini' && !GEMINI_API_KEY) throw error;
    
    console.warn(`🔄 Falling back to ${fallback}...`);
    return await callAI(systemPrompt, userMessage, fallback);
  }
}

async function callGemini(systemPrompt, userMessage) {
  const combined = systemPrompt ? `${systemPrompt}\n\n${userMessage}` : userMessage;
  
  console.log(`      🌐 Gemini API Call`);
  console.log(`         Endpoint: generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash`);
  console.log(`         Combined prompt length: ${combined.length} chars`);
  
  const startTime = Date.now();
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: combined }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
    }
  );
  
  const duration = Date.now() - startTime;
  console.log(`         Response received in ${duration}ms`);
  
  const text = response.data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
  console.log(`         Response text length: ${text.length} chars`);
  
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    console.log(`         ✅ Successfully parsed as JSON`);
    return parsed;
  } catch {
    console.log(`         ⚠️  Could not parse as JSON, returning raw text`);
    return { raw: text };
  }
}

async function callBigModel(systemPrompt, userMessage) {
  const messages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }]
    : [{ role: 'user', content: userMessage }];
    
  console.log(`      🌐 BigModel API Call`);
  console.log(`         Endpoint: open.bigmodel.cn/api/paas/v4/chat/completions`);
  console.log(`         Model: glm-4-flash`);
  console.log(`         Message count: ${messages.length}`);
  console.log(`         Total message content: ${messages.reduce((sum, m) => sum + m.content.length, 0)} chars`);
  
  const startTime = Date.now();
  const response = await axios.post(
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    {
      model: 'glm-4-flash',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    },
    {
      headers: {
        Authorization: `Bearer ${BIGMODEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const duration = Date.now() - startTime;
  console.log(`         Response received in ${duration}ms`);
  
  const text = response.data?.choices?.[0]?.message?.content || '';
  console.log(`         Response text length: ${text.length} chars`);
  
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    console.log(`         ✅ Successfully parsed as JSON`);
    return parsed;
  } catch {
    console.log(`         ⚠️  Could not parse as JSON, returning raw text`);
    return { raw: text };
  }
}

async function callClaude(systemPrompt, userMessage) {
  // Legacy wrapper - now calls AI provider
  return await callAI(systemPrompt, userMessage);
}

async function generatePostContent(input, provider = AI_PROVIDER) {
  console.log('\n🎬 [PHASE 0] Content Generation Starting');
  console.log('   📝 Input:', JSON.stringify(input, null, 2));
  console.log('   🤖 Provider:', provider);
  
  const systemPrompt = `You are a social media content expert. Generate high-converting social media post content.
Return ONLY valid JSON, no markdown, no backticks.
Output format:
{
  "post_content": string (150-250 words, engaging, benefit-focused),
  "headline": string (strong, punchy, max 8 words),
  "hashtags": string (8-12 relevant hashtags as a single string),
  "image_ratio": "1:1"|"4:5"|"16:9"|"9:16",
  "image_style": "minimal"|"premium"|"luxury"|"corporate"|"modern"|"futuristic"|"playful"|"3D-realistic",
  "content_rationale": string
}`;

  const userMessage = `Generate social media content for:
Tone: ${input.tone}
Niche: ${input.niche}
Category: ${input.category}
Topic: ${input.topic}

Apply customer psychology — design for the customer's identity, fear, and desire. Focus on outcome, not features.`;

  const result = await callAI(systemPrompt, userMessage, provider);
  
  console.log('   ✅ Content Generated:');
  console.log('      📄 Post:', result.post_content?.substring(0, 100) + '...');
  console.log('      🏷️  Headline:', result.headline);
  console.log('      #️⃣  Hashtags:', result.hashtags);
  console.log('      🖼️  Image Ratio:', result.image_ratio);
  console.log('      🎨 Image Style:', result.image_style);
  console.log('      💭 Rationale:', result.content_rationale?.substring(0, 80) + '...');
  
  return result;
}

// ─────────────────────────────────────────────
// MASTER PIPELINE RUNNER
// ─────────────────────────────────────────────

async function runFullPipeline(input, sessionId, provider = AI_PROVIDER, onPhaseUpdate) {
  // Set current provider for this pipeline run
  currentProvider = provider;
  const ctx = { input, provider };

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         🚀 AI CREATIVE ENGINE PIPELINE STARTED                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`   📌 Session ID: ${sessionId}`);
  console.log(`   🤖 Provider: ${provider}`);
  console.log(`   ⏰ Timestamp: ${new Date().toISOString()}\n`);

  // Initialize all phases as running initially
  for (let i = 0; i <= 19; i++) {
    if (i === 0) {
      onPhaseUpdate({
        phaseNumber: i,
        phaseName: 'Content Generation (Post + Headline + Hashtags)',
        input: input,
        output: null,
        status: 'running',
        scores: null
      });
    } else {
      const phase = phases.find(p => p.number === i);
      if (phase) {
        onPhaseUpdate({
          phaseNumber: i,
          phaseName: phase.name,
          input: {},
          output: null,
          status: 'running',
          scores: null
        });
      }
    }
  }

  // ── PHASE 0: Generate post content first ──
  const startTime = Date.now();
  const generatedContent = await generatePostContent(input, provider);
  ctx.generated_content = generatedContent;

  onPhaseUpdate({
    phaseNumber: 0,
    phaseName: 'Content Generation (Post + Headline + Hashtags)',
    input: input,
    output: generatedContent,
    status: 'pass',
    scores: null,
    duration_ms: Date.now() - startTime
  });

  // ── PHASES 1–19 ──
  for (const phase of phases) {
    const phaseStartTime = Date.now();
    
    console.log(`\n📋 [PHASE ${phase.number}] ${phase.name}`);
    console.log(`   ⏱️  Starting at ${new Date().toLocaleTimeString()}...`);
    
    const result = await phase.run(ctx);
    ctx[`phase${phase.number}`] = result;

    // Extract scores if this is the validation phase
    const scores = phase.number === 18 ? result.checks : null;
    const status = phase.number === 18
      ? (result.all_pass ? 'pass' : 'fail')
      : 'pass';

    const phaseDuration = Date.now() - phaseStartTime;

    // Log phase results
    console.log(`   ✅ Completed in ${phaseDuration}ms`);
    if (phase.number === 18) {
      console.log(`   📊 Validation Checks:`, JSON.stringify(result.checks, null, 2));
    } else if (phase.number === 19) {
      console.log(`   🖼️  Image Prompt Generated (chars: ${result.full_prompt_for_alibaba?.length || 0})`);
      console.log(`   📝 Prompt Preview: ${result.full_prompt_for_alibaba?.substring(0, 150)}...`);
    } else {
      const resultPreview = JSON.stringify(result).substring(0, 100);
      console.log(`   📊 Result: ${resultPreview}...`);
    }

    onPhaseUpdate({
      phaseNumber: phase.number,
      phaseName: phase.name,
      input: {},
      output: result,
      status,
      scores,
      duration_ms: phaseDuration
    });

    // If validation fails, rebuild scene (Phase 17) then re-validate
    if (phase.number === 18 && !result.all_pass) {
      console.log(`\n⚠️  [PHASE 17.1] Scene Rebuild (Validation Failed — Retrying)`);
      console.log(`   ❌ Validation Issues: ${Object.values(result.checks).filter(v => !v).length} failures detected`);
      
      const rebuildStartTime = Date.now();
      onPhaseUpdate({
        phaseNumber: 17.1,
        phaseName: 'Scene Rebuild (Validation Failed — Retrying)',
        input: ctx,
        output: null,
        status: 'running',
        scores: null
      });
      ctx.phase17 = await phases[16].run(ctx);
      
      const rebuildDuration = Date.now() - rebuildStartTime;
      console.log(`   ✅ Scene Rebuilt in ${rebuildDuration}ms`);
      
      onPhaseUpdate({
        phaseNumber: 17.1,
        phaseName: 'Scene Rebuild Complete',
        input: {},
        output: ctx.phase17,
        status: 'pass',
        scores: null,
        duration_ms: rebuildDuration
      });

      // Re-run validation after rebuild
      console.log(`\n📋 [PHASE 18.1] Re-running Validation After Scene Rebuild`);
      const validationStartTime = Date.now();
      const validationResult = await phases[17].run(ctx);
      const validationDuration = Date.now() - validationStartTime;
      ctx.phase18 = validationResult;
      console.log(`   ✅ Re-validation completed in ${validationDuration}ms`);
      onPhaseUpdate({
        phaseNumber: 18.1,
        phaseName: 'Validation After Scene Rebuild',
        input: {},
        output: validationResult,
        status: validationResult.all_pass ? 'pass' : 'fail',
        scores: validationResult.checks,
        duration_ms: validationDuration
      });
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║         ✨ PIPELINE COMPLETED SUCCESSFULLY                     ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`   📄 Post Content Length: ${ctx.generated_content.post_content?.length} chars`);
  console.log(`   🖼️  Image Prompt Length: ${ctx.phase19?.full_prompt_for_alibaba?.length} chars`);
  console.log(`   ✅ Status: All phases completed\n`);

  return {
    content: {
      post_content: ctx.generated_content.post_content,
      headline: ctx.generated_content.headline,
      hashtags: ctx.generated_content.hashtags,
      image_ratio: ctx.generated_content.image_ratio,
      image_style: ctx.generated_content.image_style,
      image_prompt: ctx.phase19?.full_prompt_for_alibaba || ctx.phase19?.prompt || ''
    },
    allPhases: ctx
  };
}

module.exports = {
  runFullPipeline
};