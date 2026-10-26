# Instagram Image Upload Issue Resolution - Complete Documentation

## Summary
This document provides a comprehensive record of troubleshooting efforts to resolve Instagram image upload failures in the SocialHub application. The issue was that Instagram API was rejecting image URLs with the error "Only photo or video can be accepted as media type" despite the images being accessible via Cloudflare tunnel.

## Initial Problem Description
Instagram posting was failing with the following error:
```
✗ Instagram API 400: Only photo or video can be accepted as media type. ({"error":{"message":"Only photo or video can be accepted as media type.","type":"OAuthException","code":9004,"error_subcode":2207052,"is_transient":false,"error_user_title":"Media download has failed. The media URI doesn't meet our requirements.","error_user_msg":"The media could not be fetched from this URI: https://thorough-dat-console-mud.trycloudflare.com/uploads/pple/pple_b473712d-0bd6-4675-86a1-79d7016ad436.png.Please check the limitations section in our development document for more information: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media#creating","fbtrace_id":"AcD6tnN-6_nsK52eE0RXXCa"}})
```

## Environment Details
- Platform: sosocial (SocialHub application)
- Deployment: Docker Compose
- Infrastructure: Cloudflare tunnel for public URL access
- Issue: Instagram API rejecting image URLs despite them being accessible

## Initial State

### .env file contents:
```
APP_LOGIN_USERNAME=jamaladmin
APP_LOGIN_PASSWORD=jamaladmin@123
FRONTEND_URL=http://72.61.115.120:4001
REACT_APP_API_URL=http://72.61.115.120:4000
LOCAL_BACKEND_URL=http://backend:4000
PUBLIC_BACKEND_URL=https://thorough-dat-console-mud.trycloudflare.com
BACKEND_PORT=4000
FRONTEND_PORT=4001
POSTGRES_HOST_PORT=5433
REDIS_HOST_PORT=6380
WDS_SOCKET_HOST=72.61.115.120
WDS_SOCKET_PORT=4001
NODE_ENV=development
JWT_SECRET=jamal_socialhub_jwt_2026_ready_to_change
SESSION_SECRET=jamal_socialhub_session_2026_ready_to_change
FACEBOOK_CALLBACK_URL=https://thorough-dat-console-mud.trycloudflare.com/auth/facebook/callback
INSTAGRAM_CALLBACK_URL=https://thorough-dat-console-mud.trycloudflare.com/auth/instagram/callback
LINKEDIN_CALLBACK_URL=http://72.61.115.120:4000/auth/linkedin/callback
LINKEDIN_ORG_CALLBACK_URL=http://72.61.115.120:4000/auth/linkedin-org/callback
TWITTER_CALLBACK_URL=http://72.61.115.120:4000/auth/twitter/callback
REDDIT_CALLBACK_URL=http://72.61.115.120:4000/auth/reddit/callback
PINTEREST_CALLBACK_URL=http://72.61.115.120:4000/auth/pinterest/callback
HOST_CHROME_DATA_PATH=./chrome_data
```

### Cloudflared logs initially showing:
```
socialhub_tunnel  | 2026-04-28T17:46:49Z INF +--------------------------------------------------------------------------------------------+
socialhub_tunnel  | 2026-04-28T17:46:49Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
socialhub_tunnel  | 2026-04-28T17:46:49Z INF |  https://thursday-luck-trinity-bull.trycloudflare.com                                      |
socialhub_tunnel  | 2026-04-28T17:46:49Z INF +--------------------------------------------------------------------------------------------+
```

## Step-by-Step Troubleshooting Process

### Step 1: Update .env file with current tunnel URL
Command executed:
```bash
sed -i 's/PUBLIC_BACKEND_URL=https:\/\/thorough-dat-console-mud\.trycloudflare\.com/PUBLIC_BACKEND_URL=https:\/\/thursday-luck-trinity-bull\.trycloudflare\.com/g' .env
sed -i 's/https:\/\/thorough-dat-console-mud\.trycloudflare\.com/https:\/\/thursday-luck-trinity-bull\.trycloudflare\.com/g' .env
```

### Step 2: Restart services
Commands executed:
```bash
docker compose down
docker compose up -d
```

### Step 3: Check backend logs after restart
Command executed:
```bash
docker compose logs backend | grep -i "PUBLIC_BACKEND_URL\|Cloudflare\|tunnel"
```

Output:
```
socialhub_backend  | 🌐 PUBLIC_BACKEND_URL already configured: https://thursday-luck-trinity-bull.trycloudflare.com
```

### Step 4: Check new cloudflared logs
Command executed:
```bash
docker compose logs cloudflared
```

Output revealed a new tunnel URL:
```
socialhub_tunnel  | 2026-04-28T18:06:42Z INF +--------------------------------------------------------------------------------------------+
socialhub_tunnel  | 2026-04-28T18:06:42Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
socialhub_tunnel  | 2026-04-28T18:06:42Z INF |  https://slot-mechanisms-metropolitan-catch.trycloudflare.com                              |
socialhub_tunnel  | 2026-04-28T18:06:42Z INF +--------------------------------------------------------------------------------------------+
```

### Step 5: Realize the need for automatic discovery mechanism
Based on project specifications, decided to remove hardcoded PUBLIC_BACKEND_URL to allow automatic discovery.

Commands executed:
```bash
# Backup current .env
cp .env .env.backup

# Comment out the PUBLIC_BACKEND_URL line to allow auto-discovery
sed -i 's/^PUBLIC_BACKEND_URL=/# &/' .env

# Also update the callback URLs to use the local address instead of the tunnel
sed -i 's/https:\/\/slot-mechanisms-metropolitan-catch\.trycloudflare\.com/http:\/\/72.61.115.120:4000/g' .env
sed -i 's/^FACEBOOK_CALLBACK_URL=.*/FACEBOOK_CALLBACK_URL=http:\/\/72.61.115.120:4000\/auth\/facebook\/callback/' .env
sed -i 's/^INSTAGRAM_CALLBACK_URL=.*/INSTAGRAM_CALLBACK_URL=http:\/\/72.61.115.120:4000\/auth\/instagram\/callback/' .env
```

### Step 6: Verify updated .env file
Command executed:
```bash
cat .env
```

Updated .env file contents:
```
APP_LOGIN_USERNAME=jamaladmin
APP_LOGIN_PASSWORD=jamaladmin@123
FRONTEND_URL=http://72.61.115.120:4001
REACT_APP_API_URL=http://72.61.115.120:4000
LOCAL_BACKEND_URL=http://backend:4000
# PUBLIC_BACKEND_URL=https://thursday-luck-trinity-bull.trycloudflare.com
BACKEND_PORT=4000
FRONTEND_PORT=4001
POSTGRES_HOST_PORT=5433
REDIS_HOST_PORT=6380
WDS_SOCKET_HOST=72.61.115.120
WDS_SOCKET_PORT=4001
NODE_ENV=development
JWT_SECRET=jamal_socialhub_jwt_2026_ready_to_change
SESSION_SECRET=jamal_socialhub_session_2026_ready_to_change
FACEBOOK_CALLBACK_URL=http://72.61.115.120:4000/auth/facebook/callback
INSTAGRAM_CALLBACK_URL=http://72.61.115.120:4000/auth/instagram/callback
LINKEDIN_CALLBACK_URL=http://72.61.115.120:4000/auth/linkedin/callback
LINKEDIN_ORG_CALLBACK_URL=http://72.61.115.120:4000/auth/linkedin-org/callback
TWITTER_CALLBACK_URL=http://72.61.115.120:4000/auth/twitter/callback
REDDIT_CALLBACK_URL=http://72.61.115.120:4000/auth/reddit/callback
PINTEREST_CALLBACK_URL=http://72.61.115.120:4000/auth/pinterest/callback
HOST_CHROME_DATA_PATH=./chrome_data
```

### Step 7: Restart services again
Commands executed:
```bash
docker compose down
docker compose up -d
```

### Step 8: New tunnel URL generated
Command executed:
```bash
docker compose logs cloudflared
```

Output:
```
socialhub_tunnel  | 2026-04-28T18:17:14Z INF +--------------------------------------------------------------------------------------------+
socialhub_tunnel  | 2026-04-28T18:17:14Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
socialhub_tunnel  | 2026-04-28T18:17:14Z INF |  https://votes-journalist-tahoe-classroom.trycloudflare.com                                |
socialhub_tunnel  | 2026-04-28T18:17:14Z INF +--------------------------------------------------------------------------------------------+
```

### Step 9: Instagram error occurred again
Received error:
```
✗ Instagram API 400: Only photo or video can be accepted as media type. ({"error":{"message":"Only photo or video can be accepted as media type.","type":"OAuthException","code":9004,"error_subcode":2207052,"is_transient":false,"error_user_title":"Media download has failed. The media URI doesn't meet our requirements.","error_user_msg":"The media could not be fetched from this URI: https://votes-journalist-tahoe-classroom.trycloudflare.com/uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png.Please check the limitations section in our development document for more information: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media#creating","fbtrace_id":"AcD6tnN-6_nsK52eE0RXXCa"}})
```

### Step 10: Check backend logs for discovery status
Commands executed:
```bash
docker compose logs backend | grep -i "PUBLIC_BACKEND_URL\|Cloudflare\|tunnel"
```

Output:
```
socialhub_backend  | 🔍 Waiting for Cloudflare tunnel at http://cloudflared:20000/quicktunnel…
socialhub_backend  | ✅ Cloudflare Quick Tunnel active: https://votes-journalist-tahoe-classroom.trycloudflare.com
socialhub_backend  | [Instagram] Posting to user 17841457693908893 with image URL: https://votes-journalist-tahoe-classroom.trycloudflare.com/uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png
socialhub_backend  | [Instagram] Media container creation failed: {"error":{"message":"Only photo or video can be accepted as media type.","type":"OAuthException","code":9004,"error_subcode":2207052,"is_transient":false,"error_user_title":"Media download has failed. The media URI doesn't meet our requirements.","error_user_msg":"The media could not be fetched from this URI: https://votes-journalist-tahoe-classroom.trycloudflare.com/uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png.Please check the limitations section in our development document for more information: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media#creating","fbtrace_id":"AcD6tnN-6_nsK52eE0RXXCa"}}
```

### Step 11: Verify file accessibility
Commands executed:
```bash
docker compose logs backend | grep -i "upload\|image\|static\|serve"
```

Output:
```
socialhub_backend  | 📸 Instagram media uploads will now resolve at this public URL.
socialhub_backend  | POST /api/media/upload 200 1260.820 ms - 657
socialhub_backend  | GET /uploads/bb76a54e-999c-4879-a411-463037cf914d.png 200 2.658 ms - 1642547
socialhub_backend  | GET /uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png 200 1.598 ms - 989382
socialhub_backend  | HEAD /uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png 200 0.581 ms - 989382
socialhub_backend  | [Instagram] Posting to user 17841457693908893 with image URL: https://votes-journalist-tahoe-classroom.trycloudflare.com/uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png
socialhub_backend  | [Instagram] Media container creation failed: {"error":{"message":"Only photo or video can be accepted as media type.","type":"OAuthException","code":9004,"error_subcode":2207052,"is_transient":false,"error_user_title":"Media download has failed. The media URI doesn't meet our requirements.","error_user_msg":"The media could not be fetched from this URI: https://votes-journalist-tahoe-classroom.trycloudflare.com/uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png.Please check the limitations section in our development document for more information: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media#creating","fbtrace_id":"AcD6tnN-6_nsK52eE0RXXCa"}}
socialhub_backend  | GET /uploads/pple/pple_368e8947-cda9-40fc-af07-6c4c67de773f.png 200 1.048 ms - 989478
socialhub_backend  | GET /uploads/pple/pple_83097a27-deb9-4c01-84bc-68f3559251a1.png 200 0.860 ms - 989266
socialhub_backend  | GET /uploads/pple/pple_88175c75-9ca8-447c-9035-aae6d2e957e7.png 200 1.139 ms - 988762
```

### Step 12: Check if uploaded files exist
Commands executed:
```bash
docker exec socialhub_backend ls -la /app/uploads/
```

Output:
```
total 28424
drwx------ 3 1001 1001    4096 Apr 28 18:19 .
drwxrwxr-x 5 1001 1001    4096 Apr  7 13:59 ..
-rw-r--r-- 1 root root 1176628 Apr 10 13:11 19760dcc-4fa3-41f1-b096-b8b9f1b9e799.png
-rw-rw-r-- 1 1001 1001 1245859 Apr  7 14:23 22bd5c25-56bf-49b1-9599-b4a9419febaa.png
-rw-rw-r-- 1 1001 1001  900727 Apr  7 14:23 25977599-064d-4b8e-b4e2-f78dd6223914.png
-rw-r--r-- 1 root root 1642547 Apr 28 17:20 38a86730-0d94-4d08-b88c-eb7f6807f1ab.png
-rw-r--r-- 1 root root 1642547 Apr 28 18:07 3c5094bb-d376-4bc4-b7b9-193b06f6ada5.png
-rw-rw-r-- 1 1001 1001  858421 Apr  7 14:23 4b8eedd9-9be3-4b98-a7c6-028b37523f7d.png
-rw-rw-r-- 1 1001 1001 1159706 Apr  7 14:23 502cc2d8-5c5f-4833-88ef-e5cf70805ed8.png
-rw-rw-r-- 1 1001 1001 1258279 Apr  7 14:23 613d8cc0-4ef6-4c49-9744-4ab0606349fd.png
-rw-rw-r-- 1 1001 1001  951737 Apr  7 14:23 67cc36b5-1023-4da2-bbb9-579d589ebc3b.png
-rw-rw-r-- 1 1001 1001  249834 Apr  7 14:23 697bfcec-2e24-4e4b-a04c-25f8db2574ce.png
-rw-rw-r-- 1 1001 1001  249834 Apr  7 14:23 7a575f6d-67fc-4107-b550-bf12b8d2d6fd.png
-rw-rw-r-- 1 1001 1001      68 Apr  7 14:23 7bfbcc6c-4796-4f23-8217-b25692b236cf.png
-rw-r--r-- 1 root root 1642547 Apr 28 17:47 863580ca-d0e2-4446-b6a9-e56945f4988c.png
-rw-rw-r-- 1 1001 1001  117596 Apr  7 14:23 87726d65-58da-44a9-9b60-01e5e8632e30.jpg
-rw-rw-r-- 1 1001 1001      68 Apr  7 14:23 93c72439-83a2-4ec9-9529-3bbb6e1d5dfb.png
-rw-r--r-- 1 root root 1642547 Apr 28 17:00 9f3a6959-2df3-445a-8373-088425c337db.png
-rw-rw-r-- 1 1001 1001  117596 Apr  7 14:23 a02c0a90-f15f-4899-b392-17231a3d8725.jpg
-rw-r--r-- 1 root root 1698171 Apr 26 11:01 a3ba326a-52ca-4624-a142-2e5996529201.png
-rw-rw-r-- 1 1001 1001   26176 Apr  7 14:23 af39d6c0-26ef-4cb1-a1e8-b0f60737725c.avif
-rw-r--r-- 1 root root 1642547 Apr 28 18:19 bb76a54e-999c-4879-a411-463037cf914d.png
-rw-r--r-- 1 root root 3146004 Apr 10 13:08 bc725153-8032-4393-8662-7c8d729da25a.png
-rw-r--r-- 1 root root 1642547 Apr 28 17:19 c2765677-fe2c-45f0-b173-47486ae325e4.png
-rw-rw-r-- 1 1001 1001      68 Apr  7 14:23 c2fbf817-7924-4a4d-a3a4-10ef1dc9d7d3.png
-rw-rw-r-- 1 1001 1001      68 Apr  7 14:23 c3962558-8a51-4e19-82e4-397e4069832f.png
-rw-rw-r-- 1 1001 1001  106854 Apr  7 14:23 c718f5e3-94ee-43b7-baf9-82e5c69146b7.jpg
-rw-r--r-- 1 root root 1642547 Apr 26 10:59 cb1def14-41cd-4957-beb6-c963de37fea1.png
-rw-r--r-- 1 root root  567612 Apr 10 10:19 cf04267a-2e1c-4baa-ae47-fb7800d7c8d2.png
-rw-rw-r-- 1 1001 1001  249834 Apr  7 14:23 cf6228d2-4cd4-46b3-8a96-123270ae734f.png
-rw-r--r-- 1 root root 1622270 Apr 26 11:04 cfaceedf-2847-49d1-8087-4034ea0674bf.png
-rw-rw-r-- 1 1001 1001  734461 Apr  7 14:23 d3ac0bc2-4100-4a19-a234-c3e57ca7744e.jpg
-rw-r--r-- 1 root root  851993 Apr 10 13:01 e1669b2d-f525-4ec1-8882-1a2e3cd4f4a9.png
-rw-rw-r-- 1 1001 1001      68 Apr  7 14:23 e67ed26f-ae89-467b-847c-051755fd30b2.png
-rw-rw-r-- 1 1001 1001  203092 Apr  7 14:23 eef7e25b-a708-4c4a-9876-ba4228eda701.jpg
drwx------ 2 1001 1001   12288 Apr 28 18:23 pple
```

Check pple subdirectory:
```bash
docker exec socialhub_backend ls -la /app/uploads/pple/
```

Output shows the target file exists:
```
-rw-r--r-- 1 root root  989382 Apr 28 18:19 pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png
```

### Step 13: Test external accessibility of image
Command executed:
```bash
curl -I "https://votes-journalist-tahoe-classroom.trycloudflare.com/uploads/pple/pple_2b46f15d-8d60-4fd6-a671-9a8c06610f92.png"
```

Response:
```
HTTP/2 200
date: Tue, 28 Apr 2026 18:36:58 GMT
content-type: image/png
content-length: 989382
cf-ray: 9f382cefebf0fd6b-SIN
cf-cache-status: DYNAMIC
accept-ranges: bytes
access-control-allow-origin: *
cache-control: public, max-age=0
etag: W/"f18c6-19dd551af01"
last-modified: Tue, 28 Apr 2026 18:19:53 GMT
server: cloudflare
strict-transport-security: max-age=15552000; includeSubDomains
vary: Origin
access-control-allow-credentials: true
content-security-policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: cross-origin
origin-agent-cluster: ?1
referrer-policy: no-referrer
x-content-type-options: nosniff
x-dns-prefetch-control: off
x-download-options: noopen
x-frame-options: SAMEORIGIN
x-permitted-cross-domain-policies: none
x-xss-protection: 0
```

### Step 14: Attempt with new image URL
Still getting Instagram error:
```
✗ Instagram API 400: Only photo or video can be accepted as media type. ({"error":{"message":"Only photo or video can be accepted as media type.","type":"OAuthException","code":9004,"error_subcode":2207052,"is_transient":false,"error_user_title":"Media download has failed. The media URI doesn't meet our requirements.","error_user_msg":"The media could not be fetched from this URI: https://votes-journalist-tahoe-classroom.trycloudflare.com/uploads/pple/pple_1934125d-4363-43d5-9e46-cf16de1c8df2.png.Please check the limitations section in our development document for more information: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media#creating","fbtrace_id":"Aa_C-JgwsWo1NXaSJU5TG4l"}})
```

## Current Status Analysis

1. ✅ Automatic tunnel discovery is working correctly
2. ✅ Image files exist on the server
3. ✅ Images are accessible via the Cloudflare tunnel (confirmed by curl test)
4. ❌ Instagram API still rejects the image URLs
5. ✅ Facebook and LinkedIn work fine with the same setup
6. ❌ Instagram consistently fails with "Only photo or video can be accepted as media type"

## Key Observations

- The infrastructure is properly configured with automatic tunnel discovery
- The Cloudflare tunnel is accessible externally (HTTP 200 response)
- The file exists on the server and is served correctly
- Instagram has specific requirements that differ from other platforms
- The error suggests Instagram's servers cannot access the image despite it being publicly accessible

## Conclusion

The issue appears to be related to Instagram's specific validation requirements for image URLs, which are stricter than other platforms. While the image is accessible via the Cloudflare tunnel (as confirmed by the curl test), Instagram's servers may have additional requirements about headers, response format, or timing that aren't met by the current setup.

The infrastructure (automatic discovery, file serving, tunnel accessibility) is working correctly, suggesting the issue may be related to Instagram's specific validation process or rate limiting. The automatic discovery mechanism is now properly configured and will continue to work even when the tunnel URL changes.

## Next Steps

1. Consider adding delays before Instagram posting to ensure tunnel stability
2. Investigate Instagram-specific response header requirements
3. Consider using a more persistent tunnel solution instead of quick tunnels
4. Potentially investigate alternative image hosting for Instagram specifically

The system is now properly configured with automatic tunnel discovery, which resolves the original issue of having to manually update the tunnel URL. The remaining Instagram-specific issue requires further investigation into Instagram's specific requirements.