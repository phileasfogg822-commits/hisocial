# AI Creative Engine - Quick Setup Checklist

## Prerequisites
- [ ] Backend running (Node.js + Express)
- [ ] PostgreSQL database configured
- [ ] Anthropic API key obtained (https://console.anthropic.com)

## Backend Setup (5 minutes)

### 1. Install Dependencies
```bash
cd backend
npm install @anthropic-ai/sdk@^0.24.0
```

### 2. Run Database Migration
```bash
# Option A: Using psql directly
psql $DATABASE_URL < migrations/create_ai_engine_tables.sql

# Option B: Manual SQL
# Execute the SQL from backend/migrations/create_ai_engine_tables.sql in your database client
```

### 3. Update Environment Variables
In your `.env` file, ensure:
```env
ANTHROPIC_API_KEY=sk-ant-...your-key...
DATABASE_URL=postgresql://user:pass@localhost:5432/socialhub
PORT=4000
NODE_ENV=development
```

### 4. Restart Backend
```bash
# If using Docker
docker compose up -d backend

# If using Node directly
npm run dev
```

## Frontend Setup (2 minutes)

### 1. Verify Components Exist
All components are pre-created in `frontend/src/components/`:
- [ ] `ComposeAI.jsx`
- [ ] `AIInput.jsx`
- [ ] `AIPipelineLog.jsx`
- [ ] `AIOutput.jsx`
- [ ] `AIHistory.jsx`

### 2. Verify Integration
Check `frontend/src/App.js`:
- [ ] `import ComposeAI` is present at top
- [ ] `✨ AI Engine` tab button added to Compose view
- [ ] `studioTab === 'ai' ? <ComposeAI API={API} />` conditional added

### 3. No Additional Setup Needed
React components are already imported and integrated!

## Testing (10 minutes)

### 1. Start Application
```bash
# From project root
docker compose up -d
# OR
npm run dev
```

### 2. Navigate to Compose
- Go to http://localhost:3000 (or your frontend URL)
- Click **Compose** in sidebar
- You should see three tabs: **Compose**, **AI Workflow**, **✨ AI Engine**

### 3. Test AI Engine
1. Click **✨ AI Engine** tab
2. Fill in test inputs:
   - Tone: `professional`
   - Niche: `sustainable gardening`
   - Category: `biodegradable pots`
   - Topic: `New eco-friendly pots for urban gardeners`
3. Click **🚀 Run Creative Engine**
4. Watch phases execute (should take 10-20 seconds)
5. See generated content, headlines, hashtags, and image prompt

### 4. Check History
1. Click **History** tab
2. You should see your test session listed
3. Click on it to view full details

## Verification Checklist

### Backend Endpoints (Test with curl)
```bash
# Create a test session (requires authentication)
curl -X POST http://localhost:4000/api/ai/creative/generate \
  -H "Content-Type: application/json" \
  -d '{
    "tone": "professional",
    "niche": "tech",
    "category": "SaaS",
    "topic": "New productivity tool"
  }'

# Get history
curl http://localhost:4000/api/ai/creative/history

# Get specific session
curl http://localhost:4000/api/ai/creative/1
```

### Database Tables
```sql
-- Verify tables exist
\dt ai_*

-- Check session count
SELECT COUNT(*) FROM ai_creative_sessions;

-- Check phase logs
SELECT COUNT(*) FROM ai_phase_logs;

-- Check generated content
SELECT COUNT(*) FROM ai_generated_content;
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "ANTHROPIC_API_KEY is missing" | Add key to `.env` and restart backend |
| "Cannot find module '@anthropic-ai/sdk'" | Run `npm install @anthropic-ai/sdk` in backend folder |
| "SequelizeDatabaseError: relation 'ai_creative_sessions' does not exist" | Run database migration SQL |
| "Missing ComposeAI component" | Verify all 5 component files are in `frontend/src/components/` |
| "Tab doesn't show up" | Clear browser cache (Ctrl+Shift+Delete) and refresh |
| "Pipeline runs but shows errors" | Check backend logs: `docker logs socialhub-backend` |
| "Validation keeps failing" | Normal behavior - system auto-rebuilds scene and retries |

## Performance Expectations

| Metric | Expected Value |
|--------|-----------------|
| Time to first phase | 2-3 seconds |
| Per phase duration | 0.5-2 seconds |
| Total pipeline time | 10-20 seconds |
| Database query latency | <100ms |
| SSE stream latency | Real-time (<500ms) |

## Next Steps

1. ✅ Complete setup above
2. 📝 Review the full documentation in [AI_CREATIVE_ENGINE_INTEGRATION.md](AI_CREATIVE_ENGINE_INTEGRATION.md)
3. 🚀 Start using the AI Engine in Compose
4. 💾 View your session history anytime
5. 🎨 Copy image prompts for Alibaba or other image generators

## Support Resources

- **API Documentation**: See `AI_CREATIVE_ENGINE_INTEGRATION.md`
- **System Specification**: See `AI_Social_Creative_Engine_SYSTEM_SPEC.md`
- **Backend Code**: `backend/src/services/aiCreativeEngine.js`
- **Backend Routes**: `backend/src/routes/aiCreative.js`
- **Frontend Code**: `frontend/src/components/ComposeAI.jsx`

---

**Setup Time**: ~7 minutes (if all prerequisites met)
**Go Live**: You're ready to generate amazing creative content!
