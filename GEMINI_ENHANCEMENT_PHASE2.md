# AI SOCIAL CREATIVE ENGINE v2.0 - GEMINI ENHANCEMENT PHASE 2

## Overview

Phase 2 adds Gemini AI thinking layer to the most critical decision agents:
- **Agent 2**: Marketing Strategy (better offer extraction)
- **Agent 3**: Customer Psychology (deeper psychological insights)  
- **Agent 6**: Visual Story (more creative narratives)
- **Agent 11**: Prompt Refinement (smarter prompt engineering)

Remaining agents (1,4,5,7,8,9,10) continue using fast rule-based logic.

## Architecture

### Request Flow with Gemini

```
Client Request
  ↓
Router Detects: enhanceWithGemini=true
  ↓
executeWithGeminiThinking() [NEW]
  ├─ Agent 1: Normalize Input (rule-based)
  ├─ Agent 2: Marketing Strategy → Gemini Enhancement
  ├─ Agent 3: Psychology Analysis → Gemini Enhancement
  ├─ Agent 4-5: Basic Detection (rule-based)
  ├─ Agent 6: Visual Story → Gemini Enhancement
  ├─ Agent 7-9: Layout & Optimization (rule-based)
  ├─ Agent 10: Validation (CRITICAL - gates output)
  ├─ Agent 11: Prompt → Gemini Refinement
  └─ Response with Engine Metadata
```

### Two Implementation Modes

#### Mode 1: Automatic (Default)
```javascript
// V2 Engine runs ONLY rule-based agents
// No Gemini overhead, fast response (~2-3 seconds)
POST /api/ai/image {
  tone: "professional",
  category: "restaurant",
  heading: "Best Pasta in Town",
  topic: "Italian Restaurant",
  // ... other fields
  // enhanceWithGemini: false (default)
}
```

#### Mode 2: Gemini-Enhanced (Phase 2)
```javascript
// Specific agents use Gemini for deeper thinking
// Slower response (~8-15 seconds with 4 Gemini calls)
// Higher quality decisions
POST /api/ai/image {
  tone: "professional",
  category: "restaurant",
  heading: "Best Pasta in Town",
  topic: "Italian Restaurant",
  // ... other fields
  enhanceWithGemini: true  // ← Enable Gemini enhancement
}
```

## API Changes

### New Request Parameter

```javascript
{
  enhanceWithGemini: boolean,  // NEW - defaults to false
  // ... existing 9 V2 engine parameters
}
```

### Response Changes (When Gemini Used)

```javascript
{
  status: "success",
  url: "https://...",
  validation: { ... },
  engine: {
    status: "success",
    recommendation: "APPROVED_FOR_RENDERING",
    validation: { ... },
    decisions: { ... }
  },
  enhanced: {
    thinking_layer: "Gemini-powered",
    agents_enhanced: [2, 3, 6, 11],
    timestamp: "2024-..."
  }
}
```

## Testing the Integration

### Prerequisites

1. **Gemini API Key**: Must be set in environment
   ```bash
   GEMINI_API_KEY=your-actual-api-key
   ```

2. **Backend Running**: 
   ```bash
   docker compose up -d backend
   ```

3. **Authentication**: Include valid session/auth headers

### Test 1: Basic Gemini Enhancement

```bash
# Test with Gemini thinking layer enabled
curl -X POST http://localhost:4000/api/ai/image \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_id" \
  -d '{
    "tone": "professional",
    "category": "restaurant",
    "niche": "Italian Restaurant",
    "heading": "Best Pasta in Town",
    "topic": "Homemade Italian Pasta",
    "post_text": "Our pasta is made fresh daily with authentic Italian recipes...",
    "hashtags": ["#pasta", "#italian", "#restaurant"],
    "ratio": "1:1",
    "style": "realistic",
    "useEngine": true,
    "enhanceWithGemini": true
  }'
```

### Test 2: Comparison (Rule-Based vs Gemini)

```bash
# Get rule-based decision
curl -X POST http://localhost:4000/api/ai/image \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_id" \
  -d '{
    "tone": "professional",
    "category": "restaurant",
    "niche": "Italian Restaurant",
    "heading": "Best Pasta in Town",
    "topic": "Homemade Italian Pasta",
    "post_text": "Our pasta is made fresh daily...",
    "hashtags": ["#pasta"],
    "ratio": "1:1",
    "useEngine": true,
    "enhanceWithGemini": false
  }'

# Get Gemini-enhanced decision (same params, different enhancement)
# ... same request with "enhanceWithGemini": true
```

### Test 3: Validation Still Works

Even with Gemini, validation gates prevent bad decisions:

```bash
# Test with weak customer psychology (should still validate)
curl -X POST http://localhost:4000/api/ai/image \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_id" \
  -d '{
    "tone": "professional",
    "category": "website_builder",
    "niche": "Website Builder",
    "heading": "Create Your Website",
    "topic": "SaaS Website Builder",
    "post_text": "Build websites without coding...",
    "hashtags": ["#web", "#builder"],
    "ratio": "1:1",
    "useEngine": true,
    "enhanceWithGemini": true
  }'

# Response should still show validation status
# (might return REQUIRES_REFINEMENT if visual authenticity < 80)
```

## Performance Implications

### Response Times

| Mode | Time | Gemini Calls | Use Case |
|------|------|-------------|----------|
| Rule-Based | 2-3s | 0 | Fast iterations, A/B testing |
| Gemini-Enhanced | 8-15s | 4 | Final production creatives |
| Hybrid | 5-8s | 2 | Custom (select agents) |

### Cost Considerations

**Gemini Flash Pricing** (as of 2024):
- Input: ~$0.075 / 1M tokens
- Output: ~$0.30 / 1M tokens

**Per-Request Cost (4 Gemini calls)**:
- ~500 tokens input per call
- ~400 tokens output per call
- Total: 2K input + 1.6K output = ~$0.00062 per request

**Monthly Cost** (1000 images/day):
- 30,000 images × $0.00062 = ~$18.60/month

## Configuration

### Environment Variables

```bash
# .env or docker-compose.yml
GEMINI_API_KEY=your-actual-api-key-here

# Optional: control which agents to enhance
GEMINI_ENHANCE_MARKETING=true      # Agent 2
GEMINI_ENHANCE_PSYCHOLOGY=true     # Agent 3
GEMINI_ENHANCE_VISUAL_STORY=true   # Agent 6
GEMINI_ENHANCE_PROMPT=true         # Agent 11
```

### Fallback Behavior

- If Gemini API key not set: Uses rule-based engine automatically
- If Gemini API request fails: Falls back to rule-based for that agent
- If Gemini returns malformed response: Uses base logic and continues
- **NO BREAKING CHANGES**: System always works, Gemini is enhancement layer

## Advanced: Custom Agent Enhancement

To enhance additional agents with Gemini:

1. Create enhancement function in `aiSocialCreativeEngineV2Gemini.js`:
```javascript
async function enhanceYourAgent(input, baseResult) {
  const prompt = `Your Gemini prompt here...`;
  const response = await callGemini(prompt);
  // Parse and return enhanced result
}
```

2. Call it in `executeWithGeminiThinking()`:
```javascript
const enhancedResult = await enhanceYourAgent(input, baseResult);
```

3. Use in orchestration:
```javascript
const myData = await enhanceYourAgent(input, baseData);
```

## Quality Metrics

### What Improves with Gemini

✅ **Marketing Strategy**
- More nuanced offer extraction
- Better campaign type identification
- Strategic insights for copywriting

✅ **Customer Psychology**
- Deeper emotional understanding
- More specific pain points
- Better identity positioning

✅ **Visual Story**
- More creative narratives
- Better hero focus
- Stronger emotional arc

✅ **Prompt Engineering**
- Better sensory details
- Stronger visual descriptions
- Improved composition clarity

### What Stays Rule-Based (By Design)

✓ Input normalization - fast, deterministic
✓ Product type detection - heuristic-based
✓ Layout planning - fixed by ratio
✓ Hierarchy building - fixed 45/30/15/7/3
✓ Validation checks - threshold-based gates

## Troubleshooting

### Issue: Gemini Requests Timing Out
**Solution**: Increase timeout in `callGemini()` or reduce model size

### Issue: Parsing Errors in Gemini Response
**Solution**: Check response is valid JSON. Fallback uses base logic.

### Issue: Validation Still Failing with Gemini
**Solution**: This is CORRECT. Gemini enhances thinking but validation gates are independent.

### Issue: Cost Concerns
**Solution**: 
- Use rule-based mode by default (enhanceWithGemini: false)
- Only enable Gemini for final production creatives
- Cache results for similar inputs

## Next Steps

1. **Deploy and Monitor**
   - Track API response times
   - Monitor Gemini API usage/costs
   - Collect user feedback on decision quality

2. **A/B Testing Framework** (Phase 2.1)
   - Generate multiple prompt variants
   - Test with target audience
   - Track conversion metrics

3. **Performance Dashboard** (Phase 2.2)
   - Real-time metrics on decisions
   - Validation score trends
   - Cost tracking

4. **Learning System** (Phase 2.3)
   - Track what works in each category
   - Adjust agent thresholds dynamically
   - Auto-tune based on results
