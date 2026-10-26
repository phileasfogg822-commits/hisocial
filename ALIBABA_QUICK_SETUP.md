# Alibaba API Quick Setup Guide

## Step 1: Get Your API Key

1. Visit: **https://www.alibabacloud.com/help/en/model-studio/get-api-key**
2. Sign in to your Alibaba Cloud account (create one if needed)
3. Navigate to Model Studio → API Keys
4. Create a new API key
5. **Choose your region**: Singapore or Beijing (each has separate keys)
6. Copy the key (format: `sk-xxxxxxxxxxxx`)

## Step 2: Configure Environment Variables

### Option A: Docker Compose (Recommended)

Edit your `docker-compose.yml` and add to the `backend` service:

```yaml
services:
  backend:
    environment:
      # ... existing env vars ...
      ALIBABA_DASHSCOPE_API_KEY: sk-your_api_key_here
      ALIBABA_REGION: singapore    # or 'beijing'
```

Then rebuild and restart:
```bash
docker-compose down
docker-compose up -d backend
```

### Option B: .env File (Local Development)

Create or edit `.env` in the project root:

```bash
# Existing variables...
ALIBABA_DASHSCOPE_API_KEY=sk-your_api_key_here
ALIBABA_REGION=singapore
```

Restart backend:
```bash
npm restart  # or your start command
```

### Option C: System Environment Variables

```bash
export ALIBABA_DASHSCOPE_API_KEY=sk-your_api_key_here
export ALIBABA_REGION=singapore
npm start
```

## Step 3: Verify Configuration

Check if Alibaba is recognized by the backend:

**Via Frontend**: 
1. Go to Settings → Auto Pilot
2. Check the "Image Provider" dropdown
3. You should see "Alibaba Wan2.7 (singapore)" or "(beijing)"

**Via Terminal**:
```bash
# Check backend logs
docker logs backend | grep -i alibaba

# Expected output:
# [AutoPilot] Available image providers: alibaba, deapi, bigmodel, openai
```

**Via API**:
```bash
curl http://localhost:4000/api/ai/providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response should include:
# { "id": "alibaba", "name": "Alibaba Wan2.7 (singapore)", "hasImage": true, "hasText": false }
```

## Step 4: Configure Auto Pilot

1. Go to App → **Settings → Auto Pilot**
2. **Enable Auto Pilot** ✓
3. Fill in settings:
   - **Topic**: e.g., "sustainable technology" or "social media tips"
   - **Niche**: e.g., "Tech" or "Business"
   - **Category**: e.g., "technology" or "lifestyle"
   - **Tone**: e.g., "professional" or "casual"
   - **Posts Per Day**: 1-5
   - **Platforms**: Select Instagram, LinkedIn, Facebook, etc.
   - **Text Provider**: OpenAI, Gemini, BigModel, etc.
   - **Image Provider**: ← **Select "Alibaba Wan2.7 (singapore)"** ← 
   - **Template**: (optional) Select a PPLE template for overlay

4. Click **Save Config**

## Step 5: Test Image Generation

### Method 1: Manual Test (Simple)

1. Go to Settings → Auto Pilot
2. Click **"Run Now"** or **"Test"** button
3. Wait 2-5 seconds for image generation
4. Check your Calendar for newly generated posts with images

### Method 2: API Test (Advanced)

```bash
# Test single image generation
curl -X POST http://localhost:4000/api/autopilot/run \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Or trigger via config update
curl -X PUT http://localhost:4000/api/autopilot/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "topic": "artificial intelligence innovations",
    "image_provider": "alibaba",
    "text_provider": "openai",
    "platforms": ["instagram"],
    "posts_per_day": 1,
    "tone": "professional"
  }'
```

## Step 6: Monitor & Troubleshoot

### Check Backend Logs

```bash
# Watch real-time logs
docker logs -f backend

# Search for Alibaba-specific logs
docker logs backend | grep -i alibaba
```

**Expected logs when generating images:**
```
[AutoPilot] Generating image with provider: alibaba
[AutoPilot] Image URL: https://dashscope-xxx.oss-xxx.aliyuncs.com/xxx.png
[AutoPilot] Post created successfully
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| ❌ "No image provider configured" | Add `ALIBABA_DASHSCOPE_API_KEY` to env vars and restart |
| ❌ "401 Unauthorized" | Check API key is correct and not expired |
| ❌ "Image generation timed out" | Alibaba can take 2-5s; increase timeout or use `wan2.7-image` model |
| ❌ "Region mismatch error" | Ensure ALIBABA_REGION matches your API key region |
| ❌ "No such provider: alibaba" | Restart backend after adding env vars |

## Step 7: Region Selection

### Singapore (Recommended for most users)
- **Endpoint**: `dashscope-intl.aliyuncs.com`
- **Region env var**: `singapore`
- **Latency**: Good for most regions
- **Availability**: International users

### Beijing (For China-based users)
- **Endpoint**: `dashscope.aliyuncs.com`
- **Region env var**: `beijing`
- **Latency**: Best for China
- **Availability**: Mainland China

⚠️ **Important**: Each region has **separate API keys** and endpoints. Don't mix them!

## Step 8: Image Generation Details

### What Gets Generated

When you run Auto Pilot with Alibaba:
1. ✅ Text content generated (via OpenAI, Gemini, etc.)
2. ✅ Image prompt created from text content
3. ✅ Image generated via Alibaba API (1024×1024)
4. ✅ Image URL saved in post
5. ✅ Post scheduled/published with image
6. ✅ Image URL valid for 24 hours (backend caches it)

### Image Details
- **Model**: `wan2.7-image-pro` (high quality)
- **Resolution**: 1024×1024 (can be customized)
- **Format**: PNG
- **URL Validity**: 24 hours
- **File Size**: ~500KB average

### Customization (Advanced)

To change image model or size, edit [backend/src/services/autoPilotWorker.js](backend/src/services/autoPilotWorker.js#L370):

```javascript
// Line ~370, in generateImage() function for Alibaba provider:

// Change model (for faster generation):
model: 'wan2.7-image'  // Instead of 'wan2.7-image-pro'

// Change size (options: 1024x1024, 2048x2048, 1024x2048, 2048x1024):
size: '2048x2048'  // Instead of '1024x1024'
```

## Step 9: Cost & Billing

- **Pricing**: ~$0.01-0.05 per image (varies by resolution)
- **Check billing**: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- **Free quota**: New users get free quota for testing
- **Billing based on**: Number of images generated (successful calls only)

## Step 10: Support & Resources

- 📖 **Alibaba API Docs**: https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
- 🔑 **Get API Key**: https://www.alibabacloud.com/help/en/model-studio/get-api-key
- ⚠️ **Error Codes**: https://www.alibabacloud.com/help/en/model-studio/error-code
- 💰 **Pricing**: https://www.alibabacloud.com/help/en/model-studio/model-pricing

---

## Example: Full Setup

### Complete docker-compose snippet:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      # ... existing database/auth variables ...
      OPENAI_API_KEY: sk-proj-xxxxx  # For text generation
      ALIBABA_DASHSCOPE_API_KEY: sk-xxxxx  # For image generation
      ALIBABA_REGION: singapore
      PUBLIC_BACKEND_URL: http://localhost:4000  # For Instagram uploads
    depends_on:
      - db
    volumes:
      - ./backend/uploads:/app/uploads

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:4000

  db:
    image: postgres:15
    # ... database config ...
```

### Minimal environment variables needed:

```bash
# At minimum for Alibaba image generation:
ALIBABA_DASHSCOPE_API_KEY=sk-your_key
ALIBABA_REGION=singapore

# Plus one text provider (for Auto Pilot content):
OPENAI_API_KEY=sk-proj-your_key
# OR
GEMINI_API_KEY=gsk-your_key
# OR
BIGMODEL_API_KEY=sk-your_key
```

---

You're all set! 🚀

Now your sosocial app can generate **stunning AI images using Alibaba's Wan2.7 model** in Auto Pilot mode!

Questions? Check the full guide: [ALIBABA_API_INTEGRATION_GUIDE.md](ALIBABA_API_INTEGRATION_GUIDE.md)
