// Phase 10: X / Reddit / Pinterest repair tests.
// node:test only, no new dependency. Helpers are pure
// or injected, so these run without the platforms and
// without a database; wiring checks are static, in the
// Phase 4–9 style. Live posting is an owner step, not
// something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateTweet,
  validateSubreddit,
  buildRedditSubmit,
  pinterestDescription,
  isVideoUrl,
  refreshRedditToken,
} = require('../src/utils/xrp');

describe('X post validation', () => {
  it('rejects text over 280 chars and accepts 280', () => {
    assert.equal(validateTweet('x'.repeat(281)).ok, false);
    assert.equal(validateTweet('x'.repeat(280)).ok, true);
    assert.equal(validateTweet('').ok, false);
  });
});

describe('Reddit subreddit validation', () => {
  it('strips a leading r/ and accepts a valid name', () => {
    assert.deepEqual(validateSubreddit('r/technology'), { ok: true, subreddit: 'technology' });
    assert.equal(validateSubreddit('AskReddit').subreddit, 'AskReddit');
  });

  it('rejects missing, short, long, and illegal names — never a fallback', () => {
    for (const bad of ['', 'ab', 'a'.repeat(22), 'bad name', 'bad/sub', 'test!']) {
      assert.equal(validateSubreddit(bad).ok, false, JSON.stringify(bad));
    }
  });

  it('submit payload uses the chosen subreddit and caps the title at 300', () => {
    const payload = buildRedditSubmit({ subreddit: 'technology', content: 't'.repeat(400) });
    assert.equal(payload.sr, 'technology');
    assert.equal(payload.title.length, 300);
    assert.equal(payload.kind, 'self');
  });

  it('refresh posts the refresh grant with basic auth', async () => {
    let seenUrl, seenHeaders;
    const out = await refreshRedditToken({
      refreshToken: 'rt', clientId: 'cid', clientSecret: 'csec',
      httpPost: async (url, data, headers) => {
        seenUrl = url;
        seenHeaders = headers;
        assert.equal(data.get('grant_type'), 'refresh_token');
        return { data: { access_token: 'at2', expires_in: 3600 } };
      },
    });
    assert.equal(seenUrl, 'https://www.reddit.com/api/v1/access_token');
    assert.equal(seenHeaders.Authorization, `Basic ${Buffer.from('cid:csec').toString('base64')}`);
    assert.equal(out.accessToken, 'at2');
    assert.ok(out.expiresAt instanceof Date);
  });
});

describe('Pinterest helpers', () => {
  it('caps descriptions at 800 chars', () => {
    assert.equal(pinterestDescription('d'.repeat(900)).length, 800);
  });

  it('detects video URLs so they fail visibly instead of as image_url', () => {
    assert.equal(isVideoUrl('https://example.com/clip.mp4'), true);
    assert.equal(isVideoUrl('https://example.com/photo.jpg'), false);
    assert.equal(isVideoUrl('https://example.com/clip.mp4?x=1'), true);
  });
});

describe('xrp wiring (static)', () => {
  const postsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'posts.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const initSql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');

  it('no Reddit post can reach r/test anymore', () => {
    assert.doesNotMatch(postsJs, /sr: 'test'/);
    assert.match(postsJs, /postToReddit\(access_token, content, options\.redditSubreddit\)/);
    assert.match(postsJs, /refreshRedditTokenIfNeeded\(/);
    assert.equal((postsJs.match(/refreshRedditTokenIfNeeded\(/g) || []).length, 3);
  });

  it('X uploads media and Pinterest uses the chosen board', () => {
    assert.match(postsJs, /uploadMedia/);
    assert.match(postsJs, /postToPinterest\(access_token, content, mediaUrls, options\.pinterestBoardId\)/);
    assert.match(postsJs, /reddit_subreddit/);
    assert.match(postsJs, /pinterest_board_id/);
  });

  it('posts columns exist in init.sql and runMigrations', () => {
    assert.match(initSql, /reddit_subreddit TEXT/);
    assert.match(initSql, /pinterest_board_id TEXT/);
    assert.match(indexJs, /ALTER TABLE posts ADD COLUMN IF NOT EXISTS reddit_subreddit/);
    assert.match(indexJs, /ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinterest_board_id/);
    assert.match(indexJs, /routes\/pinterest/);
  });

  it('every relative require in backend routes resolves to a real file', () => {
    // Regression guard for the first Phase 10 head: the
    // new pinterest route required a middleware/auth
    // module that does not exist, the backend crashed at
    // startup, and CI failed in "Wait for services".
    const routesDir = path.join(__dirname, '..', 'src', 'routes');
    for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
      for (const match of src.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
        const target = path.resolve(routesDir, match[1]);
        const ok = fs.existsSync(target) || fs.existsSync(`${target}.js`) || fs.existsSync(path.join(target, 'index.js'));
        assert.ok(ok, `${file} requires missing ${match[1]}`);
      }
    }
  });

  it('compose carries subreddit and board fields', () => {
    assert.match(frontendJs, /redditSubreddit/);
    assert.match(frontendJs, /api\/pinterest\/boards/);
    assert.match(frontendJs, /reddit_subreddit:/);
    assert.match(frontendJs, /pinterest_board_id:/);
  });
});
