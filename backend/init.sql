-- HiSocial Postgres init script (Phase 1, 2026-10-27).
-- Mounted by docker-compose as /docker-entrypoint-initdb.d/init.sql and
-- run once on a fresh database. It creates ONLY the tables the backend
-- does NOT create itself at runtime.
--
-- Already created by backend/src/index.js runMigrations() and therefore
-- NOT duplicated here: media_uploads, ai_content_memory, ai_campaigns,
-- ai_campaign_items, ai_quality_signals, ai_autopilot_configs,
-- ai_autopilot_runs, linkedin_feed_runs, linkedin_feed_posts,
-- pple_templates, monitor_jobs, monitor_posts, ai_responses,
-- monitor_scan_runs. runMigrations() also ALTERs posts; the ALTER columns
-- are included below for a fresh DB and are harmlessly re-applied by
-- the runtime ALTER ... IF NOT EXISTS statements.
--
-- Column sources: every INSERT / UPDATE / WHERE / JOIN / ON CONFLICT
-- reference in backend/src/**/*.js (Phase 1 schema audit). Columns that
-- only ever appear via SELECT * are conventions, not code proofs, and
-- are noted in docs/GATE_PHASE1.md. No password column: app login is
-- the APP_LOGIN_USERNAME / APP_LOGIN_PASSWORD env pair, not a users
-- password.

-- uuid_generate_v4() comes from "uuid-ossp", NOT from pgcrypto
-- (pgcrypto provides gen_random_uuid(), not uuid_generate_v4).
-- Creating pgcrypto alone was the Phase 1 bug: the extension
-- command succeeded, then every table creation failed with
-- 'function uuid_generate_v4() does not exist' (CI 40405772382).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 4: account groups. A group belongs to one app user;
-- a social account belongs to at most one group (group_id).
CREATE TABLE IF NOT EXISTS account_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_account_groups_user ON account_groups (user_id);

CREATE TABLE IF NOT EXISTS custom_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  tier VARCHAR(20) NOT NULL,
  base_url TEXT NOT NULL,
  post_path TEXT,
  api_key TEXT,
  auth_type VARCHAR(30) DEFAULT 'bearer',
  auth_header TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_custom_platforms_user ON custom_platforms (user_id);

CREATE TABLE IF NOT EXISTS ai_provider_tests (
  provider_id TEXT PRIMARY KEY,
  last_status VARCHAR(20) NOT NULL,
  last_detail TEXT,
  last_tested_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL,
  scope_key TEXT NOT NULL,
  task_kind VARCHAR(20) NOT NULL,
  provider_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, scope_type, scope_key, task_kind)
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES account_groups(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  platform_user_id TEXT,
  platform_username TEXT,
  platform_display_name TEXT,
  platform_avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  -- Never written by code; only read as WHERE is_active = true.
  -- The default true is load-bearing: false would hide every account.
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Phase 4: uniqueness is per platform ACCOUNT, not per platform.
  -- Every upsert now uses ON CONFLICT (user_id, platform,
  -- platform_user_id), so a user can hold several accounts on
  -- the same platform (different platform_user_id) while a
  -- re-connect of the same account still updates in place.
  UNIQUE (user_id, platform, platform_user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_group ON social_accounts (group_id);

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
  reddit_subreddit TEXT,
  pinterest_board_id TEXT,
  autopilot_generated BOOLEAN DEFAULT false,
  generation_source VARCHAR(30),
  generation_batch_id VARCHAR(100),
  generation_index INTEGER,
  generation_total INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts (status, scheduled_at)
  WHERE status = 'scheduled';

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
);
-- No UNIQUE(post_id, platform): a post can have multiple attempts /
-- targets per platform (e.g. multiple Facebook pages).
CREATE INDEX IF NOT EXISTS idx_platform_posts_post ON platform_posts (post_id);

-- connect-pg-simple v9 session store schema, exact. The backend sets
-- createTableIfMissing: false, so this table must exist in init.sql.
-- sess is JSON (not JSONB) and expire is plain TIMESTAMP in the
-- library schema; do not "modernise" either.
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions (expire);

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
);
CREATE INDEX IF NOT EXISTS idx_ai_creative_sessions_user ON ai_creative_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_phase_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES ai_creative_sessions(id) ON DELETE CASCADE,
  -- NOT INTEGER: phases 17.1 and 18.1 exist in the AI engine.
  phase_number NUMERIC(5,1) NOT NULL,
  phase_name TEXT,
  input_data JSONB,
  output_data JSONB,
  status VARCHAR(30),
  scores JSONB,
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_phase_logs_session ON ai_phase_logs (session_id, phase_number);

CREATE TABLE IF NOT EXISTS ai_generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES ai_creative_sessions(id) ON DELETE CASCADE,
  post_content TEXT,
  headline TEXT,
  -- Single string (8-12 hashtags as one string), NOT TEXT[].
  hashtags TEXT,
  image_ratio VARCHAR(20),
  image_style VARCHAR(30),
  image_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_session ON ai_generated_content (session_id);
