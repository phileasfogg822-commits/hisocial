# Complete Alibaba API Image Generation Integration Guide

## Overview
This guide walks you through integrating Alibaba's Wan2.7 image generation API into your sosocial app for AI-powered image generation in Auto Pilot mode.

---

## Phase 1: Prerequisites & Setup

### 1.1 Get Alibaba API Key
1. Visit: https://www.alibabacloud.com/help/en/model-studio/get-api-key
2. Create/log into Alibaba Cloud account
3. Generate an API key (format: `sk-xxxx...`)
4. Choose your region (Singapore or Beijing) - **Note: Each region has separate API keys and endpoints**
5. Copy the API key

### 1.2 Understand API Basics

**Model Options:**
- `wan2.7-image-pro`: Supports 4K output for text-to-image (slower, higher quality)
- `wan2.7-image`: Faster generation, lower cost

**Regions & Endpoints:**
- **Singapore**: `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- **Beijing**: `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`

**Supported Image Sizes:**
- 1024×1024 (standard)
- 1024×2048, 2048×1024 (wide formats)
- 2K resolution (2048×2048)
- 4K resolution (only for text-to-image with `wan2.7-image-pro`)

**Image URL Validity:**
- Generated image URLs are valid for **24 hours only**
- Must download/save promptly

---

## Phase 2: Backend Configuration

### 2.1 Set Environment Variable

Add your Alibaba API key to your `.env` file (or docker-compose environment):

```bash
# For Singapore region
ALIBABA_DASHSCOPE_API_KEY=sk-your_api_key_here
ALIBABA_REGION=singapore

# OR for Beijing region (uncomment if using Beijing)
# ALIBABA_REGION=beijing
```

**Note**: The `ALIBABA_REGION` determines which endpoint is used.

### 2.2 Implement Backend Support

The backend code has been updated with Alibaba support. The changes include:

1. **Updated `autoPilotWorker.js`**:
   - Added Alibaba provider to `pickImageProvider()` function
   - Implemented `generateImage()` for Alibaba provider
   - Properly handles API response and error handling

2. **How it works**:
   - Sends POST request to Alibaba API with your prompt
   - Receives image URL immediately (synchronous call)
   - Returns URL for use in posts and templates

### 2.3 Update docker-compose.yml

If using Docker, add to your `backend` service environment:

```yaml
services:
  backend:
    environment:
      - ALIBABA_DASHSCOPE_API_KEY=sk-your_api_key_here
      - ALIBABA_REGION=singapore
```

---

## Phase 3: How the Integration Works

### Request Flow

```
User selects "alibaba" as image_provider in Auto Pilot settings
        ↓
Auto Pilot generates text content
        ↓
`generateImage('alibaba', prompt)` called
        ↓
Prompt sent to Alibaba API
        ↓
Alibaba returns generated image URL
        ↓
Image URL applied to post (can add template overlay)
        ↓
Post scheduled/published with generated image
```

### API Request Example

```json
{
  "model": "wan2.7-image-pro",
  "input": {
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "text": "A beautiful modern office workspace with plants and natural light, professional atmosphere, high quality photography"
          }
        ]
      }
    ]
  },
  "parameters": {
    "size": "1024x1024",
    "n": 1,
    "watermark": false
  }
}
```

### API Response Example

```json
{
  "output": {
    "choices": [
      {
        "finish_reason": "stop",
        "message": {
          "content": [
            {
              "image": "https://dashscope-xxx.oss-xxx.aliyuncs.com/xxx.png?Expires=xxx",
              "type": "image"
            }
          ],
          "role": "assistant"
        }
      }
    ],
    "finished": true
  },
  "usage": {
    "image_count": 1,
    "size": "1024*1024",
    "total_tokens": 123
  },
  "request_id": "unique-request-id"
}
```

---

## Phase 4: Frontend Configuration

### 4.1 Update Frontend Settings

The app's Auto Pilot settings UI will automatically show "Alibaba" as an image provider option once the backend detects the API key.

**Steps:**
1. Go to App Settings → Auto Pilot
2. Enable Auto Pilot
3. Select Image Provider → Choose "Alibaba"
4. Configure other settings (topic, niche, category, tone, etc.)
5. Save settings

### 4.2 Frontend Code Updates

The frontend `App.js` will automatically detect Alibaba as an available provider through the backend's provider detection.

---

## Phase 5: Testing

### 5.1 Manual Testing

**Via API:**
```bash
curl -X POST http://localhost:4000/api/autopilot/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{
    "enabled": true,
    "topic": "sustainable technology",
    "image_provider": "alibaba",
    "text_provider": "openai",
    "platforms": ["instagram", "linkedin"],
    "posts_per_day": 1,
    "tone": "professional"
  }'
```

### 5.2 Testing Image Generation Directly

```bash
# Run the autopilot worker for one post
curl -X POST http://localhost:4000/api/autopilot/run \
  -H "Authorization: Bearer your_jwt_token"
```

### 5.3 Expected Outcomes

✅ Post created with Alibaba-generated image
✅ Image URL from Alibaba stored in post
✅ Image displays correctly in Calendar/Library
✅ Image publishes to connected platforms

---

## Phase 6: Production Deployment

### 6.1 Environment Setup

```bash
# Production .env
ALIBABA_DASHSCOPE_API_KEY=sk-production_key_here
ALIBABA_REGION=singapore
```

### 6.2 Docker Deployment

```bash
# Build and run with Alibaba support
docker-compose up -d

# Verify backend is running
curl http://localhost:4000/api/health
```

### 6.3 Monitoring

Check logs for Alibaba API calls:
```bash
docker logs backend | grep -i alibaba
```

Expected log output:
```
[AutoPilot] Generating image with provider: alibaba
[AutoPilot] Image generated: https://dashscope-xxx.oss-xxx.aliyuncs.com/xxx.png
```

---

## Phase 7: Troubleshooting

### Issue: "No image provider configured"

**Cause**: `ALIBABA_DASHSCOPE_API_KEY` not set or invalid

**Solution**:
1. Verify key is in `.env`: `echo $ALIBABA_DASHSCOPE_API_KEY`
2. Ensure key format: starts with `sk-`
3. Restart backend: `docker-compose restart backend`

### Issue: "401 Unauthorized from Alibaba"

**Cause**: Invalid API key or region mismatch

**Solution**:
1. Verify API key is correct
2. Check region matches: Singapore key with Singapore endpoint
3. Test key with Alibaba directly

### Issue: "Image generation timed out"

**Cause**: Alibaba API is slow or overloaded

**Solution**:
1. Alibaba can take 2-5 seconds per image
2. Increase timeout in code if needed
3. Try `wan2.7-image` instead of `wan2.7-image-pro` (faster)

### Issue: "Generated URLs expire before saving"

**Cause**: URLs are only valid for 24 hours

**Solution**:
1. Download images immediately after generation
2. Don't rely on temporary URLs for long-term storage
3. Backend automatically saves to local `/uploads/` directory

### Debug: Check Available Providers

The backend logs available providers on startup:
```
Available image providers: deapi, bigmodel, openai, alibaba
```

If `alibaba` doesn't appear, the API key isn't configured.

---

## Phase 8: Advanced Configuration

### 8.1 Regional Deployment

**For Beijing Users:**
```bash
ALIBABA_DASHSCOPE_API_KEY=sk-beijing_key_here
ALIBABA_REGION=beijing
```

### 8.2 Model Selection

Currently using: `wan2.7-image-pro` (high quality, 4K capable)

To use faster model, modify in `autoPilotWorker.js`:
```javascript
// Change from:
model: "wan2.7-image-pro"

// To:
model: "wan2.7-image"  // Faster, lower cost
```

### 8.3 Image Size Configuration

Current default: `1024x1024`

To change, modify in `generateImage()`:
```javascript
const size = '1024x1024';  // Change to '2048x2048' or other sizes
```

---

## Phase 9: Cost & Quotas

### Pricing
- Check: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Image generation is billed per image (not per token)
- Typical cost: $0.01-0.05 per image depending on resolution

### Free Quota
- New users get free quota for testing
- Check Alibaba Console for current quota

### Rate Limiting
- Standard rate limits apply (varies by account tier)
- If rate-limited (429), backend automatically retries
- With multiple providers, can fallback to others

---

## Phase 10: Monitoring & Optimization

### 10.1 Logging

All Alibaba calls logged with format:
```
[AutoPilot] alibaba image generation: prompt="...", status=200
```

### 10.2 Performance Tips

1. **Use `wan2.7-image` for speed**: Faster generation, lower cost
2. **Batch posts**: Generate multiple posts to amortize API latency
3. **Monitor quota**: Set alerts for quota usage
4. **Fallback providers**: Configure multiple providers for reliability

### 10.3 Fallback Strategy

If Alibaba fails:
1. Backend automatically retries up to 3 times
2. If still failing, falls back to next configured provider
3. If all providers fail, posts saved without image

---

## FAQ

**Q: Can I use both Alibaba and OpenAI at the same time?**
A: Yes! Alibaba and OpenAI can coexist. Configure both API keys and switch between them in Auto Pilot settings.

**Q: What happens if the image URL expires?**
A: The image is saved locally in `/uploads/pple/` or `/uploads/` before URL expires, so no data loss.

**Q: Can I generate multiple images at once?**
A: Currently generates 1 image per post. Multiple image support can be added in future versions.

**Q: Which region should I use?**
A: Use the region closest to you (Singapore or Beijing) for best latency. Each region needs its own API key.

**Q: Can I use Alibaba for image editing?**
A: Current integration supports text-to-image only. Image editing can be added in future updates.

---

## Support & Resources

- **Alibaba API Docs**: https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
- **Get API Key**: https://www.alibabacloud.com/help/en/model-studio/get-api-key
- **Error Codes**: https://www.alibabacloud.com/help/en/model-studio/error-code
- **Pricing**: https://www.alibabacloud.com/help/en/model-studio/model-pricing

---

## Summary

You now have a complete integration of Alibaba's Wan2.7 image generation API in your sosocial app! 

✅ Set environment variables
✅ Configure in Auto Pilot settings
✅ Generate beautiful images automatically
✅ Scale your content with AI

Happy posting! 🚀
