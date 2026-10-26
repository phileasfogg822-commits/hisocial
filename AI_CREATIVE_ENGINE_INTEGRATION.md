# AI Social Creative Engine Integration Guide

## Overview

The AI Social Creative Engine is now integrated into SocialHub as the **✨ AI Engine** tab in the Compose section. It provides a complete 19-phase AI pipeline that transforms user input (tone, niche, category, topic) into optimized social media content, headlines, hashtags, and engineered image prompts.

## Features

### Complete AI Pipeline (19 Phases)
1. **Phase 0**: Content Generation (Post + Headline + Hashtags)
2. **Phase 1**: Input Normalization
3. **Phase 2**: Content Decomposition & Marketing Strategy
4. **Phase 3**: Customer Psychology Analysis
5. **Phase 4**: Visual Entity Extraction & Category Expert
6. **Phase 5**: Product Detection & Visibility
7. **Phase 6**: Visual Psychology & Color Engine
8. **Phase 7**: Style Engine
9. **Phase 8**: Hero Object Selection
10. **Phase 9**: Layout Planning
11. **Phase 10**: Visual Hierarchy & Information Weight
12. **Phase 11**: Headline Optimization
13. **Phase 12**: Benefit Extraction & Icon Mapping
14. **Phase 13**: CTA Engine
15. **Phase 14**: Depth & Layer Engine
16. **Phase 15**: Whitespace & Balance Engine
17. **Phase 16**: Platform Optimization
18. **Phase 17**: Visual Story Architecture
19. **Phase 18**: Visual Validation (All Checks)
20. **Phase 19**: Final Prompt Architecture

### Key Capabilities
- **Real-time SSE Streaming**: Watch each phase execute with live updates
- **Validation Scoring**: Automatic quality checks with scoring (0-100)
- **Smart Rebuilds**: If validation fails, Phase 17 (Scene Rebuild) automatically retries
- **Session History**: Complete history of all creative sessions with phase logs
- **Database Storage**: All sessions, phases, and content stored in PostgreSQL

## Setup Instructions

### 1. Database Migration
Run the migration to create the required tables:

```bash
psql $DATABASE_URL < backend/migrations/create_ai_engine_tables.sql
```

Or manually execute the SQL in your database:
- `ai_creative_sessions` table
- `ai_phase_logs` table  
- `ai_generated_content` table

### 2. Backend Dependencies
Install the Anthropic SDK if not already installed:

```bash
cd backend
npm install @anthropic-ai/sdk@^0.24.0
```

### 3. Environment Variables
Ensure your `.env` file includes:

```env
ANTHROPIC_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 4. Frontend Components
The following components are now available:
- `ComposeAI.jsx` - Main compose interface
- `AIInput.jsx` - Input form
- `AIPipelineLog.jsx` - Phase progress viewer
- `AIOutput.jsx` - Results display
- `AIHistory.jsx` - Session history browser

## Usage

### Accessing the AI Engine
1. Navigate to **Compose** view
2. Click the **✨ AI Engine** tab
3. Fill in the input parameters:
   - **Tone**: Professional, Friendly, Urgent, Luxury, Playful, Inspirational, Educational, Casual
   - **Niche**: Your business/content niche (e.g., "sustainable gardening")
   - **Category**: Product/service category (e.g., "biodegradable pots")
   - **Topic**: Specific topic or subject matter

### Running the Pipeline
1. Click **"🚀 Run Creative Engine"** button
2. Watch the real-time pipeline execution:
   - Green checkmark (✅) = Phase passed
   - Hourglass (⏳) = Currently executing
   - Red X (❌) = Phase failed
   - Duration shown in milliseconds
3. Validation scores displayed for Phase 18

### Generated Output
After completion, you'll see:
- **📝 Generated Content**
  - Headline
  - Post content (150-250 words)
  - Hashtags
  - Image ratio and style

- **🎨 Engineered Image Prompt**
  - Full prompt optimized for image generation
  - Copy button for easy clipboard access
  - Detailed scene descriptions and styling rules

- **📊 Phase Details**
  - Expandable accordion for each phase
  - Full JSON output for transparency and debugging

### History & Management
1. Click the **History** tab to view previous sessions
2. Select any session to view:
   - Session details (tone, niche, category, topic)
   - Generated content
   - Phase execution logs
   - Timestamps and durations
3. Delete sessions you no longer need

## API Endpoints

### POST `/api/ai/creative/generate`
Starts the AI creative pipeline with SSE streaming.

**Request:**
```json
{
  "tone": "professional",
  "niche": "sustainable gardening",
  "category": "biodegradable pots",
  "topic": "New eco-friendly pots for urban gardeners"
}
```

**Response** (Server-Sent Events):
```
event: session
data: { "sessionId": 123 }

event: phase
data: { "phaseNumber": 0, "phaseName": "...", "status": "pass", ... }

event: phase
data: { "phaseNumber": 1, "phaseName": "...", "status": "pass", ... }

...

event: complete
data: { "result": { "content": { ... }, "allPhases": { ... } } }
```

### GET `/api/ai/creative/history`
Retrieve user's creative sessions.

**Response:**
```json
[
  {
    "id": 1,
    "created_at": "2024-06-04T10:30:00Z",
    "tone": "professional",
    "niche": "sustainable gardening",
    "category": "biodegradable pots",
    "topic": "...",
    "status": "completed",
    "post_content": "...",
    "headline": "...",
    "hashtags": "...",
    "image_prompt": "..."
  }
]
```

### GET `/api/ai/creative/:sessionId`
Get detailed information about a specific session.

**Response:**
```json
{
  "session": { ... },
  "phases": [
    {
      "id": 1,
      "phase_number": 0,
      "phase_name": "Content Generation",
      "status": "pass",
      "output_data": { ... },
      "duration_ms": 3250
    }
  ],
  "content": { ... }
}
```

### DELETE `/api/ai/creative/:sessionId`
Delete a specific session (cascades to all related data).

## System Architecture

### Backend Pipeline Flow
```
Input → Phase 0 (Content Gen) → Phase 1-19 (Processing) → Validation → Output
                                      ↓
                            Phase 18 (Validation)
                              ↓ (if fail)
                            Phase 17 (Rebuild) → Re-validate
```

### Database Schema
- `ai_creative_sessions`: Stores session metadata and final output
- `ai_phase_logs`: Stores detailed logs for each phase execution
- `ai_generated_content`: Stores the generated post content, headlines, and prompts

### SSE Streaming
The pipeline uses Server-Sent Events to stream real-time updates:
- Each phase sends a `phase` event with its execution details
- Validation scores are included in Phase 18 output
- Final `complete` event contains the full result

## Key Design Principles

### 1. Customer-First Design
- Always visualize customer outcomes, not business features
- Focus on customer psychology, fears, and desires

### 2. Visual Rules Enforcement
- One hero object only (no mixing laptop + phone + dashboard)
- 35-60% whitespace (professional designs)
- Max 3 colors, max 2 fonts, max 4 icons

### 3. Platform Optimization
- Instagram: Large headline, minimal text, strong hero
- LinkedIn: Corporate tone, more whitespace, data-driven
- Facebook: Clear CTA, friendly imagery

### 4. Quality Validation
All outputs pass through 8-point validation:
- Category match (90+ score)
- Product match (90+ score)
- Customer match (90+ score)
- Visual authenticity (80+ score)
- Product visibility (75+ score)
- Clarity (85+ score)
- Brand relevance (80+ score)
- Conversion potential (75+ score)

## Troubleshooting

### Pipeline Fails to Start
- Check `ANTHROPIC_API_KEY` is set correctly
- Verify database connection
- Check user is authenticated (`req.user?.id` exists)

### Validation Keeps Failing
- The system will auto-rebuild Scene (Phase 17) and retry validation
- If still failing after retry, review the validation notes
- Adjust input parameters (tone, niche, category, topic) and try again

### Missing Generated Content
- Ensure all four input fields are filled
- Check API logs for Claude API errors
- Verify `@anthropic-ai/sdk` is installed in backend

### Image Prompt Issues
- The prompt is auto-generated but fully editable
- You can manually refine it before image generation
- Copy button makes it easy to use elsewhere

## Model Details

**AI Model**: Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- Max tokens: 2,000 per request
- Cost: ~$0.003 per session (all phases combined)
- Latency: 8-15 seconds per session

## Future Enhancements

Potential additions:
- Integration with Alibaba image generation API
- Multi-language support
- A/B testing different prompts
- Analytics on generated content performance
- Custom validation rules per brand
- Batch processing multiple topics
- Template-based content variations

## Support

For issues or questions:
1. Check the phase logs in the History tab
2. Review the detailed phase outputs
3. Check server logs: `docker logs socialhub-backend`
4. Verify Anthropic API quota and rate limits

## References

- [Anthropic Claude API Documentation](https://docs.anthropic.com/en/api/getting-started)
- [System Specification](../AI_Social_Creative_Engine_SYSTEM_SPEC.md)
- [SocialHub Documentation](../README.md)
