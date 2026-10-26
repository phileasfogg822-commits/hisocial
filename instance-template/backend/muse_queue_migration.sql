-- muse_jobs — Muse bridge queue for one HiSocial instance (Phase 0).
-- Apply once per instance database. Idempotent: safe to run twice.
-- Also add the equivalent CREATE TABLE to backend/src/index.js
-- runMigrations() if you want it auto-created on boot (see apply script).

CREATE TABLE IF NOT EXISTS muse_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('image', 'text')),
  prompt TEXT NOT NULL,
  style TEXT,
  size TEXT,
  language VARCHAR(10),
  group_name TEXT,
  account_label TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'done', 'error')),
  lease_token TEXT,
  leased_at TIMESTAMP WITH TIME ZONE,
  lease_expires_at TIMESTAMP WITH TIME ZONE,
  result_text TEXT,
  output JSONB DEFAULT '{}'::jsonb,
  media_path TEXT,
  media_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_muse_jobs_user_created
  ON muse_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_muse_jobs_status_created
  ON muse_jobs(status, created_at ASC);
