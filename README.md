# 📘 hisocial — Your Social Media Control Hub

Post to Facebook, Instagram, LinkedIn, Twitter/X, Reddit, and Pinterest from one app.

> ⚠️ **Important:** GitHub only stores the code. To actually use the app, you need a computer with **Docker Desktop** installed. You also need to create your own developer accounts on each social platform to get API keys.

## 🖥️ What you need before starting

1. **A computer** (Windows or Mac) with [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
2. **Your own login credentials** (you will choose a username and password).
3. **Social platform developer accounts** — one for each platform you want to connect (Facebook, LinkedIn, Twitter/X, Instagram, Reddit, Pinterest). These are free but require approval.

## 🚀 Step-by-step setup (non-technical)

### Step 1: Get the code on your computer
Download this repo as a ZIP, or clone it:
```bash
git clone https://github.com/hrperalglobalcity-spec/hisocial.git
cd hisocial
```

### Step 2: Create your settings file
Make a copy of the example file:
```bash
cp .env.example .env
```

Open `.env` in a text editor (Notepad, TextEdit, VS Code) and fill in:

| Setting | What to put |
|---------|-------------|
| `APP_LOGIN_USERNAME` | Your chosen admin username (e.g. `admin`) |
| `APP_LOGIN_PASSWORD` | Your chosen admin password |
| `JWT_SECRET` | Any random long string (e.g. `mysecret123456`) |
| `SESSION_SECRET` | Any random long string (e.g. `myothersession789`) |

Leave the other values as-is for now. Save the file.

> 🔒 **Never upload or share the `.env` file.** It contains your passwords.

### Step 3: Start the app
```bash
docker-compose up --build
```

Wait until you see messages saying the backend and frontend are ready.

### Step 4: Open the app
Open your browser and go to:
**http://localhost:4001**

Log in with the username and password you set in `.env`.

## 🔑 Connect your social accounts (do this inside the app)

Once logged in, go to the **Accounts** or **Connections** section and click "Connect" for each platform:

- **Facebook** — Create an app at https://developers.facebook.com
- **Instagram** — Same Facebook developer app
- **LinkedIn** — Create an app at https://www.linkedin.com/developers
- **Twitter / X** — Create an app at https://developer.twitter.com
- **Reddit** — Create an app at https://www.reddit.com/prefs/apps
- **Pinterest** — Create an app at https://developers.pinterest.com

For each platform, copy the **App ID** and **App Secret** and paste them into your `.env` file, then restart Docker:
```bash
docker-compose down
docker-compose up --build
```

> 📌 GitHub **cannot** create these credentials for you. You must create them yourself on each platform's developer website.

## 🐳 Docker commands you need to know

| What you want to do | Command |
|---------------------|---------|
| Start the app | `docker-compose up --build` |
| Stop the app | `docker-compose down` |
| Restart after changing `.env` | `docker-compose down` then `docker-compose up --build` |
| View app logs | `docker-compose logs -f backend` |
| Completely reset (deletes all data) | `docker-compose down -v` then `docker-compose up --build` |

## ❓ Common questions

**"Do I need to reset keys every time?"**
No. Once you set your `.env` file and start Docker, it stays running until you stop it.

**"Do I need to run Docker every time?"**
Yes. The app only works while Docker Desktop is running. If you shut down your computer, start Docker Desktop again and run `docker-compose up`.

**"Can GitHub create my social media accounts or credentials?"**
No. GitHub is just code storage. You create credentials on Facebook, LinkedIn, Twitter, etc. yourself.

**"I don't have a computer/system."**
You need a computer with Docker Desktop to run this app. GitHub alone cannot run it for you.

## 🛡️ Safety

- Never commit your real `.env` file to GitHub.
- If you accidentally share a real API key, go to that platform's website and revoke/generate a new key immediately.