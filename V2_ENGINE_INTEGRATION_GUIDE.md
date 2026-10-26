# AI SOCIAL CREATIVE ENGINE v2.0 - INTEGRATION GUIDE

## ✅ DEPLOYMENT STATUS

**All Systems Ready for Production**

- ✅ Backend: Running on port 4000
- ✅ Frontend: Running on port 3000  
- ✅ 11-Agent Engine: Fully integrated
- ✅ 8-Point Validation: Active
- ✅ Category Library: Deployed
- ✅ Test Suite: Passing

---

## 🚀 NEW API ENDPOINT: `/api/ai/image`

### PATH 1: LEGACY MODE (Direct Prompt)

**Use this if you want to provide a pre-written prompt**

```bash
POST /api/ai/image
Content-Type: application/json
Authorization: Bearer {user_token}

{
  "prompt": "A biodegradable pot with healthy green plants in a bright garden...",
  "style": "realistic",
  "aspect_ratio": "1:1",
  "provider": "alibaba"
}
```

**Response**:
```json
{
  "url": "https://image-url...",
  "revised_prompt": "...",
  "provider": "alibaba"
}
```

---

### PATH 2: V2.0 ENGINE MODE (Strategic Decision Making)

**Use this for full 11-agent orchestration with validation**

```bash
POST /api/ai/image
Content-Type: application/json
Authorization: Bearer {user_token}

{
  "useEngine": true,
  "tone": "eco-conscious",
  "niche": "sustainable gardening",
  "category": "biodegradable pots",
  "topic": "Unearth a greener option for your garden",
  "post_text": "Introducing our new biodegradable pots made from sustainable materials. Perfect for eco-friendly gardeners who care about the planet. First 50 customers get 25% OFF!",
  "heading": "Unearth a Greener Option",
  "hashtags": ["#SustainableGardening", "#EcoFriendly", "#NewProduct"],
  "ratio": "1:1",
  "style": "modern",
  "provider": "alibaba"
}
```

**Response on Success** (APPROVED_FOR_RENDERING):
```json
{
  "url": "https://image-url...",
  "revised_prompt": "Full orchestrated prompt...",
  "provider": "alibaba",
  "engine": {
    "status": "success",
    "recommendation": "APPROVED_FOR_RENDERING",
    "validation": {
      "category_match": 85,
      "product_match": 90,
      "visual_authenticity": 100,
      "product_visibility": 75,
      "clarity": 90,
      "brand_relevance": 85,
      "conversion_potential": 100
    },
    "decisions": {
      "hero": "biodegradable pots in use with healthy plants",
      "offer": "25% OFF",
      "target_audience": "gardening enthusiasts",
      "category": "biodegradable pots",
      "benefits": ["quality", "growth"],
      "style": "modern"
    }
  }
}
```

**Response on Validation Failure** (REQUIRES_REFINEMENT):
```json
{
  "error": "Design failed validation checks",
  "recommendation": "REQUIRES_REFINEMENT",
  "validation": {
    "passed": false,
    "scores": {
      "visual_authenticity": 75,
      "product_visibility": 60,
      "clarity": 80,
      "brand_relevance": 75,
      "conversion_potential": 70
    },
    "failed_checks": [
      "visual_authenticity: 75/100 (need 80)",
      "product_visibility: 60/100 (need 75)",
      "clarity: 80/100 (need 85)"
    ]
  }
}
```

---

## 🔧 PARAMETER REFERENCE

### Required for V2.0 Engine:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| tone | string | Customer emotional tone | "professional", "casual", "urgent" |
| category | string | Product/service category | "biodegradable pots", "website builder" |
| heading | string | Main headline (max 7 words) | "Unearth a Greener Option" |
| topic | string | Offer/main message | "Get your website in 1 day" |
| niche | string | Business niche | "sustainable gardening", "web development" |
| post_text | string | Full post content | "Complete marketing message..." |
| hashtags | array | Social hashtags | ["#EcoFriendly", "#NewProduct"] |
| ratio | string | Image aspect ratio | "1:1", "16:9", "9:16" |
| style | string | Design style | "minimal", "modern", "corporate", "premium" |

### Optional:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| useEngine | boolean | false | Enable V2.0 orchestration |
| provider | string | best-available | "alibaba", "deapi", "bigmodel", "openai" |
| style | string | "modern" | Visual style if not from engine |

---

## 📊 WHAT THE ENGINE DOES

```
INPUT (9 fields)
    ↓
Agent 1: Normalize Input
    ↓
Agent 2: Marketing Strategy Analysis
├─ Extract: business, offer, benefits, urgency
└─ Detect: campaign type, offer strength
    ↓
Agent 3: Customer Psychology Analysis
├─ Who: target audience
├─ What: what they want
├─ Why: motivation
├─ Fear: primary concern
├─ Desire: aspiration
└─ Identity: self-perception
    ↓
Agent 4: Category Expert
├─ Mandatory visuals (products must be identifiable)
├─ Optional visuals
└─ Forbidden visuals (avoid generic icons, abstract)
    ↓
Agent 5: Product Detection
├─ Type: physical | digital | service
└─ Rule: Physical products require 20-60% visibility
    ↓
Agent 6: Visual Story Architect
├─ Hero: one dominant visual (not features)
├─ Supporting: 2-3 context elements
├─ Environment: customer identity setting
├─ Emotion: feeling conveyed
└─ Action: what's happening
    ↓
Agent 7: Layout Planner
├─ Define: 6 zones with content rules
├─ 10% left/right margins
└─ Safe zones (no text)
    ↓
Agent 8: Hierarchy Builder
├─ Headline: 45% visual weight
├─ Hero: 30%
├─ Benefits: 15%
├─ CTA: 7%
└─ Hashtags: 3%
    ↓
Agent 9: Offer Optimizer
├─ Detect offer strength
├─ Badge requirements
└─ Visibility percentage
    ↓
Agent 10: VALIDATION GATES (8 Checks)
├─ Category Match ✓
├─ Product Match ✓
├─ Customer Match ✓
├─ Visual Authenticity (min 80) ✓
├─ Product Visibility (min 75) ✓
├─ Clarity (min 85) ✓
├─ Brand Relevance (min 80) ✓
└─ Conversion Potential (min 75) ✓
    ↓
Agent 11: Prompt Architect
└─ Generate structured prompt for Alibaba
    ↓
ALIBABA RENDERING
    ↓
OUTPUT (Photorealistic image + strategic decisions)
```

---

## 🎯 THE 11 AGENTS EXPLAINED

### Agent 1: Input Normalizer
- Standardizes 9 input fields into consistent format
- Converts hashtags to array
- Ensures all required fields present

### Agent 2: Marketing Strategist  
- Extracts business fundamentals
- Detects offer strength (HIGH/MEDIUM)
- Identifies campaign type (conversion/consideration/awareness/retention)
- Extracts benefits (max 4)
- Calculates urgency level

### Agent 3: Customer Psychology Analyzer
- **KEY INSIGHT**: Design for customer identity, NOT business specs
- Identifies target audience (who)
- Determines motivation (what/why)
- Discovers fears and desires
- Maps customer self-identity (the role they see themselves in)

### Agent 4: Category Expert
- Provides category-specific visual knowledge
- Lists mandatory visuals (must include)
- Lists optional visuals (can include)
- Lists forbidden visuals (avoid at all costs)
- Validates category recognition (2-second rule)

### Agent 5: Product Detection
- Determines product type (physical/digital/service)
- Enforces visibility rules
  - Physical: Must be hero (20-60% focus)
  - Digital: Can be supporting
  - Service: Focus on outcome, not tool

### Agent 6: Visual Story Architect
- **CORE PRINCIPLE**: Show outcome, not feature
- Selects ONE dominant hero (never abstract, never just icons)
- Builds supporting visual elements
- Creates environment reflecting customer identity
- Defines emotional tone
- Identifies key action moment

### Agent 7: Layout Planner
- Defines 6 content zones based on ratio
- Ensures safe zones for no text
- Enforces 10% left/right margins
- Creates grid for element positioning

### Agent 8: Hierarchy Builder
- Calculates visual weight distribution
- Ensures headline gets 45% focus
- Thumbnail test (100px shrink)
- Validates 2-second recognition

### Agent 9: Offer Optimizer
- Detects offer strength
- Determines if badge needed
- Sets visibility percentage
- Selects badge style

### Agent 10: Visual Validator (8-POINT CHECKS)
**This is the safety gate - validates before image generation**

1. **Category Match** - Looks like the right industry?
2. **Product Match** - Identifiable in 2 seconds?
3. **Customer Match** - Would target audience engage?
4. **Visual Authenticity** (min 80/100) - Photorealistic?
5. **Product Visibility** (min 75/100) - 20-60% focus?
6. **Clarity** (min 85/100) - Single message?
7. **Brand Relevance** (min 80/100) - Matches category?
8. **Conversion Potential** (min 75/100) - Drives action?

**If any check fails**: Returns REQUIRES_REFINEMENT (back to Agent 6)  
**If all pass**: Returns APPROVED_FOR_RENDERING (to image generator)

### Agent 11: Prompt Architect
- Generates structured prompt for Alibaba
- Includes all 11 strategic decisions
- Specifies quality requirements
- Defines composition rules
- Sets rendering instructions

---

## 🧪 TESTING THE INTEGRATION

### Quick Test (No Authentication)

```bash
# 1. Direct prompt mode (legacy)
curl -X POST http://localhost:4000/api/ai/image \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful biodegradable pot with healthy green plants in a bright garden",
    "style": "realistic",
    "provider": "alibaba"
  }'

# 2. V2.0 Engine mode
curl -X POST http://localhost:4000/api/ai/image \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "useEngine": true,
    "tone": "eco-conscious",
    "niche": "sustainable gardening",
    "category": "biodegradable pots",
    "topic": "Unearth a greener option",
    "heading": "Eco-Friendly Gardening",
    "post_text": "25% OFF for first 50 customers",
    "hashtags": ["#EcoFriendly", "#Sustainable"],
    "ratio": "1:1",
    "style": "modern",
    "provider": "alibaba"
  }'
```

---

## 📈 EXPECTED RESULTS

### Test Case 1: Biodegradable Pots ✅
```
Input:
  tone: eco-conscious
  category: biodegradable pots
  topic: Unearth a greener option

Output:
  recommendation: APPROVED_FOR_RENDERING
  validation scores:
    - visual_authenticity: 100/100
    - product_visibility: 75/100
    - clarity: 90/100
    - average: 92/100 ✅
```

### Test Case 2: Website Builder ⚠️
```
Input:
  tone: professional  
  category: website builder
  topic: Get your website in 1 day

Output:
  recommendation: REQUIRES_REFINEMENT
  failed_checks:
    - visual_authenticity: 75/100 (needs 80)
    - brand_relevance: 75/100 (needs 80)
  
Action: Refine visual story, resubmit
```

---

## 🔄 ERROR HANDLING

### Scenario 1: Validation Failed
```json
{
  "error": "Design failed validation checks",
  "recommendation": "REQUIRES_REFINEMENT",
  "failed_checks": [
    "clarity: 80/100 (need 85)",
    "product_visibility: 60/100 (need 75)"
  ]
}
```

**What to do**:
- Review failed check details
- Adjust input fields (simplify benefits, emphasize product)
- Resubmit request
- Engine will re-orchestrate with feedback

### Scenario 2: Missing Provider
```json
{
  "error": "No image generation provider configured",
  "details": "Add ALIBABA_DASHSCOPE_API_KEY to docker-compose.yml"
}
```

### Scenario 3: Invalid Input
```json
{
  "error": "Prompt is required (either provide 'prompt' directly or enable engine with tone, category, heading, topic)"
}
```

---

## 🎓 BEST PRACTICES

### DO ✅
- Provide specific category (not just "business")
- Include real post text (not placeholder)
- Use 1-3 clear benefits (not more)
- Keep heading to 3-7 words
- Match tone to target audience
- Use genuine hashtags

### DON'T ❌
- Use vague categories ("products", "services")
- Leave post_text empty
- List 10+ benefits
- Make heading too long
- Mix conflicting tones
- Use generic hashtags like #marketing

### Category-Specific Tips

**Restaurant**:
- Category: "premium cafe" or "fine dining"
- Focus: Food + ambiance
- Avoid: Kitchen tools, recipes

**Website Builder**:
- Category: "website builder" or "no-code platform"
- Focus: Happy business owner + beautiful website
- Avoid: Code, technical jargon, dashboard

**Biodegradable Products**:
- Category: "biodegradable pots" (specific!)
- Focus: Plants growing, eco-lifestyle
- Avoid: Plastic, waste, generic gardening

---

## 📊 MONITORING & ANALYTICS

### Metrics to Track

**Quality Metrics**:
- Validation approval rate (target 85%+)
- Average validation score (target 85+/100)
- Category recognition rate (target 100%)

**Performance Metrics**:
- Engine execution time: ~200-500ms
- Total pipeline time: ~2-5 seconds

**Business Metrics**:
- Image engagement rate
- Click-through rate on CTA
- Share rate
- Conversion rate

---

## 🚀 FUTURE ENHANCEMENTS

### Phase 2 (Next Sprint)
- [ ] Gemini API integration for enhanced thinking
- [ ] A/B testing framework (variant generation)
- [ ] Performance tracking dashboard
- [ ] Category-specific training data

### Phase 3 (Production+)
- [ ] Machine learning score adjustments
- [ ] Historical performance tracking
- [ ] Predictive scoring (before rendering)
- [ ] Platform-specific optimization (Instagram/Facebook/LinkedIn)

### Phase 4 (Learning System)
- [ ] Track which decisions correlate with success
- [ ] Adjust thresholds based on performance
- [ ] Industry-specific rule sets
- [ ] Continuous improvement loop

---

## 📚 FILES REFERENCE

### Core Engine Files
- `backend/src/services/aiSocialCreativeEngineV2.js` (520+ lines, 11 agents, 8-point validation)
- `backend/src/services/aiSocialCreativeEngineV2.test.js` (comprehensive test suite)
- `frontend/src/utils/aiSocialCreativeEngineV2.js` (React ES6 version, identical logic)

### Integration Files
- `backend/src/routes/ai.js` (updated /image endpoint)
- `AI_SOCIAL_CREATIVE_ENGINE_V2_DOCS.md` (complete philosophy & design)

### Docker Deployment
- `docker-compose.yml` (both services ready)
- `backend/Dockerfile` (Node.js with all dependencies)
- `frontend/Dockerfile` (React build ready)

---

## ✅ FINAL CHECKLIST

- [x] 11-Agent engine fully implemented
- [x] 8-point validation active
- [x] Category visual library deployed
- [x] Backend routes updated
- [x] Frontend utilities ready
- [x] Both services running
- [x] Tests passing
- [x] Documentation complete

---

## 🎉 YOU'RE READY TO GO!

**Backend**: http://localhost:4000  
**Frontend**: http://localhost:3000  
**API**: POST /api/ai/image with 9-field input for full orchestration

The engine is thinking strategically, validating decisions, and only then rendering images. This is the most important part of your app working perfectly.

**Next Step**: Test with your first creative brief! 🚀

---

**Version**: 2.0 - Multi-Agent Decision Architecture  
**Status**: ✅ Production Ready  
**Date**: June 4, 2026
