# ⚡ SocialHub — All Platforms in One PWA

Post to Facebook, Instagram, LinkedIn, Twitter/X, Reddit, and Pinterest from a single app.
Built with React PWA + Node.js + PostgreSQL, fully Dockerized.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 2. Clone / extract this project, then:

```bash
cd social-hub
docker-compose up --build
```

Open **http://localhost:3000**

---

## 🔑 Connecting Social Platforms

Each platform requires you to create a developer app and paste credentials into `docker-compose.yml`.

### Facebook
1. Go to https://developers.facebook.com → Create App → Consumer
2. Add "Facebook Login" product
3. Set Valid OAuth Redirect: `http://localhost:4000/auth/facebook/callback`
4. Copy App ID and App Secret into `docker-compose.yml`:
   ```
   FACEBOOK_APP_ID: 123456789
   FACEBOOK_APP_SECRET: abcdef...
   ```

### Instagram
1. Same Facebook Developer app → Add "Instagram Basic Display" product
2. Set Valid OAuth Redirect: `http://localhost:4000/auth/instagram/callback`
3. Copy Instagram App ID and Secret:
   ```
   INSTAGRAM_APP_ID: 123456789
   INSTAGRAM_APP_SECRET: abcdef...
   ```
> Note: Instagram requires a Business/Creator account for posting via API.

### LinkedIn
1. Go to https://www.linkedin.com/developers/ → Create App
2. Add OAuth 2.0 redirect: `http://localhost:4000/auth/linkedin/callback`
3. Request permissions: `r_emailaddress`, `r_liteprofile`, `w_member_social`
4. Copy Client ID and Secret:
   ```
   LINKEDIN_CLIENT_ID: 123abc
   LINKEDIN_CLIENT_SECRET: abcdef...
   ```

### Twitter / X
1. Go to https://developer.twitter.com → Create Project & App
2. Enable OAuth 1.0a
3. Set Callback URL: `http://localhost:4000/auth/twitter/callback`
4. Copy API Key and Secret:
   ```
   TWITTER_API_KEY: your_key
   TWITTER_API_SECRET: your_secret
   ```

### Reddit
1. Go to https://www.reddit.com/prefs/apps → Create App → Select "web app"
2. Set redirect URI: `http://localhost:4000/auth/reddit/callback`
3. Copy client ID (under app name) and secret:
   ```
   REDDIT_CLIENT_ID: abc123
   REDDIT_CLIENT_SECRET: abcdef...
   ```

### Pinterest
1. Go to https://developers.pinterest.com → My Apps → Create App
2. Set redirect URI: `http://localhost:4000/auth/pinterest/callback`
3. Request scopes: `boards:read`, `pins:read`, `pins:write`
4. Copy App ID and Secret:
   ```
   PINTEREST_APP_ID: 123456
   PINTEREST_APP_SECRET: abcdef...
   ```

---

## 🏗️ Architecture

```
social-hub/
├── docker-compose.yml       # Orchestrates all services
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── init.sql             # PostgreSQL schema
│   └── src/
│       ├── index.js         # Express app entry
│       ├── passport.js      # OAuth strategies
│       ├── services/
│       │   ├── linkedinScraper.js     # Headless LinkedIn scan (Puppeteer)
│       │   ├── monitorWorker.js       # BullMQ + Redis background worker
│       │   ├── monitorEngine.js       # Scan + dedupe + AI pipeline
│       │   ├── deduplicationService.js
│       │   └── aiAnalyzer.js
│       └── routes/
│           ├── auth.js      # OAuth callbacks + disconnect
│           ├── user.js      # User profile + post history
│           ├── posts.js     # Cross-platform posting
│           ├── platforms.js # Platform metadata
│           └── monitorRoutes.js # AI Monitor API
└── frontend/
    ├── Dockerfile
    ├── public/
    │   ├── index.html
    │   └── manifest.json    # PWA manifest
    └── src/
        ├── index.js
        └── App.js           # Full React UI (Compose + Calendar + Library + AI Monitor)
```

**Services:**
| Service    | Port | Purpose                        |
|------------|------|--------------------------------|
| redis      | 6379 | Queue backend for monitor jobs |
| postgres   | 5432 | Persistent storage             |
| backend    | 4000 | API + OAuth + posting logic    |
| frontend   | 3000 | React PWA                      |

---

## 🧠 AI Monitor Module (Integrated Tab)

The app includes an in-app **AI Monitor** tab (no separate app) with a 3-column workflow:

1. **Monitor Jobs**
   - Create monitoring jobs with dynamic keywords (one per line)
   - LinkedIn platform (current), include/exclude filters, user context
   - Auto-run toggle + scan interval (minutes)

2. **Extracted Posts (Live Feed)**
   - Shows unique hiring opportunities sorted by relevance score
   - Includes author/company, snippet, matched keywords, timestamp, platform link

3. **AI Actions Panel**
   - AI-generated comment / DM / proposal per selected post
   - Edit, copy, save-for-later, approve actions

### Background Worker Behavior
- Runs in backend continuously (independent of UI being open)
- Uses **BullMQ + Redis** queue
- Uses **Puppeteer headless** (no external browser window)
- Scans auto-run jobs on interval, deduplicates, scores, and generates AI responses

### Monitor API
- `POST /api/monitor/create` — create/update monitor job
- `GET /api/monitor/jobs` — list monitor jobs
- `GET /api/monitor/posts?jobId=...` — fetch deduped monitored posts + AI responses
- `POST /api/monitor/scan` — queue scan for a monitor job
- `POST /api/monitor/action` — save/approve/update AI response drafts

### Monitor Data Model
- `monitor_jobs` — job definitions, keywords, filters, context, auto-run config
- `monitor_posts` — extracted posts, fingerprint hash, relevance score, dedupe linkage
- `ai_responses` — generated comment/dm/proposal for each monitor post

### Required Runtime Environment
Configured in `docker-compose.yml`:
- `REDIS_URL=redis://redis:6379`
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`

---

## 🗄️ Database

Data is stored in PostgreSQL with these tables:
- `users` — Your account (created automatically on first login)
- `social_accounts` — Connected platforms + tokens
- `posts` — Post history
- `platform_posts` — Per-platform post results
- `sessions` — Keep you logged in for 30 days

---

## 🔒 Security Notes

Before deploying to production:
1. Change `JWT_SECRET` and `SESSION_SECRET` in `docker-compose.yml`
2. Set `NODE_ENV=production`
3. Use HTTPS (update all callback URLs)
4. Set `secure: true` for cookies

---

## 🖼️ Media Upload Notes

- Facebook and LinkedIn can now publish images that were uploaded through the app from your local system because the backend uploads the binary image data directly to those APIs.
- Instagram's Graph API still requires a public HTTPS image URL that Meta's servers can reach. A localhost URL like `http://localhost:4000/uploads/...` will not work for Instagram.
- To make app-uploaded images usable for Instagram, set `PUBLIC_BACKEND_URL` in the backend environment to a public HTTPS URL that points to this backend, for example a deployed domain or a tunnel URL.

---

## 🛠️ Commands

```bash
# Start everything
docker-compose up --build

# Stop
docker-compose down

# View logs
docker-compose logs -f backend

# Reset database
docker-compose down -v
docker-compose up --build

# Access PostgreSQL directly
docker exec -it socialhub_db psql -U socialhub -d socialhub
```
