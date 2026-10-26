# 📋 AI Context Summary — hisocial / Social Media Control Hub

This file summarizes the entire conversation about uploading the `hisocial` app to GitHub. Paste this to a new AI so it understands the full context.

---

## 1. Project Overview

- **App name:** hisocial (previously referred to as SocialHub)
- **Purpose:** Social media control hub — post to Facebook, Instagram, LinkedIn, Twitter/X, Reddit, and Pinterest from a single app (like Hootsuite / GoHighLevel).
- **Architecture:** Backend: Node.js/Express + PostgreSQL + BullMQ + Redis + Puppeteer | Frontend: React PWA | Orchestration: Docker Compose (backend, frontend, postgres, redis, cloudflared tunnel)

## 2. GitHub Repository

| Detail | Value |
|--------|-------|
| Owner | hrperalglobalcity-spec |
| Repo name | hisocial |
| URL | https://github.com/hrperalglobalcity-spec/hisocial |
| Visibility | Public |
| Default branch | main |
| Remote | https://github.com/hrperalglobalcity-spec/hisocial.git |
| Latest commit | d187c9e — Update README with plain-English setup guide |
- **Working directory:** `c:\Users\Grafixers\Downloads\Compressed\sosocial`

## 3. What Was Done (Session Summary)

### Completed Actions

1. Initialized git repo locally at c:\Users\Grafixers\Downloads\Compressed\sosocial
2. Created .gitignore to exclude node_modules/, .env, chrome_data/, uploads/, .waylog/, *.TXT credential files, database dumps/archives, duplicate social-hub/ folder, OS/IDE files
3. Sanitized docker-compose.yml — replaced all real API keys/secrets with placeholders (Facebook, LinkedIn, LinkedIn Org, OpenAI, Gemini, BigModel, DEAPI, Alibaba, Twitter, Reddit, Pinterest, JWT_SECRET, SESSION_SECRET)
4. Created .env.example — template with placeholder values (no real secrets)
5. Created .github/workflows/ci.yml — GitHub Actions CI (starts Postgres/Redis, installs deps, builds Docker images, runs health checks on localhost:4000 and localhost:4001)
6. Rewrote README.md with plain-English, non-technical setup instructions
7. Removed duplicate social-hub/ folder from the repository
8. Committed and pushed to GitHub (95 files initially, then README update)

## 4. Critical Security Findings (Do Not Repeat)

- .env exposed: APP_LOGIN_USERNAME, APP_LOGIN_PASSWORD, JWT_SECRET, SESSION_SECRET, ALIBABA_DASHSCOPE_API_KEY (all real values were removed from the repo)
- docker-compose.yml exposed: Real Facebook App ID, Facebook secret, LinkedIn client ID, LinkedIn secret, LinkedIn Org ID, OpenAI key, Gemini key, Alibaba key (all real secrets were removed from the repo and replaced with placeholders)
- old-credentials.TXT, token.TXT, app id.TXT contained credentials/tokens
- Verification: Scanned all tracked files — zero leaked keys found
- Rule: The real .env file must NEVER be committed to GitHub. It stays only on the local machine.

## 5. How to Run the App (For a New User)

### Prerequisites
- A computer (Windows or Mac) with Docker Desktop installed and running
- GitHub cannot run the app — it only stores code

### Steps
1. Clone/download the repo: git clone https://github.com/hrperalglobalcity-spec/hisocial.git then cd hisocial
2. Create settings file: cp .env.example .env
3. Edit .env in a text editor and fill in APP_LOGIN_USERNAME, APP_LOGIN_PASSWORD, JWT_SECRET, SESSION_SECRET, and social platform keys
4. Start the app: docker-compose up --build
5. Open browser: http://localhost:4001
6. Log in with credentials from .env

### Docker Commands
- Start: docker-compose up --build
- Stop: docker-compose down
- Restart after .env change: docker-compose down then docker-compose up --build
- View logs: docker-compose logs -f backend
- Full reset (deletes data): docker-compose down -v then docker-compose up --build

## 6. Connecting Social Accounts

GitHub cannot create social media credentials. The user must personally create developer apps on:
- Facebook: https://developers.facebook.com
- Instagram: Same Facebook developer app (requires Business/Creator account)
- LinkedIn: https://www.linkedin.com/developers
- Twitter / X: https://developer.twitter.com
- Reddit: https://www.reddit.com/prefs/apps
- Pinterest: https://developers.pinterest.com

For each platform, copy the App ID and App Secret into .env, then restart Docker.
OAuth callback URLs should point to http://localhost:4000/auth/<platform>/callback for local development.

## 7. Key Files in Repository

| File/Folder | Purpose |
|-------------|---------|
| docker-compose.yml | Full stack orchestration (sanitized — no real keys) |
| .env.example | Template for local .env (copy and fill in) |
| .gitignore | Protects secrets and runtime data |
| .github/workflows/ci.yml | GitHub Actions CI pipeline |
| README.md | Plain-English setup guide |
| backend/ | Node.js/Express API (OAuth, posting, AI, monitoring) |
| frontend/ | React PWA UI |
| scripts/ | PowerShell utilities (cookie verification, monitor E2E) |

## 8. Common Questions & Warnings for Next AI

- "Do I need to reset keys every time?" — No. Once .env is set and Docker is running, it stays until you stop it.
- "Do I need to run Docker every time?" — Yes. The app only works while Docker Desktop is running. After reboot, start Docker Desktop and run docker-compose up.
- "Can GitHub/Meta/Muse account create credentials?" — No. GitHub is just code storage. Social platform credentials must be created by the user on each platform's developer website.
- "I don't have a computer/system." — A computer with Docker Desktop is required. GitHub alone cannot run the app.
- The user is non-technical — explain steps in plain language, avoid jargon.
- The social-hub/ duplicate folder was EXCLUDED from the repo — do not reference it as part of the current structure.
- Never suggest committing .env or any file with real passwords/API keys.
- Never suggest using old real keys found in pre-sanitized docker-compose.yml.