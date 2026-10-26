# AI SOCIAL CREATIVE ENGINE — COMPLETE SYSTEM SPECIFICATION
## For GitHub Copilot (Claude Haiku) Implementation

---

## OVERVIEW

Build a full-stack web application that:
1. Accepts user input (tone, topic, category, niche)
2. Runs a multi-phase AI pipeline (Claude Sonnet via Anthropic API)
3. Generates post content, headline, hashtags using psychological + marketing intelligence
4. Runs a second AI pipeline to produce an engineered image prompt
5. Displays every phase step-by-step with real-time logs
6. Stores every session in a local SQLite database (history)
7. Exposes a final "Generate Image" button that sends the crafted prompt to Alibaba image generation API

---

## TECH STACK

- **Frontend:** React + Tailwind CSS (single-page app)
- **Backend:** Node.js + Express
- **AI Model:** Anthropic Claude API (`claude-sonnet-4-20250514`) via `/v1/messages`
- **Database:** SQLite via `better-sqlite3`
- **Image Generation:** Alibaba Tongyi Wanxiang API (called only when user clicks "Generate Image")
- **State:** React useState / useReducer
- **Streaming:** Server-Sent Events (SSE) from Express to React for live logs

---

## PROJECT STRUCTURE

```
ai-social-engine/
├── backend/
│   ├── server.js              # Express server, SSE endpoint
│   ├── db.js                  # SQLite setup and queries
│   ├── pipeline/
│   │   ├── phase1_normalize.js
│   │   ├── phase2_content_decompose.js
│   │   ├── phase3_marketing_intent.js
│   │   ├── phase4_visual_entity.js
│   │   ├── phase5_psychology.js
│   │   ├── phase6_style_engine.js
│   │   ├── phase7_hero_object.js
│   │   ├── phase8_layout.js
│   │   ├── phase9_hierarchy.js
│   │   ├── phase10_headline.js
│   │   ├── phase11_benefits.js
│   │   ├── phase12_cta.js
│   │   ├── phase13_depth.js
│   │   ├── phase14_whitespace.js
│   │   ├── phase15_balance.js
│   │   ├── phase16_thumbnail_test.js
│   │   ├── phase17_platform_optimize.js
│   │   ├── phase18_prompt_architect.js
│   │   ├── agent_validator.js     # Validation agent (scores all checks)
│   │   └── run_pipeline.js        # Orchestrator
│   └── routes/
│       ├── generate.js            # POST /api/generate — starts pipeline
│       ├── history.js             # GET /api/history
│       └── image.js               # POST /api/generate-image
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── InputForm.jsx
│   │   │   ├── PipelineLog.jsx
│   │   │   ├── PhaseCard.jsx
│   │   │   ├── OutputPanel.jsx
│   │   │   ├── ImagePromptPanel.jsx
│   │   │   ├── HistoryPanel.jsx
│   │   │   └── ScoreDisplay.jsx
│   │   └── styles/
│   │       └── index.css
│   └── index.html
├── .env
└── package.json
```

---

## DATABASE SCHEMA (SQLite)

```sql
-- sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tone TEXT,
  niche TEXT,
  category TEXT,
  topic TEXT,
  status TEXT DEFAULT 'running',  -- running | completed | failed
  final_prompt TEXT,
  image_url TEXT
);

-- phase_logs table
CREATE TABLE IF NOT EXISTS phase_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  phase_number INTEGER,
  phase_name TEXT,
  input_data TEXT,   -- JSON
  output_data TEXT,  -- JSON
  status TEXT,       -- pass | fail | skip
  scores TEXT,       -- JSON (for validation phases)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- generated_content table
CREATE TABLE IF NOT EXISTS generated_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  post_content TEXT,
  headline TEXT,
  hashtags TEXT,
  image_ratio TEXT,
  image_style TEXT,
  image_prompt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## BACKEND — server.js

```javascript
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import generateRoute from './routes/generate.js';
import historyRoute from './routes/history.js';
import imageRoute from './routes/image.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/generate', generateRoute);
app.use('/api/history', historyRoute);
app.use('/api/generate-image', imageRoute);

app.listen(3001, () => console.log('Server running on port 3001'));
```

---

## BACKEND — db.js

```javascript
import Database from 'better-sqlite3';

export const db = new Database('./engine.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    tone TEXT, niche TEXT, category TEXT, topic TEXT,
    status TEXT DEFAULT 'running',
    final_prompt TEXT, image_url TEXT
  );
  CREATE TABLE IF NOT EXISTS phase_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER, phase_number INTEGER,
    phase_name TEXT, input_data TEXT, output_data TEXT,
    status TEXT, scores TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS generated_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER, post_content TEXT, headline TEXT,
    hashtags TEXT, image_ratio TEXT, image_style TEXT,
    image_prompt TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export function createSession(data) {
  const stmt = db.prepare(
    'INSERT INTO sessions (tone, niche, category, topic) VALUES (?, ?, ?, ?)'
  );
  return stmt.run(data.tone, data.niche, data.category, data.topic).lastInsertRowid;
}

export function logPhase(sessionId, phaseNum, phaseName, input, output, status, scores = null) {
  db.prepare(
    `INSERT INTO phase_logs (session_id, phase_number, phase_name, input_data, output_data, status, scores)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, phaseNum, phaseName, JSON.stringify(input), JSON.stringify(output), status, JSON.stringify(scores));
}

export function saveGeneratedContent(sessionId, content) {
  db.prepare(
    `INSERT INTO generated_content (session_id, post_content, headline, hashtags, image_ratio, image_style, image_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, content.post_content, content.headline, content.hashtags, content.image_ratio, content.image_style, content.image_prompt);
}

export function updateSessionStatus(sessionId, status, finalPrompt = null, imageUrl = null) {
  db.prepare('UPDATE sessions SET status=?, final_prompt=?, image_url=? WHERE id=?')
    .run(status, finalPrompt, imageUrl, sessionId);
}

export function getAllSessions() {
  return db.prepare(`
    SELECT s.*, gc.post_content, gc.headline, gc.image_prompt
    FROM sessions s
    LEFT JOIN generated_content gc ON gc.session_id = s.id
    ORDER BY s.created_at DESC LIMIT 50
  `).all();
}

export function getSessionLogs(sessionId) {
  return db.prepare('SELECT * FROM phase_logs WHERE session_id = ? ORDER BY phase_number').all(sessionId);
}
```

---

## BACKEND — routes/generate.js (SSE Streaming Pipeline)

```javascript
import express from 'express';
import { createSession, logPhase, saveGeneratedContent, updateSessionStatus } from '../db.js';
import { runFullPipeline } from '../pipeline/run_pipeline.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { tone, niche, category, topic } = req.body;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Create session
  const sessionId = createSession({ tone, niche, category, topic });
  send('session', { sessionId });

  try {
    const result = await runFullPipeline(
      { tone, niche, category, topic },
      sessionId,
      (phaseUpdate) => {
        send('phase', phaseUpdate);
        logPhase(
          sessionId,
          phaseUpdate.phaseNumber,
          phaseUpdate.phaseName,
          phaseUpdate.input,
          phaseUpdate.output,
          phaseUpdate.status,
          phaseUpdate.scores || null
        );
      }
    );

    saveGeneratedContent(sessionId, result.content);
    updateSessionStatus(sessionId, 'completed', result.content.image_prompt);
    send('complete', { sessionId, result });
  } catch (err) {
    updateSessionStatus(sessionId, 'failed');
    send('error', { message: err.message });
  }

  res.end();
});

export default router;
```

---

## BACKEND — pipeline/run_pipeline.js (MASTER ORCHESTRATOR)

This is the core engine. It runs all phases in sequence. Each phase calls the Claude API.

```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callClaude(systemPrompt, userMessage) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { raw: text };
  }
}

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
// CONTENT GENERATION (Phase 0 — runs FIRST)
// ─────────────────────────────────────────────

async function generatePostContent(input) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: `You are a social media content expert. Generate high-converting social media post content.
Return ONLY valid JSON, no markdown, no backticks.
Output format:
{
  "post_content": string (150-250 words, engaging, benefit-focused),
  "headline": string (strong, punchy, max 8 words),
  "hashtags": string (8-12 relevant hashtags as a single string),
  "image_ratio": "1:1"|"4:5"|"16:9"|"9:16",
  "image_style": "minimal"|"premium"|"luxury"|"corporate"|"modern"|"futuristic"|"playful"|"3D-realistic",
  "content_rationale": string
}`,
    messages: [{
      role: 'user',
      content: `Generate social media content for:
Tone: ${input.tone}
Niche: ${input.niche}
Category: ${input.category}
Topic: ${input.topic}

Apply customer psychology — design for the customer's identity, fear, and desire. Focus on outcome, not features.`
    }]
  });
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────
// MASTER PIPELINE RUNNER
// ─────────────────────────────────────────────

export async function runFullPipeline(input, sessionId, onPhaseUpdate) {

  const ctx = { input };

  // ── PHASE 0: Generate post content first ──
  onPhaseUpdate({
    phaseNumber: 0,
    phaseName: 'Content Generation (Post + Headline + Hashtags)',
    input,
    output: null,
    status: 'running',
    scores: null
  });

  const generatedContent = await generatePostContent(input);
  ctx.generated_content = generatedContent;

  onPhaseUpdate({
    phaseNumber: 0,
    phaseName: 'Content Generation (Post + Headline + Hashtags)',
    input,
    output: generatedContent,
    status: 'pass',
    scores: null
  });

  // ── PHASES 1–19 ──
  for (const phase of phases) {
    onPhaseUpdate({
      phaseNumber: phase.number,
      phaseName: phase.name,
      input: ctx,
      output: null,
      status: 'running',
      scores: null
    });

    const result = await phase.run(ctx);
    ctx[`phase${phase.number}`] = result;

    // Extract scores if this is the validation phase
    const scores = phase.number === 18 ? result.checks : null;
    const status = phase.number === 18
      ? (result.all_pass ? 'pass' : 'fail')
      : 'pass';

    onPhaseUpdate({
      phaseNumber: phase.number,
      phaseName: phase.name,
      input: {},
      output: result,
      status,
      scores
    });

    // If validation fails, rebuild scene (Phase 17) then re-validate
    if (phase.number === 18 && !result.all_pass) {
      onPhaseUpdate({
        phaseNumber: 17.1,
        phaseName: 'Scene Rebuild (Validation Failed — Retrying)',
        input: ctx,
        output: null,
        status: 'running',
        scores: null
      });
      ctx.phase17 = await phases[16].run(ctx);
      onPhaseUpdate({
        phaseNumber: 17.1,
        phaseName: 'Scene Rebuild Complete',
        input: {},
        output: ctx.phase17,
        status: 'pass',
        scores: null
      });
    }
  }

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
```

---

## FRONTEND — App.jsx (Main Layout)

```jsx
import { useState, useRef } from 'react';
import InputForm from './components/InputForm';
import PipelineLog from './components/PipelineLog';
import OutputPanel from './components/OutputPanel';
import HistoryPanel from './components/HistoryPanel';

export default function App() {
  const [phases, setPhases] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('pipeline'); // pipeline | history
  const eventSourceRef = useRef(null);

  const startPipeline = async (formData) => {
    setIsRunning(true);
    setPhases([]);
    setResult(null);

    const response = await fetch('http://localhost:3001/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    // SSE reading via fetch streaming
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (line.startsWith('event: session') || text.includes('event: session')) {
            setSessionId(data.sessionId);
          }
          if (text.includes('event: phase')) {
            setPhases(prev => {
              const existing = prev.findIndex(p => p.phaseNumber === data.phaseNumber);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = data;
                return updated;
              }
              return [...prev, data];
            });
          }
          if (text.includes('event: complete')) {
            setResult(data.result);
            setIsRunning(false);
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-400">⚡ AI Social Creative Engine</h1>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-1.5 rounded text-sm ${activeTab === 'pipeline' ? 'bg-purple-600' : 'bg-gray-700'}`}>
            Pipeline
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded text-sm ${activeTab === 'history' ? 'bg-purple-600' : 'bg-gray-700'}`}>
            History
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Input + Log */}
        <div className="w-[380px] flex flex-col border-r border-gray-800 overflow-y-auto">
          <div className="p-4 border-b border-gray-800">
            <InputForm onSubmit={startPipeline} isRunning={isRunning} />
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <PipelineLog phases={phases} isRunning={isRunning} />
          </div>
        </div>

        {/* RIGHT: Output */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'pipeline' && (
            <OutputPanel result={result} phases={phases} sessionId={sessionId} />
          )}
          {activeTab === 'history' && <HistoryPanel />}
        </div>
      </div>
    </div>
  );
}
```

---

## FRONTEND — components/InputForm.jsx

```jsx
export default function InputForm({ onSubmit, isRunning }) {
  const [form, setForm] = useState({ tone: '', niche: '', category: '', topic: '' });

  const toneOptions = ['Professional', 'Friendly', 'Urgent', 'Luxury', 'Playful', 'Inspirational', 'Educational'];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Input Parameters</h2>
      
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Tone</label>
        <select value={form.tone} onChange={e => setForm({...form, tone: e.target.value})}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
          <option value="">Select tone...</option>
          {toneOptions.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Niche</label>
        <input value={form.niche} onChange={e => setForm({...form, niche: e.target.value})}
          placeholder="e.g. sustainable gardening"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Category</label>
        <input value={form.category} onChange={e => setForm({...form, category: e.target.value})}
          placeholder="e.g. biodegradable pots"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Topic</label>
        <textarea value={form.topic} onChange={e => setForm({...form, topic: e.target.value})}
          placeholder="e.g. New eco-friendly pots for urban gardeners"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
      </div>

      <button type="submit" disabled={isRunning || !form.tone || !form.niche || !form.category || !form.topic}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed
                   rounded py-2.5 text-sm font-semibold transition-colors">
        {isRunning ? '⚡ Pipeline Running...' : '🚀 Run Creative Engine'}
      </button>
    </form>
  );
}
```

---

## FRONTEND — components/PipelineLog.jsx

```jsx
const STATUS_ICONS = {
  running: '⏳',
  pass: '✅',
  fail: '❌',
  skip: '⏭️'
};

const STATUS_COLORS = {
  running: 'text-yellow-400 animate-pulse',
  pass: 'text-green-400',
  fail: 'text-red-400',
  skip: 'text-gray-500'
};

export default function PipelineLog({ phases, isRunning }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Pipeline Log {isRunning && <span className="text-yellow-400 animate-pulse ml-1">● LIVE</span>}
      </h2>
      <div className="space-y-1.5">
        {phases.map((phase) => (
          <div key={phase.phaseNumber}
            className={`rounded px-3 py-2 text-xs border ${
              phase.status === 'running' ? 'border-yellow-500/30 bg-yellow-500/5' :
              phase.status === 'pass' ? 'border-green-500/20 bg-green-500/5' :
              phase.status === 'fail' ? 'border-red-500/30 bg-red-500/10' :
              'border-gray-700 bg-gray-800/50'
            }`}>
            <div className="flex items-center justify-between">
              <span className={STATUS_COLORS[phase.status]}>
                {STATUS_ICONS[phase.status]} Phase {phase.phaseNumber}
              </span>
              {phase.status === 'pass' && <span className="text-green-500 text-[10px]">DONE</span>}
              {phase.status === 'fail' && <span className="text-red-500 text-[10px]">FAILED</span>}
            </div>
            <p className="text-gray-300 mt-0.5 font-medium">{phase.phaseName}</p>
            
            {/* Validation scores */}
            {phase.scores && (
              <div className="mt-1.5 space-y-0.5">
                {Object.entries(phase.scores).map(([key, check]) => (
                  <div key={key} className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className={check.pass ? 'text-green-400' : 'text-red-400'}>
                      {check.score}/100 {check.pass ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {phases.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-8">
            Pipeline logs will appear here when you run the engine
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## FRONTEND — components/OutputPanel.jsx

```jsx
import { useState } from 'react';

export default function OutputPanel({ result, phases, sessionId }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState(null);

  const generateImage = async () => {
    if (!result) return;
    setIsGeneratingImage(true);
    try {
      const res = await fetch('http://localhost:3001/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: result.content.image_prompt,
          sessionId,
          ratio: result.content.image_ratio
        })
      });
      const data = await res.json();
      setImageUrl(data.image_url);
    } catch (err) {
      alert('Image generation failed: ' + err.message);
    }
    setIsGeneratingImage(false);
  };

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="text-center">
          <div className="text-5xl mb-4">⚡</div>
          <p className="text-lg">Run the pipeline to see output here</p>
          <p className="text-sm mt-1">Fill the form on the left and click Run</p>
        </div>
      </div>
    );
  }

  const { content } = result;
  const finalPhase = phases.find(p => p.phaseNumber === 19);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Generated Content */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wide mb-4">📝 Generated Content</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase">Headline</label>
            <p className="text-xl font-bold text-white mt-1">{content.headline}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase">Post Content</label>
            <p className="text-gray-300 text-sm mt-1 leading-relaxed">{content.post_content}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase">Hashtags</label>
            <p className="text-purple-400 text-sm mt-1">{content.hashtags}</p>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase">Ratio</label>
              <p className="text-white font-mono text-sm mt-1">{content.image_ratio}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Style</label>
              <p className="text-white text-sm mt-1 capitalize">{content.image_style}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Image Prompt */}
      <section className="bg-gray-900 rounded-xl border border-purple-800/50 p-5">
        <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wide mb-3">🎨 Engineered Image Prompt</h2>
        <div className="bg-gray-950 rounded-lg p-4 text-sm text-gray-300 font-mono leading-relaxed border border-gray-800">
          {content.image_prompt}
        </div>
        <button onClick={generateImage} disabled={isGeneratingImage}
          className="mt-4 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
                     disabled:opacity-50 rounded-lg py-3 font-bold text-sm transition-all">
          {isGeneratingImage ? '🎨 Generating Image...' : '🖼️ Generate Image (Alibaba AI)'}
        </button>
      </section>

      {/* Generated Image */}
      {imageUrl && (
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-bold text-green-400 uppercase tracking-wide mb-3">✅ Generated Image</h2>
          <img src={imageUrl} alt="Generated creative" className="w-full rounded-lg" />
          <a href={imageUrl} download className="mt-3 block text-center text-sm text-purple-400 hover:underline">
            Download Image
          </a>
        </section>
      )}

      {/* Phase Detail Accordion */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">📊 Phase Details</h2>
        <div className="space-y-2">
          {phases.filter(p => p.status === 'pass' && p.output).map(phase => (
            <div key={phase.phaseNumber} className="border border-gray-800 rounded-lg overflow-hidden">
              <button onClick={() => setExpandedPhase(expandedPhase === phase.phaseNumber ? null : phase.phaseNumber)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-gray-800">
                <span>
                  <span className="text-green-400 mr-2">✅</span>
                  Phase {phase.phaseNumber}: {phase.phaseName}
                </span>
                <span className="text-gray-500">{expandedPhase === phase.phaseNumber ? '▲' : '▼'}</span>
              </button>
              {expandedPhase === phase.phaseNumber && (
                <div className="px-4 pb-4 bg-gray-950">
                  <pre className="text-xs text-gray-400 overflow-auto max-h-60 mt-2">
                    {JSON.stringify(phase.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## FRONTEND — components/HistoryPanel.jsx

```jsx
import { useEffect, useState } from 'react';

export default function HistoryPanel() {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/history')
      .then(r => r.json())
      .then(setSessions);
  }, []);

  const viewSession = async (id) => {
    setSelected(id);
    const res = await fetch(`http://localhost:3001/api/history/${id}`);
    const data = await res.json();
    setLogs(data);
  };

  return (
    <div className="flex gap-4 h-full">
      <div className="w-72 space-y-2 overflow-y-auto">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Session History</h2>
        {sessions.map(s => (
          <div key={s.id} onClick={() => viewSession(s.id)}
            className={`rounded-lg p-3 cursor-pointer border transition-all ${
              selected === s.id ? 'border-purple-500 bg-purple-900/20' : 'border-gray-800 bg-gray-900 hover:border-gray-700'
            }`}>
            <p className="text-xs font-semibold text-white truncate">{s.topic || 'Untitled'}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.category} · {s.niche}</p>
            <p className="text-[10px] text-gray-600 mt-1">{new Date(s.created_at).toLocaleString()}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block ${
              s.status === 'completed' ? 'bg-green-900 text-green-300' :
              s.status === 'failed' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
            }`}>{s.status}</span>
          </div>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {selected && logs.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-400">Phase Logs for Session #{selected}</h3>
            {logs.map(log => (
              <div key={log.id} className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Phase {log.phase_number}: {log.phase_name}</span>
                  <span className={log.status === 'pass' ? 'text-green-400 text-xs' : 'text-red-400 text-xs'}>
                    {log.status.toUpperCase()}
                  </span>
                </div>
                <pre className="text-xs text-gray-400 overflow-auto max-h-40">
                  {log.output_data}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            Select a session to view phase logs
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## BACKEND — routes/history.js

```javascript
import express from 'express';
import { getAllSessions, getSessionLogs } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getAllSessions());
});

router.get('/:id', (req, res) => {
  res.json(getSessionLogs(req.params.id));
});

export default router;
```

---

## BACKEND — routes/image.js (Alibaba Image Generation)

```javascript
import express from 'express';
import { db } from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { prompt, sessionId, ratio } = req.body;

  // PLACEHOLDER: Replace with actual Alibaba Tongyi Wanxiang API call
  // API Docs: https://www.alibabacloud.com/help/en/model-studio/developer-reference/api-details
  // You need: ALIBABA_API_KEY in .env
  
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ALIBABA_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify({
        model: 'wanx2.1-t2i-turbo',
        input: { prompt },
        parameters: {
          size: ratio === '1:1' ? '1024*1024' :
                ratio === '4:5' ? '864*1080' :
                ratio === '16:9' ? '1280*720' : '1024*1024',
          n: 1,
          style: '<auto>'
        }
      })
    });

    const data = await response.json();
    
    // Alibaba returns async — poll for result
    const taskId = data.output?.task_id;
    if (!taskId) return res.status(500).json({ error: 'No task ID from Alibaba' });

    // Poll until done
    let imageUrl = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await fetch(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        { headers: { 'Authorization': `Bearer ${process.env.ALIBABA_API_KEY}` } }
      );
      const pollData = await poll.json();
      if (pollData.output?.task_status === 'SUCCEEDED') {
        imageUrl = pollData.output?.results?.[0]?.url;
        break;
      }
      if (pollData.output?.task_status === 'FAILED') break;
    }

    if (imageUrl) {
      db.prepare('UPDATE sessions SET image_url=? WHERE id=?').run(imageUrl, sessionId);
      res.json({ image_url: imageUrl });
    } else {
      res.status(500).json({ error: 'Image generation timed out or failed' });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

---

## ENVIRONMENT VARIABLES (.env)

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ALIBABA_API_KEY=your_alibaba_dashscope_api_key_here
PORT=3001
```

---

## PACKAGE.JSON (root)

```json
{
  "name": "ai-social-creative-engine",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "backend": "node backend/server.js",
    "frontend": "cd frontend && npm run dev",
    "dev": "concurrently \"npm run backend\" \"npm run frontend\""
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "better-sqlite3": "^9.4.3",
    "concurrently": "^8.2.0",
    "cors": "^2.8.5",
    "express": "^4.18.0"
  }
}
```

---

## SETUP INSTRUCTIONS FOR HAIKU

Tell Haiku to follow these steps in order:

```
1. Create project structure exactly as shown in PROJECT STRUCTURE
2. Install dependencies: npm install
3. For frontend: cd frontend && npm create vite@latest . -- --template react && npm install tailwindcss @tailwindcss/vite
4. Copy every file exactly as defined in this spec
5. Create .env with both API keys
6. Run: npm run dev
7. Backend runs on port 3001, frontend on port 5173
```

---

## KEY SYSTEM RULES FOR HAIKU TO ENFORCE

1. **Pipeline is sequential** — no phase runs until the previous completes
2. **Phase 0 generates content first** — post, headline, hashtags come before image analysis
3. **Phase 18 validation** can trigger a Phase 17 rebuild and re-run validation once
4. **Every phase result is stored** in SQLite `phase_logs` table
5. **SSE streaming** — frontend receives live updates, not batch at the end
6. **Image generation** is manual — user clicks button after seeing the engineered prompt
7. **No phase is skipped** — all 19 phases + Phase 0 must run every time
8. **Claude Sonnet** (`claude-sonnet-4-20250514`) is used for all AI calls
9. **All AI responses are JSON** — every system prompt demands JSON-only output
10. **Scores displayed in log** — Phase 18 validation scores are shown per-check in the sidebar

---

## SUMMARY OF WHAT THE APP DOES

```
User Input (tone + niche + category + topic)
    ↓
Phase 0: Claude generates post_content + headline + hashtags + ratio + style
    ↓
Phase 1–3: Normalize → Marketing Strategy → Customer Psychology
    ↓
Phase 4–5: Visual Entities + Product Detection
    ↓
Phase 6–7: Color Psychology + Style Engine
    ↓
Phase 8: Hero Object Selection (ONE object only)
    ↓
Phase 9–10: Layout Grid + Visual Hierarchy
    ↓
Phase 11–13: Headline Optimization + Benefits/Icons + CTA
    ↓
Phase 14–15: Depth Layers + Whitespace Balance
    ↓
Phase 16–17: Platform Optimization + Visual Story Scene
    ↓
Phase 18: Validation (8 checks, all must score 75+)
    ↓ (rebuild if fail)
Phase 19: Final Engineered Prompt Architecture
    ↓
Display: Post Content + Headline + Hashtags + Image Prompt
    ↓ (user clicks button)
Alibaba API: Image Generation → Display Image
```
