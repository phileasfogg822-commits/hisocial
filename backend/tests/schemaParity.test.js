// Phase 2: schema-parity regression tests for the Phase 1 bug.
// These are static file checks, not a live database test: they prove
// that backend/init.sql and runMigrations() in backend/src/index.js
// agree on the 8 base tables and on the extension that provides
// uuid_generate_v4(). The Phase 1 failure was exactly a drift here:
// pgcrypto was created, uuid-ossp was not, and every table creation
// failed with 'function uuid_generate_v4() does not exist'.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');

const BASE_TABLES = [
  'users',
  'social_accounts',
  'posts',
  'platform_posts',
  'sessions',
  'ai_creative_sessions',
  'ai_phase_logs',
  'ai_generated_content',
];

function createdTables(sql) {
  return new Set(
    [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]),
  );
}

describe('schema parity (Phase 1 regression)', () => {
  it('init.sql creates all 8 base tables', () => {
    const tables = createdTables(initSql);
    for (const table of BASE_TABLES) {
      assert.ok(tables.has(table), `init.sql missing table ${table}`);
    }
  });

  it('runMigrations() creates all 8 base tables', () => {
    const tables = createdTables(indexJs);
    for (const table of BASE_TABLES) {
      assert.ok(tables.has(table), `runMigrations() missing table ${table}`);
    }
  });

  it('both files use the uuid-ossp extension, not pgcrypto, for uuid_generate_v4', () => {
    assert.match(initSql, /CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/);
    assert.match(indexJs, /CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/);
    assert.doesNotMatch(initSql, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
    assert.doesNotMatch(indexJs, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  });

  it('posts has the columns runMigrations() ALTERs, in init.sql', () => {
    const postsBlock = initSql.match(/CREATE TABLE IF NOT EXISTS posts \(([\s\S]*?)\);/);
    assert.ok(postsBlock, 'init.sql has no posts table');
    for (const column of ['facebook_page_ids', 'linkedin_target_ids', 'autopilot_generated', 'generation_source', 'generation_batch_id', 'generation_index', 'generation_total']) {
      assert.ok(postsBlock[1].includes(column), `posts missing column ${column}`);
    }
  });
});
