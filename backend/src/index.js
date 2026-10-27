require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const { createMonitorWorker } = require('./services/monitorWorker');
const { createAutoPilotWorker } = require('./services/autoPilotWorker');

const app = express();
const PORT = process.env.PORT || 4000;

// Database pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Make pool available globally
app.locals.db = pool;

// Cross-domain Instagram pending auth store (token → accounts, survives across cross-domain OAuth redirects)
app.locals.instagramPending = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of app.locals.instagramPending) {
    if (v.expires < now) app.locals.instagramPending.delete(k);
  }
}, 10 * 60 * 1000);

// Middleware
// Register uploads BEFORE helmet to bypass security headers
app.use('/uploads', (req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // Use the same origin as the request instead of wildcard for credential compatibility
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Fallback for non-browser requests
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Apply helmet AFTER static routes
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: (origin, callback) => {
    // Echo request origin so browsers receive an exact Access-Control-Allow-Origin
    // This works with `credentials: true` and allows the dynamic frontend host.
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Session with PostgreSQL store
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'sessions',
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET || 'socialhub_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  if (req.user && req.session && !req.session.appAuthenticated) {
    req.session.appAuthenticated = true;
  }
  next();
});

// Configure passport strategies
require('./passport')(passport, pool);

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/user', require('./routes/user'));
const postsRouter = require('./routes/posts');
app.use('/api/posts', postsRouter);
app.use('/api/platforms', require('./routes/platforms'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai', require('./routes/aiCreative'));
app.use('/api/brain', require('./routes/brain'));
app.use('/api/monitor', require('./routes/monitorRoutes'));
app.use('/api/linkedin-feed', require('./routes/linkedinFeed'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/media', require('./routes/media'));
app.use('/api/autopilot', require('./routes/autopilot'));
app.use('/api/pple', require('./routes/pple'));

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

async function ensureStarterAccounts() {
  const starterAccounts = [
    { name: 'Umar Jamal Munzoor', email: 'umar@grafixers.local' },
    { name: 'Maryum Umar', email: 'maryum@grafixers.local' },
    { name: 'Grafixers Team', email: 'team@grafixers.local' }
  ];

  for (const account of starterAccounts) {
    await pool.query(
      `INSERT INTO users (email, name)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         updated_at = NOW()`,
      [account.email, account.name]
    );
  }
}

async function runMigrations() {
  // Phase 1: base tables that used to exist only in backend/init.sql.
  // init.sql runs only on a fresh Docker volume's first init, so a
  // database created any other way (or an existing volume) had no
  // users/posts/sessions tables at all, and the first ALTER below
  // crashed the backend with 'relation "posts" does not exist'
  // (CI run 40404684266). Creating them here, before any ALTER,
  // makes startup independent of the init script. init.sql is kept
  // for fresh Docker DBs and must stay in sync with this block.
  // Phase 1 correction: uuid_generate_v4() is from "uuid-ossp",
  // NOT pgcrypto (pgcrypto provides gen_random_uuid()). Creating
  // pgcrypto alone succeeded, then every table creation failed
  // with 'function uuid_generate_v4() does not exist' (CI 40405772382).
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      platform_user_id TEXT,
      platform_username TEXT,
      platform_display_name TEXT,
      platform_avatar_url TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      scope TEXT,
      is_active BOOLEAN DEFAULT true,
      connected_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, platform, platform_user_id)
    )`);
  // Phase 4: groups + multi-account, migrated idempotently so
  // existing databases upgrade on startup instead of needing a
  // fresh volume. Order matters: account_groups first (the FK
  // target), then the group_id column, then the constraint
  // swap. The old (user_id, platform) constraint was stricter
  // than the new one, so existing rows always satisfy the new
  // (user_id, platform, platform_user_id) constraint.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_groups (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, name)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_account_groups_user ON account_groups (user_id)`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES account_groups(id) ON DELETE SET NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_accounts_group ON social_accounts (group_id)`);
  await pool.query(`ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_user_id_platform_key`);
  await pool.query(`
    DO $$ BEGIN
      BEGIN
        ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_user_platform_account_key UNIQUE (user_id, platform, platform_user_id);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END $$`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT,
      platforms TEXT[] DEFAULT '{}',
      media_urls TEXT[] DEFAULT '{}',
      status VARCHAR(30) NOT NULL,
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      facebook_page_ids TEXT[] DEFAULT '{}',
      linkedin_target_ids TEXT[] DEFAULT '{}',
      autopilot_generated BOOLEAN DEFAULT false,
      generation_source VARCHAR(30),
      generation_batch_id VARCHAR(100),
      generation_index INTEGER,
      generation_total INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_posts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      platform VARCHAR(50) NOT NULL,
      platform_post_id TEXT,
      platform_post_url TEXT,
      status VARCHAR(30) NOT NULL,
      error_message TEXT,
      posted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_creative_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tone TEXT,
      niche TEXT,
      category TEXT,
      topic TEXT,
      status VARCHAR(30),
      final_prompt TEXT,
      image_url TEXT,
      image_generated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_phase_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id UUID NOT NULL REFERENCES ai_creative_sessions(id) ON DELETE CASCADE,
      phase_number NUMERIC(5,1) NOT NULL,
      phase_name TEXT,
      input_data JSONB,
      output_data JSONB,
      status VARCHAR(30),
      scores JSONB,
      duration_ms INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_generated_content (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id UUID NOT NULL REFERENCES ai_creative_sessions(id) ON DELETE CASCADE,
      post_content TEXT,
      headline TEXT,
      hashtags TEXT,
      image_ratio VARCHAR(20),
      image_style VARCHAR(30),
      image_prompt TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  // Indexes from init.sql, so both startup paths produce the same schema.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts (user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts (status, scheduled_at) WHERE status = 'scheduled'`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_platform_posts_post ON platform_posts (post_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions (expire)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_creative_sessions_user ON ai_creative_sessions (user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_phase_logs_session ON ai_phase_logs (session_id, phase_number)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_generated_content_session ON ai_generated_content (session_id)`);

  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS facebook_page_ids TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS linkedin_target_ids TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS autopilot_generated BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_source VARCHAR(30)`);
  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_batch_id VARCHAR(100)`);
  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_index INTEGER`);
  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_total INTEGER`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_user_autopilot_created ON posts(user_id, autopilot_generated, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_uploads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_name TEXT,
      storage_path TEXT NOT NULL,
      mime_type TEXT,
      file_size BIGINT DEFAULT 0,
      local_url TEXT NOT NULL,
      public_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_media_uploads_user_created ON media_uploads(user_id, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_content_memory (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
      content_text TEXT NOT NULL,
      topic TEXT,
      tone TEXT,
      platforms TEXT[] DEFAULT '{}',
      keywords TEXT[] DEFAULT '{}',
      hook TEXT,
      content_hash TEXT,
      engagement JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, source_post_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_campaigns (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      command TEXT,
      mode VARCHAR(30) DEFAULT 'assisted',
      status VARCHAR(30) DEFAULT 'draft',
      provider VARCHAR(50),
      topic TEXT,
      start_date DATE,
      end_date DATE,
      total_items INTEGER DEFAULT 0,
      posts_per_day INTEGER DEFAULT 1,
      max_posts_per_day INTEGER DEFAULT 4,
      platforms TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_campaign_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      campaign_id UUID NOT NULL REFERENCES ai_campaigns(id) ON DELETE CASCADE,
      source_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
      day_number INTEGER DEFAULT 1,
      sequence_index INTEGER DEFAULT 1,
      title TEXT,
      content TEXT NOT NULL,
      core_content TEXT,
      variations JSONB DEFAULT '{}'::jsonb,
      platform_adaptations JSONB DEFAULT '{}'::jsonb,
      scheduled_at TIMESTAMP WITH TIME ZONE,
      status VARCHAR(30) DEFAULT 'draft',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_quality_signals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      platform VARCHAR(50) NOT NULL,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      engagement_score NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_memory_user_created ON ai_content_memory(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_campaigns_user_created ON ai_campaigns(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_campaign_items_campaign ON ai_campaign_items(campaign_id, sequence_index)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_quality_user_platform ON ai_quality_signals(user_id, platform, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_autopilot_configs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT false,
      topic TEXT DEFAULT '',
      niche TEXT DEFAULT '',
      category TEXT DEFAULT '',
      tone VARCHAR(50) DEFAULT 'professional',
      posts_per_day INTEGER DEFAULT 1,
      platforms TEXT[] DEFAULT '{instagram,linkedin,facebook}',
      text_provider VARCHAR(50),
      image_provider VARCHAR(50),
      selected_template_id UUID,
      facebook_page_ids TEXT[] DEFAULT '{}',
      linkedin_target_ids TEXT[] DEFAULT '{}',
      last_run_on DATE,
      last_run_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_autopilot_runs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      config_id UUID REFERENCES ai_autopilot_configs(id) ON DELETE SET NULL,
      run_date DATE NOT NULL DEFAULT CURRENT_DATE,
      generated_count INTEGER DEFAULT 0,
      scheduled_count INTEGER DEFAULT 0,
      duplicate_count INTEGER DEFAULT 0,
      status VARCHAR(30) DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_autopilot_configs_enabled ON ai_autopilot_configs(enabled, last_run_on)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_autopilot_runs_user_created ON ai_autopilot_runs(user_id, created_at DESC)`);
  await pool.query(`ALTER TABLE ai_autopilot_configs ADD COLUMN IF NOT EXISTS selected_template_id UUID`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS linkedin_feed_runs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      max_posts INTEGER DEFAULT 30,
      captured_posts INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      finished_at TIMESTAMP WITH TIME ZONE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS linkedin_feed_posts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      run_id UUID REFERENCES linkedin_feed_runs(id) ON DELETE SET NULL,
      author TEXT,
      profile_link TEXT,
      post_text TEXT,
      post_link TEXT,
      image_url TEXT,
      comments TEXT,
      posted_time TEXT,
      mentions TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_linkedin_feed_posts_user_created ON linkedin_feed_posts(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_linkedin_feed_runs_user_created ON linkedin_feed_runs(user_id, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pple_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      canvas_width INTEGER DEFAULT 1080,
      canvas_height INTEGER DEFAULT 1080,
      layers JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pple_templates_user_updated ON pple_templates(user_id, updated_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitor_jobs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      keywords TEXT[] NOT NULL DEFAULT '{}',
      platform VARCHAR(50) NOT NULL DEFAULT 'linkedin',
      include_words TEXT[] DEFAULT '{}',
      exclude_words TEXT[] DEFAULT '{}',
      context TEXT,
      auto_run BOOLEAN DEFAULT false,
      run_every_minutes INTEGER DEFAULT 15,
      last_scanned_at TIMESTAMP WITH TIME ZONE,
      last_enqueued_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitor_posts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id UUID NOT NULL REFERENCES monitor_jobs(id) ON DELETE CASCADE,
      platform VARCHAR(50) NOT NULL DEFAULT 'linkedin',
      author TEXT,
      company TEXT,
      job_title TEXT,
      content TEXT NOT NULL,
      url TEXT,
      external_contact TEXT,
      matched_keywords TEXT[] DEFAULT '{}',
      fingerprint_hash TEXT,
      relevance_score NUMERIC(10,2) DEFAULT 0,
      ai_is_hiring BOOLEAN DEFAULT false,
      ai_is_relevant BOOLEAN DEFAULT false,
      duplicate_of UUID REFERENCES monitor_posts(id) ON DELETE SET NULL,
      status VARCHAR(30) DEFAULT 'new',
      scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, fingerprint_hash)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_responses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      post_id UUID NOT NULL UNIQUE REFERENCES monitor_posts(id) ON DELETE CASCADE,
      comment TEXT,
      dm TEXT,
      proposal TEXT,
      tone VARCHAR(50) DEFAULT 'professional',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitor_scan_runs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id UUID NOT NULL REFERENCES monitor_jobs(id) ON DELETE CASCADE,
      queue_job_id TEXT,
      trigger VARCHAR(20) DEFAULT 'manual',
      status VARCHAR(20) DEFAULT 'running',
      started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      finished_at TIMESTAMP WITH TIME ZONE,
      scanned_count INTEGER DEFAULT 0,
      inserted_count INTEGER DEFAULT 0,
      deduped_count INTEGER DEFAULT 0,
      filtered_intent_count INTEGER DEFAULT 0,
      filtered_score_count INTEGER DEFAULT 0,
      sample_candidates JSONB DEFAULT '[]'::jsonb,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_monitor_jobs_user_updated ON monitor_jobs(user_id, updated_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_monitor_jobs_auto_run ON monitor_jobs(auto_run, last_scanned_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_monitor_posts_job_score ON monitor_posts(job_id, relevance_score DESC, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_monitor_posts_user_created ON monitor_posts(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_monitor_scan_runs_job_started ON monitor_scan_runs(job_id, started_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_monitor_scan_runs_user_started ON monitor_scan_runs(user_id, started_at DESC)`);
  await pool.query(`ALTER TABLE monitor_jobs ADD COLUMN IF NOT EXISTS linkedin_session_cookie TEXT`);
}

// Queries the cloudflared sidecar metrics API to discover the quick-tunnel public URL and
// sets process.env.PUBLIC_BACKEND_URL so that media.js and posts.js automatically use it
// for Instagram image resolution.  Runs in the background; never blocks server startup.
async function discoverAndSetTunnelUrl() {
  if (String(process.env.PUBLIC_BACKEND_URL || '').trim()) {
    console.log(`🌐 PUBLIC_BACKEND_URL already configured: ${process.env.PUBLIC_BACKEND_URL}`);
    return;
  }
  const metricsHost = process.env.CLOUDFLARED_METRICS_HOST || 'cloudflared';
  const metricsPort = process.env.CLOUDFLARED_METRICS_PORT || '20000';
  console.log(`🔍 Waiting for Cloudflare tunnel at http://${metricsHost}:${metricsPort}/quicktunnel…`);
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`http://${metricsHost}:${metricsPort}/quicktunnel`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const hostname = data?.hostname;
        if (hostname) {
          process.env.PUBLIC_BACKEND_URL = `https://${hostname}`;
          console.log(`\n✅ Cloudflare Quick Tunnel active: https://${hostname}`);
          console.log(`📸 Instagram media uploads will now resolve at this public URL.\n`);
          return;
        }
      }
    } catch (_) { /* cloudflared not ready yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.warn('\n⚠️  Cloudflare tunnel not detected after 60 s.');
  console.warn('   Instagram image posts require a public URL — add the cloudflared service to');
  console.warn('   docker-compose.yml or set PUBLIC_BACKEND_URL manually.\n');
}

// Phase 1: sequential, not parallel. ensureStarterAccounts inserts
// into users, which runMigrations now creates; running them in
// parallel raced (starter insert could run before users existed).
runMigrations()
  .then(() => ensureStarterAccounts())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 SocialHub backend running on port ${PORT}`);
      postsRouter.startScheduler(pool);
      createMonitorWorker({ db: pool });
      createAutoPilotWorker({ db: pool });
      // Discover cloudflared tunnel URL in the background (non-blocking)
      discoverAndSetTunnelUrl().catch(() => {});
    });
  })
  .catch((err) => {
    console.error('Failed to seed starter accounts:', err);
    process.exit(1);
  });
