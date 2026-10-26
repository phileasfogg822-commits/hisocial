# Alibaba API - Testing & Troubleshooting Guide

## Pre-Flight Checks

### 1. Verify API Key Format

```bash
# Your API key should look like this:
echo $ALIBABA_DASHSCOPE_API_KEY
# Output: sk-xxxxxxxxxxxxxxxxxxxx (length: 20+ chars starting with 'sk-')

# Should NOT start with 'your_':
if [[ $ALIBABA_DASHSCOPE_API_KEY == your_* ]]; then
  echo "ERROR: Placeholder API key detected!"
fi
```

### 2. Check Docker Environment

```bash
# Verify vars are set in container
docker exec backend env | grep -i alibaba

# Expected output:
# ALIBABA_DASHSCOPE_API_KEY=sk-xxxxx
# ALIBABA_REGION=singapore
```

### 3. Verify Backend Started Successfully

```bash
# Check backend is running
curl http://localhost:4000/api/health

# Expected response:
# { "status": "ok" }
```

---

## Step-by-Step Testing

### Test 1: Check Available Providers

```bash
# Get your JWT token first:
# (Replace with your actual token from app login)
export TOKEN="your_jwt_token_here"

# List all available AI providers
curl http://localhost:4000/api/ai/providers \
  -H "Authorization: Bearer $TOKEN"

# Expected response includes:
# [
#   {
#     "id": "alibaba",
#     "name": "Alibaba Wan2.7 (singapore)",
#     "hasImage": true,
#     "hasText": false
#   },
#   ... other providers ...
# ]
```

### Test 2: Direct Alibaba API Call

```bash
# Test Alibaba API directly (without app)
curl -X POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation \
  -H "Authorization: Bearer sk-your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "text": "A beautiful sunset over mountains"
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
  }'

# Expected response:
# {
#   "output": {
#     "choices": [
#       {
#         "message": {
#           "content": [
#             {
#               "image": "https://dashscope-xxx.oss-xxx.aliyuncs.com/xxx.png?Expires=xxx",
#               "type": "image"
#             }
#           ]
#         }
#       }
#     ],
#     "finished": true
#   }
# }
```

### Test 3: Auto Pilot Configuration

```bash
# Save current Auto Pilot config with Alibaba
curl -X PUT http://localhost:4000/api/autopilot/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "topic": "sustainable technology",
    "niche": "Tech",
    "category": "technology",
    "tone": "professional",
    "posts_per_day": 1,
    "platforms": ["instagram"],
    "text_provider": "openai",
    "image_provider": "alibaba",
    "selected_template_id": null,
    "facebook_page_ids": [],
    "linkedin_target_ids": []
  }'

# Expected response: { "config": { ... } }
```

### Test 4: Trigger Single Post Generation

```bash
# Generate one post with image
curl -X POST http://localhost:4000/api/autopilot/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# This will create a post in your Calendar with:
# - AI-generated text content
# - AI-generated image from Alibaba
# - Scheduled for next slot

# Check backend logs for progress:
docker logs -f backend | grep -i alibaba
```

### Test 5: Verify Generated Post

```bash
# Get recent Auto Pilot generated posts
curl http://localhost:4000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "limit": 5, "sort": "created_at DESC" }'

# Look for posts with:
# "autopilot_generated": true
# "image_url": "https://dashscope-xxx.oss-xxx.aliyuncs.com/..."
```

---

## Debugging Common Issues

### Issue 1: "No image provider configured"

**Symptom**: 
```
Error: No image provider configured for Auto Pilot.
```

**Diagnosis**:
```bash
# Check if env var is set
echo "Key: ${ALIBABA_DASHSCOPE_API_KEY:0:20}..."
echo "Region: ${ALIBABA_REGION:-not set}"

# Check if backend can see it
docker exec backend sh -c 'echo "Key: ${ALIBABA_DASHSCOPE_API_KEY:0:20}..."'
```

**Fix**:
```bash
# Add to docker-compose.yml
environment:
  ALIBABA_DASHSCOPE_API_KEY: sk-your_real_key_here
  ALIBABA_REGION: singapore

# Rebuild and restart
docker-compose down
docker-compose up -d backend
```

### Issue 2: "401 Unauthorized from Alibaba"

**Symptom**:
```
Authorization: Bearer sk-xxxx rejected by Alibaba
```

**Diagnosis**:
```bash
# 1. Check key format
if [[ $ALIBABA_DASHSCOPE_API_KEY != sk-* ]]; then
  echo "ERROR: Invalid key format"
fi

# 2. Check key hasn't expired
# Go to: https://www.alibabacloud.com/help/en/model-studio/get-api-key

# 3. Check region matches
echo "Configured Region: ${ALIBABA_REGION}"
# Should be 'singapore' or 'beijing', not something else
```

**Fix**:
```bash
# Generate new API key
# 1. Go to: https://www.alibabacloud.com/help/en/model-studio/get-api-key
# 2. Check you're in the right region (Singapore or Beijing)
# 3. Create new key
# 4. Update ALIBABA_DASHSCOPE_API_KEY env var
# 5. Restart backend
```

### Issue 3: "Connection timeout" from Alibaba

**Symptom**:
```
ECONNREFUSED dashscope-intl.aliyuncs.com
ETIMEDOUT dashscope.aliyuncs.com
```

**Diagnosis**:
```bash
# 1. Check network connectivity
ping -c 1 dashscope-intl.aliyuncs.com

# 2. Check region endpoint is correct
curl -I https://dashscope-intl.aliyuncs.com/

# 3. Check firewall/proxy isn't blocking
```

**Fix**:
```bash
# If using Beijing, set correct region
export ALIBABA_REGION=beijing

# If using VPN, whitelist endpoints:
# - dashscope-intl.aliyuncs.com (Singapore)
# - dashscope.aliyuncs.com (Beijing)
```

### Issue 4: "Image generation returned no URL"

**Symptom**:
```
Alibaba image generation returned no URL
```

**Diagnosis**:
```bash
# Check Alibaba API response directly
curl -X POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation \
  -H "Authorization: Bearer $ALIBABA_DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"wan2.7-image-pro","input":{"messages":[{"role":"user","content":[{"text":"test"}]}]},"parameters":{"size":"1024x1024","n":1}}'

# Look for:
# - "error" field (API error)
# - "output.choices[0].message.content[0].image" (success)
```

**Fix**:
```bash
# 1. Check Alibaba free quota isn't exhausted
# Go to: https://usercenter2-intl.console.alibabacloud.com/billing/

# 2. Check prompt length (must be < 500 chars)

# 3. Wait for rate limit if hit:
# Status 429 = rate limited (try again in 1-5 mins)
```

### Issue 5: "Region mismatch" error

**Symptom**:
```
401 Unauthorized / Authentication failed
```

**Diagnosis**:
```bash
# Check API key region matches env var
# 1. Where was key generated?
#    - Singapore region → set ALIBABA_REGION=singapore
#    - Beijing region → set ALIBABA_REGION=beijing

# 2. Check in env
echo $ALIBABA_REGION

# 3. Verify endpoint matches
# Singapore: https://dashscope-intl.aliyuncs.com
# Beijing:   https://dashscope.aliyuncs.com
```

**Fix**:
```bash
# Get API key from correct region
# https://www.alibabacloud.com/help/en/model-studio/get-api-key

# Set matching region
export ALIBABA_REGION=singapore  # or beijing
```

---

## Advanced Debugging

### Enable Verbose Logging

```bash
# Add to docker-compose.yml backend service
environment:
  DEBUG: "*:*"  # Enable all debug logs
  LOG_LEVEL: debug

# Restart backend
docker-compose restart backend

# Watch logs
docker logs -f backend | grep -i "alibaba\|autopiplot"
```

### Check Database State

```bash
# Connect to database
docker exec -it db psql -U postgres sosocial_db

# View Auto Pilot config
SELECT * FROM ai_autopilot_configs LIMIT 1;

# View recent generated posts
SELECT id, content, image_url, autopilot_generated, created_at 
FROM posts 
WHERE autopilot_generated = true 
ORDER BY created_at DESC 
LIMIT 5;

# Check generation logs/history
SELECT * FROM ai_generation_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Test With Different Prompts

```bash
# Test with simple prompt
curl -X POST http://localhost:4000/api/autopilot/run \
  -H "Authorization: Bearer $TOKEN"

# In logs, look for:
docker logs backend | grep -E "prompt|image_url|error"

# Common prompt examples that work well:
# - "A professional office workspace with modern technology"
# - "Sunset over the ocean with golden hour lighting"
# - "Team collaboration in a startup office environment"
```

---

## Performance Optimization

### Reduce Generation Time

```bash
# Use faster model instead of pro version
# Edit backend/src/services/autoPilotWorker.js line ~370

# Change from:
model: 'wan2.7-image-pro'

# To:
model: 'wan2.7-image'  // ~30% faster, slightly lower quality
```

### Batch Generation

```bash
# Generate multiple posts in one run
curl -X PUT http://localhost:4000/api/autopilot/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "posts_per_day": 5,  # Generates up to 5 posts at once
    ... other settings ...
  }'
```

---

## Monitoring & Alerts

### Track API Usage

```bash
# Monitor Alibaba API calls
docker logs backend | grep -c "alibaba"

# Count successful generations
docker logs backend | grep -c "Image generated"

# Count failures
docker logs backend | grep -c "ERROR.*alibaba"
```

### Set Up Rate Limit Monitoring

```bash
# Watch for 429 rate limit errors
docker logs -f backend | grep "429\|rate-limited"

# This means you've exceeded quota, wait before retrying
```

---

## Rollback & Fallback

### If Alibaba Stops Working

```bash
# Switch to different image provider
curl -X PUT http://localhost:4000/api/autopilot/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "image_provider": "openai",  # or "bigmodel" or "deapi"
    ... other settings ...
  }'
```

### Disable Auto Pilot Temporarily

```bash
# If issues persist
curl -X PUT http://localhost:4000/api/autopilot/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

---

## Quick Reference: Commands

```bash
# Get your token (from app after login - check browser localStorage)
TOKEN="your_jwt_token"

# ✅ Check health
curl http://localhost:4000/api/health

# ✅ List providers
curl http://localhost:4000/api/ai/providers -H "Authorization: Bearer $TOKEN"

# ✅ Enable Auto Pilot with Alibaba
curl -X PUT http://localhost:4000/api/autopilot/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"image_provider":"alibaba","text_provider":"openai","topic":"tech","posts_per_day":1,"platforms":["instagram"],"tone":"professional"}'

# ✅ Run once
curl -X POST http://localhost:4000/api/autopilot/run \
  -H "Authorization: Bearer $TOKEN"

# ✅ Check logs
docker logs -f backend | grep alibaba

# ✅ Get recent posts
curl http://localhost:4000/api/posts -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, autopilot_generated, image_url}'
```

---

## Support Resources

📚 **Documentation**:
- [Full Integration Guide](ALIBABA_API_INTEGRATION_GUIDE.md)
- [Quick Setup](ALIBABA_QUICK_SETUP.md)

🔗 **Official Links**:
- https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
- https://www.alibabacloud.com/help/en/model-studio/get-api-key
- https://www.alibabacloud.com/help/en/model-studio/error-code

---

## Still Having Issues?

1. **Check logs**: `docker logs backend | grep -i "error\|alibaba"`
2. **Verify config**: `curl http://localhost:4000/api/ai/providers`
3. **Test API key**: Direct API call test above
4. **Check documentation**: See links above
5. **Review env vars**: `docker exec backend env | grep ALIBABA`

You've got this! 🚀
