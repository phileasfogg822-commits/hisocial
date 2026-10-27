const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generateAndPublishPost, generateAndSchedulePost } = require('../services/aiPostGenerator');
const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

function addHostFromUrl(hosts, value) {
  const raw = String(value || '').trim();
  if (!raw) return;

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const parsed = new URL(normalized);
    if (parsed.hostname) hosts.add(String(parsed.hostname).toLowerCase());
  } catch {
    // Ignore invalid URL-like env values
  }
}

function getConfiguredLocalMediaHosts() {
  const hosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal',
    'backend',
    'socialhub_backend',
  ]);

  [
    process.env.LOCAL_BACKEND_URL,
    process.env.PUBLIC_BACKEND_URL,
    process.env.BACKEND_PUBLIC_URL,
    process.env.FRONTEND_URL,
    process.env.REACT_APP_API_URL,
  ].forEach((value) => addHostFromUrl(hosts, value));

  return hosts;
}

const localMediaHosts = getConfiguredLocalMediaHosts();

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

router.get('/facebook/pages', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const tokenResult = await db.query(
      `SELECT access_token
       FROM social_accounts
       WHERE user_id=$1 AND platform='facebook' AND is_active=true
       LIMIT 1`,
      [req.user.id]
    );

    const accessToken = tokenResult.rows[0]?.access_token;
    if (!accessToken) {
      return res.status(400).json({ error: 'Facebook is not connected for this account' });
    }

    const pages = await listFacebookPages(accessToken);
    res.json(
      pages.map((page) => ({
        id: page.id,
        name: page.name
      }))
    );
  } catch (e) {
    console.error('Facebook pages error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/linkedin/targets', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const tokenResult = await db.query(
      `SELECT platform, platform_user_id, access_token, scope
       FROM social_accounts
       WHERE user_id=$1 AND platform IN ('linkedin','linkedin_page') AND is_active=true`,
      [req.user.id]
    );

    const liRow = tokenResult.rows.find((r) => r.platform === 'linkedin');
    const pageRows = tokenResult.rows.filter((r) => r.platform === 'linkedin_page');
    const pageRow = pageRows[0];

    if (!liRow?.access_token && !pageRow?.access_token) {
      return res.status(400).json({ error: 'LinkedIn is not connected for this account' });
    }

    const { orgTargetsFromPageAccounts } = require('./utils/linkedin');
    const targets = await listLinkedInTargets(
      liRow?.access_token || null,
      pageRow?.access_token || null,
      liRow?.scope || '',
      orgTargetsFromPageAccounts(pageRows).map((t) => t.replace('organization:', ''))
    );
    res.json(targets);
  } catch (e) {
    console.error('LinkedIn targets error:', e.response?.data || e.message);
    res.status(500).json({ error: e.message });
  }
});

// Visual calendar: posts for a given month
router.get('/calendar', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { year, month } = req.query;
  const y = parseInt(year) || new Date().getFullYear();
  const m = parseInt(month) || (new Date().getMonth() + 1);
  const start = new Date(y, m - 1, 1).toISOString();
  const end = new Date(y, m, 0, 23, 59, 59).toISOString();

  try {
    const result = await db.query(
      `SELECT p.*,
       json_agg(json_build_object(
         'platform', pp.platform, 'status', pp.status,
         'platform_post_url', pp.platform_post_url
       )) FILTER (WHERE pp.id IS NOT NULL) as platform_results
       FROM posts p
       LEFT JOIN platform_posts pp ON pp.post_id = p.id
       WHERE p.user_id = $1
         AND (
           (p.scheduled_at >= $2 AND p.scheduled_at <= $3)
           OR (p.published_at >= $2 AND p.published_at <= $3)
           OR (p.created_at >= $2 AND p.created_at <= $3)
         )
       GROUP BY p.id
       ORDER BY COALESCE(p.scheduled_at, p.published_at, p.created_at) ASC`,
      [req.user.id, start, end]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update scheduled post
router.put('/:postId', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { postId } = req.params;
  
  // Extract both traditional and AI Creative Engine parameters
  const { 
    content, 
    media_urls, 
    platforms, 
    scheduled_at, 
    facebook_page_ids, 
    linkedin_target_ids,
    reddit_subreddit,
    pinterest_board_id,
    // AI Creative Engine parameters
    tone, 
    niche, 
    category, 
    topic, 
    provider = 'gemini'
  } = req.body;

  try {
    const existingResult = await db.query(
      `SELECT * FROM posts WHERE id=$1 AND user_id=$2`,
      [postId, req.user.id]
    );
    const existing = existingResult.rows[0];

    if (!existing) return res.status(404).json({ error: 'Post not found' });
    if (existing.status !== 'scheduled') return res.status(400).json({ error: 'Only scheduled posts can be edited here' });

    // Check if AI Creative Engine should be used based on presence of AI parameters
    const shouldUseAICreativeEngine = (tone || niche || category || topic) && !content;
    
    if (shouldUseAICreativeEngine) {
      // Use AI Creative Engine to regenerate content
      const aiPostGenerator = require('../services/aiPostGenerator');
      const aiResult = await aiPostGenerator.generatePostWithAI({
        tone: tone || 'professional',
        niche: niche || '',
        category: category || '',
        topic: topic || 'general',
        provider: provider || 'gemini'
      }, req.user.id, db);

      // Use the AI-generated content
      const nextContent = aiResult.content.post_content;
      const nextMediaUrls = aiResult.content.generated_image_url ? [aiResult.content.generated_image_url] : (Array.isArray(media_urls) ? media_urls : (existing.media_urls || []));
      const nextPlatforms = Array.isArray(platforms) && platforms.length > 0 ? platforms : (existing.platforms || []);
      const nextFacebookPageIds = Array.isArray(facebook_page_ids) ? facebook_page_ids.map(String).filter(Boolean) : (existing.facebook_page_ids || []);
      const nextLinkedInTargetIds = Array.isArray(linkedin_target_ids) ? linkedin_target_ids.map(String).filter(Boolean) : (existing.linkedin_target_ids || []);
      const nextScheduledAt = scheduled_at ? new Date(scheduled_at) : new Date(existing.scheduled_at);

      if (isNaN(nextScheduledAt.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled_at value' });
      }
      if (nextScheduledAt <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }

      // Phase 10: keep the new targeting fields on edit.
      const { validateSubreddit } = require('./utils/xrp');
      let nextRedditSubreddit = existing.reddit_subreddit || null;
      if (nextPlatforms.includes('reddit')) {
        if (typeof reddit_subreddit === 'string') {
          const checked = validateSubreddit(reddit_subreddit);
          if (!checked.ok) return res.status(400).json({ error: checked.error });
          nextRedditSubreddit = checked.subreddit;
        }
        if (!nextRedditSubreddit) return res.status(400).json({ error: 'Enter a subreddit for Reddit' });
      }
      const nextPinterestBoardId = typeof pinterest_board_id === 'string' && pinterest_board_id
        ? pinterest_board_id : (existing.pinterest_board_id || null);

      const updatedRes = await db.query(
        `UPDATE posts
         SET content=$1, media_urls=$2, platforms=$3, scheduled_at=$4, facebook_page_ids=$5, linkedin_target_ids=$6, reddit_subreddit=$7, pinterest_board_id=$8, updated_at=NOW()
         WHERE id=$9 AND user_id=$10
         RETURNING *`,
        [
          nextContent,
          nextMediaUrls,
          nextPlatforms,
          nextScheduledAt,
          nextFacebookPageIds,
          nextLinkedInTargetIds,
          nextRedditSubreddit,
          nextPinterestBoardId,
          postId,
          req.user.id
        ]
      );

      res.json({ post: updatedRes.rows[0] });
    } else {
      // Traditional update flow
      const nextContent = typeof content === 'string' ? content : existing.content;
      const nextMediaUrls = Array.isArray(media_urls) ? media_urls : (existing.media_urls || []);
      const nextPlatforms = Array.isArray(platforms) && platforms.length > 0 ? platforms : (existing.platforms || []);
      const nextFacebookPageIds = Array.isArray(facebook_page_ids) ? facebook_page_ids.map(String).filter(Boolean) : (existing.facebook_page_ids || []);
      const nextLinkedInTargetIds = Array.isArray(linkedin_target_ids) ? linkedin_target_ids.map(String).filter(Boolean) : (existing.linkedin_target_ids || []);
      const nextScheduledAt = scheduled_at ? new Date(scheduled_at) : new Date(existing.scheduled_at);

      if (isNaN(nextScheduledAt.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled_at value' });
      }
      if (nextScheduledAt <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }

      // Phase 10: keep the new targeting fields on edit.
      const { validateSubreddit } = require('./utils/xrp');
      let nextRedditSubreddit = existing.reddit_subreddit || null;
      if (nextPlatforms.includes('reddit')) {
        if (typeof reddit_subreddit === 'string') {
          const checked = validateSubreddit(reddit_subreddit);
          if (!checked.ok) return res.status(400).json({ error: checked.error });
          nextRedditSubreddit = checked.subreddit;
        }
        if (!nextRedditSubreddit) return res.status(400).json({ error: 'Enter a subreddit for Reddit' });
      }
      const nextPinterestBoardId = typeof pinterest_board_id === 'string' && pinterest_board_id
        ? pinterest_board_id : (existing.pinterest_board_id || null);

      const updatedRes = await db.query(
        `UPDATE posts
         SET content=$1, media_urls=$2, platforms=$3, scheduled_at=$4, facebook_page_ids=$5, linkedin_target_ids=$6, reddit_subreddit=$7, pinterest_board_id=$8, updated_at=NOW()
         WHERE id=$9 AND user_id=$10
         RETURNING *`,
        [
          nextContent,
          nextMediaUrls,
          nextPlatforms,
          nextScheduledAt,
          nextFacebookPageIds,
          nextLinkedInTargetIds,
          nextRedditSubreddit,
          nextPinterestBoardId,
          postId,
          req.user.id
        ]
      );

      res.json({ post: updatedRes.rows[0] });
    }
  } catch (e) {
    console.error('Update scheduled post error:', e.message);
    res.status(500).json({ error: 'Failed to update scheduled post' });
  }
});

router.delete('/:postId', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { postId } = req.params;

  try {
    const deleted = await db.query(
      `DELETE FROM posts
       WHERE id = $1 AND user_id = $2 AND status = 'scheduled'
       RETURNING id`,
      [postId, req.user.id]
    );

    if (!deleted.rows[0]) {
      return res.status(400).json({ error: 'Only scheduled posts can be deleted or post not found' });
    }

    res.json({ deleted: true, id: deleted.rows[0].id });
  } catch (e) {
    console.error('Delete scheduled post error:', e.message);
    res.status(500).json({ error: 'Failed to delete scheduled post' });
  }
});

router.post('/:postId/post-now', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { postId } = req.params;

  try {
    const existingRes = await db.query(
      `SELECT * FROM posts WHERE id = $1 AND user_id = $2`,
      [postId, req.user.id]
    );
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: 'Post not found' });

    if (!['scheduled', 'draft', 'failed'].includes(existing.status)) {
      return res.status(400).json({ error: `Post cannot be published now from status '${existing.status}'` });
    }

    const claimRes = await db.query(
      `UPDATE posts
       SET status='posting', scheduled_at=NULL, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [postId, req.user.id]
    );
    const claimedPost = claimRes.rows[0];

    const publishResult = await publishStoredPost(db, claimedPost);
    res.json({ post: publishResult.post, results: publishResult.results });
  } catch (e) {
    console.error('Post-now error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to publish scheduled post now' });
  }
});

// Create and publish a post
router.post('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const {
    content,
    platforms,
    media_urls,
    facebook_page_id,
    facebook_page_ids,
    linkedin_target_ids,
    reddit_subreddit,
    pinterest_board_id,
    scheduled_at,
    generation_source = 'manual',
    generation_batch_id,
    generation_index = 1,
    generation_total = 1,
    // AI Creative Engine parameters
    tone,
    niche,
    category,
    topic,
    provider = 'gemini',
    // Additional parameters for V2 engine
    heading = '',
    post_text = '',
    hashtags = [],
    ratio = '1:1',
    style = 'modern',
    useEngine = false,
    enhanceWithGemini = false
  } = req.body;

  // Validate platforms
  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ 
      error: 'At least one platform is required' 
    });
  }

  const generationSource = String(generation_source || '').trim() || null;
  const generationBatchId = String(generation_batch_id || '').trim() || null;
  const generationIndex = Number.isFinite(Number(generation_index)) ? Math.max(1, Number(generation_index)) : null;
  const generationTotal = Number.isFinite(Number(generation_total)) ? Math.max(1, Number(generation_total)) : null;

  const normalizedFacebookPageIds = Array.isArray(facebook_page_ids)
    ? facebook_page_ids.map((pageId) => String(pageId)).filter(Boolean)
    : (facebook_page_id ? [String(facebook_page_id)] : []);

  const normalizedLinkedInTargetIds = Array.isArray(linkedin_target_ids)
    ? linkedin_target_ids.map((targetId) => String(targetId)).filter(Boolean)
    : [];

  // Phase 10: Reddit needs a real subreddit per post;
  // validate here so a bad value is a 400, not a post
  // that later fails (or, as before, lands in r/test).
  const { validateSubreddit } = require('./utils/xrp');
  let normalizedRedditSubreddit = null;
  if (platforms.includes('reddit')) {
    const checked = validateSubreddit(reddit_subreddit);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    normalizedRedditSubreddit = checked.subreddit;
  }
  const normalizedPinterestBoardId = pinterest_board_id ? String(pinterest_board_id) : null;

  // Check if this is an AI-powered post generation request
  const shouldUseAICreativeEngine = (tone || niche || category || topic) && !content;

  if (shouldUseAICreativeEngine) {
    // Validate required AI parameters
    if (!tone || !niche || !category || !topic) {
      return res.status(400).json({ 
        error: 'Missing required AI Creative Engine parameters. All of tone, niche, category, and topic are required.' 
      });
    }

    try {
      // Use AI Creative Engine to generate content and create post
      if (scheduled_at) {
        // Generate and schedule the post using AI Creative Engine
        const result = await generateAndSchedulePost(
          { 
            tone: tone || 'professional',
            niche: niche || '',
            category: category || '',
            topic: topic || 'general',
            platforms,
            scheduled_at,
            provider: provider || 'gemini',
            heading,
            post_text,
            hashtags,
            ratio,
            style,
            useEngine,
            enhanceWithGemini
          },
          req.user.id,
          db
        );
        return res.json(result);
      } else {
        // Generate and publish the post using AI Creative Engine
        const result = await generateAndPublishPost(
          { 
            tone: tone || 'professional',
            niche: niche || '',
            category: category || '',
            topic: topic || 'general',
            platforms,
            provider: provider || 'gemini',
            heading,
            post_text,
            hashtags,
            ratio,
            style,
            useEngine,
            enhanceWithGemini
          },
          req.user.id,
          db,
          postToPlatform
        );
        return res.json(result);
      }
    } catch (e) {
      console.error('AI Post generation error:', e);
      return res.status(500).json({ 
        error: e.message || 'Failed to generate post with AI Creative Engine' 
      });
    }
  }

  // Traditional post flow continues for non-AI posts
  if (!content) {
    return res.status(400).json({ 
      error: 'Content is required for manual posts' 
    });
  }

  // If scheduled_at is in the future, save as scheduled and return immediately
  const scheduledDate = scheduled_at ? new Date(scheduled_at) : null;
  const isScheduled = scheduledDate && scheduledDate > new Date();

  try {
    if (isScheduled) {
      const postResult = await db.query(
        `INSERT INTO posts 
         (user_id, content, platforms, media_urls, status, scheduled_at, 
          facebook_page_ids, linkedin_target_ids, reddit_subreddit,
          pinterest_board_id, generation_source, 
          generation_batch_id, generation_index, generation_total)
         VALUES ($1,$2,$3,$4,'scheduled',$5,$6,$7,$8,$9,$10,$11,$12,$13) 
         RETURNING *`,
        [
          req.user.id,
          content,
          platforms,
          media_urls || [],
          scheduledDate,
          normalizedFacebookPageIds,
          normalizedLinkedInTargetIds,
          normalizedRedditSubreddit,
          normalizedPinterestBoardId,
          generationSource,
          generationBatchId,
          generationIndex,
          generationTotal,
        ]
      );
      return res.json({ 
        post: postResult.rows[0], 
        results: [], 
        scheduled: true 
      });
    }

    // Get user's tokens for selected platforms (also always fetch linkedin_page for org posting)
    const platformsToQuery = platforms.includes('linkedin')
      ? [...new Set([...platforms, 'linkedin_page'])]
      : platforms;
      
    const tokensResult = await db.query(
      `SELECT platform, access_token, refresh_token, platform_user_id, platform_username, scope, token_expires_at
       FROM social_accounts 
       WHERE user_id=$1 AND platform=ANY($2) AND is_active=true`,
      [req.user.id, platformsToQuery]
    );

    const tokens = {};
    tokensResult.rows.forEach(r => { tokens[r.platform] = r; });

    // Phase 7: every stored linkedin_page row (one per
    // admin'd org), not just the one the tokens map kept.
    let linkedInPageAccounts = [];
    if (platforms.includes('linkedin')) {
      const pageResult = await db.query(
        `SELECT platform_user_id, access_token FROM social_accounts
         WHERE user_id=$1 AND platform='linkedin_page' AND is_active=true`,
        [req.user.id]
      );
      linkedInPageAccounts = pageResult.rows;
    }

    // Phase 8: refresh an expired YouTube token before posting.
    if (platforms.includes('youtube') && tokens['youtube']) {
      tokens['youtube'] = await refreshYouTubeTokenIfNeeded(db, req.user.id, tokens['youtube']);
    }

    // Phase 9: TikTok tokens live only 24 hours, so this
    // refresh is mandatory, not optional.
    if (platforms.includes('tiktok') && tokens['tiktok']) {
      tokens['tiktok'] = await refreshTikTokTokenIfNeeded(db, req.user.id, tokens['tiktok']);
    }

    // Phase 10: Reddit tokens live 1 hour and were never
    // refreshed, so Reddit broke an hour after connect.
    if (platforms.includes('reddit') && tokens['reddit']) {
      tokens['reddit'] = await refreshRedditTokenIfNeeded(db, req.user.id, tokens['reddit']);
    }

    // Create post record
    const postResult = await db.query(
      `INSERT INTO posts 
         (user_id, content, platforms, media_urls, status, facebook_page_ids, 
          linkedin_target_ids, reddit_subreddit, pinterest_board_id,
          generation_source, generation_batch_id, 
          generation_index, generation_total)
         VALUES ($1,$2,$3,$4,'posting',$5,$6,$7,$8,$9,$10,$11,$12) 
         RETURNING *`,
      [
        req.user.id,
        content,
        platforms,
        media_urls || [],
        normalizedFacebookPageIds,
        normalizedLinkedInTargetIds,
        normalizedRedditSubreddit,
        normalizedPinterestBoardId,
        generationSource,
        generationBatchId,
        generationIndex,
        generationTotal,
      ]
    );
    const post = postResult.rows[0];

    // Post to each platform
    const results = await Promise.allSettled(
      platforms.map((platform) => postToPlatform(platform, tokens[platform], content, media_urls, {
        facebookPageIds: normalizedFacebookPageIds,
        linkedinTargetIds: normalizedLinkedInTargetIds,
        linkedInPageToken: tokens['linkedin_page']?.access_token || null,
        linkedInPageAccounts,
        redditSubreddit: normalizedRedditSubreddit,
        pinterestBoardId: normalizedPinterestBoardId
      }))
    );

    // Record results
    const platformResults = [];
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      const result = results[i];
      const attemptResults = normalizeAttemptResults(platform, result);

      for (const attempt of attemptResults) {
        const success = attempt.status === 'success';
        const pr = await db.query(
          `INSERT INTO platform_posts 
           (post_id, platform, platform_post_id, platform_post_url, status, 
            error_message, posted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) 
           RETURNING *`,
          [post.id, attempt.platform,
           success ? attempt.id : null,
           success ? attempt.url : null,
           attempt.status,
           success ? null : (attempt.error_message || 'Unknown error'),
           success ? new Date() : null]
        );

        platformResults.push({
          ...pr.rows[0],
          target_name: attempt.target_name || null
        });
      }
    }

    const allSuccess = platformResults.length > 0 && platformResults.every((r) => r.status === 'success');
    const anySuccess = platformResults.some((r) => r.status === 'success');
    const finalStatus = allSuccess ? 'published' : (anySuccess ? 'partial' : 'failed');

    await db.query(
      'UPDATE posts SET status=$1, published_at=$2 WHERE id=$3',
      [finalStatus, anySuccess ? new Date() : null, post.id]
    );

    if (anySuccess) {
      const keywords = extractKeywords(content);
      const hook = content.split(/[.!?\n]/).map((part) => part.trim()).filter(Boolean)[0] || content.slice(0, 120);
      const successfulPlatforms = [...new Set(platformResults.filter((row) => row.status === 'success').map((row) => row.platform))];

      await db.query(
        `INSERT INTO ai_content_memory
         (user_id, source_post_id, content_text, topic, tone, platforms, keywords, hook, content_hash, engagement, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (user_id, source_post_id) DO NOTHING`,
        [
          req.user.id,
          post.id,
          content,
          keywords.slice(0, 4).join(', ') || 'general',
          inferTone(content),
          successfulPlatforms,
          keywords,
          hook,
          simpleHash(content),
          JSON.stringify({}),
          new Date()
        ]
      );
    }

    res.json({
      post: { ...post, status: finalStatus },
      results: platformResults
    });
  } catch (e) {
    console.error('Post error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Phase 8: refresh a YouTube access token when it is
// expired (or has no recorded expiry and a refresh token
// exists — the safe side for uploads). Best-effort: on
// refresh failure the old token is kept and the upload
// fails visibly, instead of the post silently dropping.
async function refreshYouTubeTokenIfNeeded(db, userId, tokenRow) {
  if (!tokenRow || !tokenRow.refresh_token) return tokenRow;
  const expiresAt = tokenRow.token_expires_at ? new Date(tokenRow.token_expires_at).getTime() : NaN;
  if (!Number.isNaN(expiresAt) && expiresAt > Date.now() + 5 * 60 * 1000) return tokenRow;
  try {
    const { refreshAccessToken } = require('./utils/youtube');
    const refreshed = await refreshAccessToken({
      refreshToken: tokenRow.refresh_token,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    await db.query(
      `UPDATE social_accounts SET access_token=$1, token_expires_at=$2, updated_at=NOW()
       WHERE user_id=$3 AND platform='youtube' AND platform_user_id=$4`,
      [refreshed.accessToken, refreshed.expiresAt, userId, tokenRow.platform_user_id]
    );
    return { ...tokenRow, access_token: refreshed.accessToken, token_expires_at: refreshed.expiresAt };
  } catch (e) {
    console.warn('YouTube token refresh failed:', e.response?.data || e.message);
    return tokenRow;
  }
}

// Phase 8: YouTube upload. The video bytes are fetched
// server-side from the post's first video URL, then
// uploaded via the resumable protocol. Privacy defaults
// to private (see utils/youtube.js).
async function postToYouTube(accessToken, content, mediaUrls) {
  const { pickVideoUrl, buildVideoMetadata, contentTypeForUrl, uploadVideo } = require('./utils/youtube');
  const videoUrl = pickVideoUrl(mediaUrls);
  if (!videoUrl) {
    throw new Error('YouTube needs a video — attach a video file URL to the post.');
  }
  const axios = require('axios');
  const res = await axios.get(videoUrl, { responseType: 'arraybuffer' });
  const uploaded = await uploadVideo({
    accessToken,
    videoBuffer: Buffer.from(res.data),
    contentType: contentTypeForUrl(videoUrl),
    metadata: buildVideoMetadata(content),
  });
  return { status: 'success', id: uploaded.id, url: uploaded.url, target_name: 'YouTube' };
}

// Phase 9: refresh a TikTok access token when it is
// expired or has no recorded expiry (tokens live only
// 24 hours, so this is mandatory, not best-effort
// polish). On refresh failure the old token is kept
// and the upload fails visibly. A rotated refresh token
// is stored when TikTok returns one.
async function refreshTikTokTokenIfNeeded(db, userId, tokenRow) {
  if (!tokenRow || !tokenRow.refresh_token) return tokenRow;
  const expiresAt = tokenRow.token_expires_at ? new Date(tokenRow.token_expires_at).getTime() : NaN;
  if (!Number.isNaN(expiresAt) && expiresAt > Date.now() + 5 * 60 * 1000) return tokenRow;
  try {
    const { refreshAccessToken } = require('./utils/tiktok');
    const refreshed = await refreshAccessToken({
      refreshToken: tokenRow.refresh_token,
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    });
    await db.query(
      `UPDATE social_accounts SET access_token=$1, refresh_token=CASE WHEN $2 IS NULL THEN refresh_token ELSE $2 END,
       token_expires_at=$3, updated_at=NOW()
       WHERE user_id=$4 AND platform='tiktok' AND platform_user_id=$5`,
      [refreshed.accessToken, refreshed.refreshToken, refreshed.expiresAt, userId, tokenRow.platform_user_id]
    );
    return {
      ...tokenRow,
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken || tokenRow.refresh_token,
      token_expires_at: refreshed.expiresAt,
    };
  } catch (e) {
    console.warn('TikTok token refresh failed:', e.response?.data || e.message);
    return tokenRow;
  }
}

// Phase 9: TikTok direct post. Bytes are fetched
// server-side from the post's first video URL, init'd,
// uploaded in chunks, then polled until TikTok reports
// PUBLISH_COMPLETE. If polling times out while TikTok
// is still processing, the attempt is recorded as
// 'processing' with the publish_id — NOT as success —
// so a later retry does not silently duplicate, and the
// record says exactly what happened.
async function postToTikTok(accessToken, content, mediaUrls) {
  const { pickVideoUrl } = require('./utils/youtube');
  const { buildPostInfo, initVideoPost, fetchPublishStatus, chunkPlan } = require('./utils/tiktok');
  const videoUrl = pickVideoUrl(mediaUrls);
  if (!videoUrl) {
    throw new Error('TikTok needs a video — attach a video file URL to the post.');
  }
  const axios = require('axios');
  const res = await axios.get(videoUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(res.data);
  const { publishId, uploadUrl } = await initVideoPost({
    accessToken,
    postInfo: buildPostInfo(content),
    videoSize: buffer.length,
  });
  const chunks = chunkPlan(buffer.length);
  for (const chunk of chunks) {
    await axios.put(uploadUrl, buffer.subarray(chunk.start, chunk.end + 1), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': chunk.range,
      },
    });
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(attempt === 0 ? 5000 : 10000);
    const status = await fetchPublishStatus({ accessToken, publishId });
    const state = String(status.status || '').toUpperCase();
    if (state === 'PUBLISH_COMPLETE') {
      return { status: 'success', id: publishId, url: null, target_name: 'TikTok' };
    }
    if (state === 'FAILED') {
      throw new Error(`TikTok publish failed: ${status.fail_reason || 'unknown reason'}`);
    }
  }
  return {
    status: 'processing',
    id: publishId,
    error_message: `TikTok accepted the upload and is still processing it (publish_id ${publishId}). Check TikTok before retrying to avoid a duplicate.`,
  };
}

async function postToPlatform(platform, tokenData, content, mediaUrls, options = {}) {
  if (!tokenData) throw new Error(`Not connected to ${platform}`);
  
  const { access_token, refresh_token, platform_user_id, scope } = tokenData;

  try {
    switch (platform) {
      case 'facebook':
        return await postToFacebook(access_token, content, mediaUrls, options.facebookPageIds || []);
      case 'twitter':
        return await postToTwitter(access_token, refresh_token, content, mediaUrls);
      case 'linkedin':
        return await postToLinkedIn(access_token, platform_user_id, content, mediaUrls, options.linkedinTargetIds || [], scope || '', options.linkedInPageToken || null, options.linkedInPageAccounts || []);
      case 'reddit':
        return await postToReddit(access_token, content, options.redditSubreddit);
      case 'instagram':
        return await postToInstagram(access_token, platform_user_id, content, mediaUrls);
      case 'pinterest':
        return await postToPinterest(access_token, content, mediaUrls, options.pinterestBoardId);
      case 'youtube':
        return await postToYouTube(access_token, content, mediaUrls);
      case 'tiktok':
        return await postToTikTok(access_token, content, mediaUrls);
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  } catch (err) {
    throw toPlatformError(platform, err);
  }
}

async function listFacebookPages(accessToken) {
  const pagesRes = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
    params: {
      access_token: accessToken,
      fields: 'id,name,access_token'
    }
  });

  return pagesRes.data?.data || [];
}

function hasLinkedInOrgScopes(grantedScope = '') {
  const normalized = String(grantedScope)
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return normalized.includes('rw_organization_admin') && normalized.includes('w_organization_social');
}

function extractKeywords(text = '') {
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'your', 'about', 'into', 'their', 'there', 'would', 'could', 'should', 'what', 'when', 'where', 'which', 'while', 'were', 'will', 'them', 'than', 'then', 'because', 'just', 'also', 'very', 'more', 'some', 'only', 'other', 'each', 'many', 'most', 'such']);
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 3)
    .filter((word) => !stopWords.has(word));

  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word]) => word);
}

function inferTone(text = '') {
  const normalized = String(text).toLowerCase();
  if (/(must|warning|critical|urgent)/.test(normalized)) return 'serious';
  if (/(inspire|dream|believe|journey)/.test(normalized)) return 'inspirational';
  if (/(lol|fun|joke|😂|🤣)/.test(normalized)) return 'casual';
  return 'professional';
}

function simpleHash(text = '') {
  let hash = 0;
  const value = String(text);
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

async function listLinkedInTargets(accessToken, orgAccessToken = null, grantedScope = '', orgIds = []) {
  const targets = [];

  // Fetch personal profile if we have a personal token
  if (accessToken) {
    try {
      const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const profile = profileRes.data || {};
      const profileId = profile.sub;
      if (profileId) {
        targets.push({
          id: `person:${profileId}`,
          name: profile.name || profile.email || 'My LinkedIn profile',
          type: 'profile'
        });
      }
    } catch (err) {
      console.warn('LinkedIn profile fetch failed:', err.response?.data || err.message);
    }
  }

  // Phase 7: company targets come from STORED linkedin_page
  // rows (one per admin'd org), never from a
  // LINKEDIN_COMPANY_ID env var. The old env-var path
  // meant no company target when the var was unset, and a
  // wrong target when it named an org the token does not
  // administer. Invalid stored ids (e.g. the old 'pages'
  // rows) are skipped by the helper.
  if (orgAccessToken && orgIds.length > 0) {
    const { normalizeOrgId } = require('./utils/linkedin');
    const validIds = [...new Set(orgIds.map((id) => normalizeOrgId(id)).filter(Boolean))];
    for (const companyId of validIds) {
      let orgName = `Organization ${companyId}`;
      try {
        const orgRes = await axios.get(`https://api.linkedin.com/v2/organizations/${companyId}`, {
          params: { projection: '(localizedName,vanityName)' },
          headers: {
            Authorization: `Bearer ${orgAccessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });
        orgName = orgRes.data?.localizedName || orgRes.data?.vanityName || orgName;
      } catch (err) {
        console.warn('LinkedIn org name fetch failed, using ID:', err.response?.data || err.message);
      }
      targets.push({
        id: `organization:${companyId}`,
        name: orgName,
        type: 'organization'
      });
    }
  }

  if (targets.length === 0) {
    throw new Error('No LinkedIn targets available. Connect LinkedIn first.');
  }

  return targets;
}

function normalizeAttemptResults(platform, result) {
  if (result.status === 'rejected') {
    return [{
      platform,
      status: 'failed',
      error_message: result.reason?.message || 'Unknown error'
    }];
  }

  const values = Array.isArray(result.value) ? result.value : [result.value];
  return values.map((value) => ({
    platform,
    status: value.status || 'success',
    id: value.id || null,
    url: value.url || null,
    error_message: value.error_message || null,
    target_name: value.target_name || null
  }));
}

async function publishToFacebookPage(page, content, mediaUrls) {
  const pageId = page.id;
  const pageToken = page.access_token;

  if (mediaUrls && mediaUrls.length > 0) {
    // Step 1: Upload each image as unpublished so we get a photo_id to attach.
    // Posting directly to /photos with published=true puts the image only in
    // the Photos section of the page — NOT in the feed/timeline.
    const photoIds = [];
    for (const mediaUrl of mediaUrls) {
      const media = await loadMediaBinary(mediaUrl);
      const formData = new FormData();
      formData.append('published', 'false'); // unpublished — will be attached to feed post
      formData.append('access_token', pageToken);
      formData.append('source', new Blob([media.buffer], { type: media.contentType }), media.filename);

      const uploadRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
        method: 'POST',
        body: formData,
      });

      const uploadPayload = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadPayload?.error?.message || `Facebook API ${uploadRes.status}: failed to upload image`);
      }
      photoIds.push(uploadPayload.id);
    }

    // Step 2: Create the actual feed/timeline post with all images attached.
    // This makes the post appear in the page's Posts feed like a normal post.
    const feedBody = new URLSearchParams();
    feedBody.append('message', content || '');
    feedBody.append('access_token', pageToken);
    photoIds.forEach((pid, index) => {
      feedBody.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: pid }));
    });

    const feedRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: feedBody.toString(),
    });

    const feedPayload = await feedRes.json().catch(() => ({}));
    if (!feedRes.ok) {
      throw new Error(feedPayload?.error?.message || `Facebook API ${feedRes.status}: failed to create feed post`);
    }

    const postId = feedPayload.id;
    return {
      id: postId,
      url: `https://www.facebook.com/${pageId}/posts/${postId?.split('_')[1] || postId}`,
      target_name: page.name
    };
  }

  // Text-only post
  const res = await axios.post(
    `https://graph.facebook.com/v18.0/${pageId}/feed`,
    { message: content, access_token: pageToken }
  );

  return {
    id: res.data.id,
    url: `https://www.facebook.com/${res.data.id}`,
    target_name: page.name
  };
}

async function postToFacebook(accessToken, content, mediaUrls, selectedPageIds) {
  const pages = await listFacebookPages(accessToken);

  if (pages.length === 0) {
    throw new Error(
      'No Facebook Page available for posting. Connect an account that manages a Page and grant pages permissions (pages_show_list, pages_manage_posts).'
    );
  }

  if ((!selectedPageIds || selectedPageIds.length === 0) && pages.length > 1) {
    throw new Error('Select at least one Facebook Page before posting.');
  }

  const chosenPages = selectedPageIds && selectedPageIds.length > 0
    ? pages.filter((page) => selectedPageIds.includes(page.id))
    : [pages[0]];

  if (chosenPages.length === 0) {
    throw new Error('The selected Facebook Page is no longer available. Refresh the page list and try again.');
  }

  const publishResults = await Promise.allSettled(
    chosenPages.map((page) => publishToFacebookPage(page, content, mediaUrls))
  );

  return publishResults.map((result, index) => {
    const page = chosenPages[index];
    if (result.status === 'fulfilled') {
      return {
        ...result.value,
        status: 'success',
        target_name: result.value.target_name || page.name
      };
    }

    return {
      status: 'failed',
      error_message: toPlatformError('facebook', result.reason).message,
      target_name: page.name
    };
  });
}

function toPlatformError(platform, err) {
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  if (axios.isAxiosError(err) && err.response) {
    const status = err.response.status;
    const data = err.response.data;
    const apiError = data?.error;
    const apiMessage =
      apiError?.message ||
      data?.error_description ||
      err.response.statusText ||
      err.message;

    const details = JSON.stringify(data);
    const truncated = details.length > 800 ? details.slice(0, 800) + '…' : details;

    return new Error(`${platformName} API ${status}: ${apiMessage} (${truncated})`);
  }

  return err instanceof Error ? err : new Error(String(err));
}

async function postToTwitter(accessToken, accessSecret, content, mediaUrls) {
  // Twitter API v2 - OAuth 1.0a for user context
  // Phase 10: the old version ignored mediaUrls entirely,
  // silently dropping every image/video attached to an X
  // post. Media is now uploaded first (images up to 4, or
  // a single video) and attached to the tweet; text over
  // 280 chars fails visibly instead of failing at the API
  // with a cryptic error.
  const { validateTweet, isVideoUrl, mimeTypeForUrl } = require('./utils/xrp');
  const checked = validateTweet(content);
  if (!checked.ok) throw new Error(checked.error);
  const { TwitterApi } = require('twitter-api-v2').default || require('twitter-api-v2');
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken,
    accessSecret
  });
  const mediaIds = [];
  const urls = (mediaUrls || []).filter(Boolean);
  if (urls.length > 0) {
    const videos = urls.filter(isVideoUrl);
    if (videos.length > 1) throw new Error('X allows only one video per post.');
    if (videos.length === 0 && urls.length > 4) throw new Error('X allows at most 4 images per post.');
    const axios = require('axios');
    for (const url of urls) {
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      const mediaId = await client.v1.uploadMedia(Buffer.from(res.data), { mimeType: mimeTypeForUrl(url) });
      mediaIds.push(mediaId);
    }
  }
  const tweet = mediaIds.length > 0
    ? await client.v2.tweet(content, { media: { media_ids: mediaIds } })
    : await client.v2.tweet(content);
  return { id: tweet.data.id, url: `https://twitter.com/i/web/status/${tweet.data.id}` };
}

function getConfiguredPublicBackendUrl() {
  return String(process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_PUBLIC_URL || '').trim().replace(/\/$/, '');
}

function getMimeTypeForFilename(filename = '') {
  const ext = path.extname(String(filename || '')).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.heic':
      return 'image/heic';
    case '.heif':
      return 'image/heif';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

function getLocalUploadFilePath(mediaUrl) {
  const value = String(mediaUrl || '').trim();
  if (!value) return null;

  let normalizedPath = '';

  if (value.startsWith('/uploads/')) {
    normalizedPath = decodeURIComponent(value);
  } else {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }

    normalizedPath = decodeURIComponent(parsed.pathname || '');
    if (!normalizedPath.startsWith('/uploads/')) return null;
    if (!localMediaHosts.has(String(parsed.hostname || '').toLowerCase())) return null;
  }

  if (!normalizedPath.startsWith('/uploads/')) return null;

  // Preserve full subdirectory structure (e.g. /uploads/pple/file.png → /app/uploads/pple/file.png)
  const relativePath = normalizedPath.slice('/uploads/'.length);
  const filePath = path.join(uploadsDir, relativePath);
  const relative = path.relative(uploadsDir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(filePath)) return null;

  return filePath;
}

function toPublicMediaUrl(mediaUrl) {
  const localFilePath = getLocalUploadFilePath(mediaUrl);
  if (!localFilePath) return String(mediaUrl || '').trim();

  const publicBaseUrl = getConfiguredPublicBackendUrl();
  if (!publicBaseUrl) return String(mediaUrl || '').trim();

  // Preserve subdirectory structure under /uploads/ (e.g. pple/file.png stays pple/file.png)
  const relative = path.relative(uploadsDir, localFilePath);
  const urlPath = relative.split(path.sep).map((segment) => encodeURIComponent(segment)).join('/');
  return `${publicBaseUrl}/uploads/${urlPath}`;
}

async function loadMediaBinary(mediaUrl) {
  const originalUrl = String(mediaUrl || '').trim();
  if (!originalUrl) throw new Error('Media URL is empty');

  const localFilePath = getLocalUploadFilePath(originalUrl);
  if (localFilePath) {
    const buffer = await fs.promises.readFile(localFilePath);
    return {
      buffer,
      contentType: getMimeTypeForFilename(localFilePath),
      filename: path.basename(localFilePath),
      source: 'local-upload',
      originalUrl,
    };
  }

  const response = await axios.get(originalUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'HiSocial/1.0' },
  });

  const contentType = String(response.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new Error('Only image media is supported for this platform');
  }

  let filename = 'upload-image';
  try {
    filename = path.basename(new URL(originalUrl).pathname) || filename;
  } catch {
  }

  if (!path.extname(filename)) {
    const extension = contentType.split('/')[1] || 'jpg';
    filename = `${filename}.${extension}`;
  }

  return {
    buffer: Buffer.from(response.data),
    contentType,
    filename,
    source: 'remote-url',
    originalUrl,
  };
}

async function uploadLinkedInImage(accessToken, authorUrn, mediaUrl) {
  const media = await loadMediaBinary(mediaUrl);

  const registerRes = await axios.post(
    'https://api.linkedin.com/v2/assets?action=registerUpload',
    {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [{
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent'
        }]
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    }
  );

  const uploadMechanism = registerRes.data?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
  const uploadUrl = uploadMechanism?.uploadUrl;
  const asset = registerRes.data?.value?.asset;

  if (!uploadUrl || !asset) {
    throw new Error('LinkedIn did not return an upload URL for the image');
  }

  await axios.put(uploadUrl, media.buffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': media.contentType,
      'Content-Length': media.buffer.length,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return asset;
}

async function publishToLinkedInTarget(accessToken, target, content, mediaUrls = []) {
  const authorUrn = target.id.startsWith('organization:')
    ? `urn:li:organization:${target.id.split(':')[1]}`
    : `urn:li:person:${target.id.split(':')[1]}`;

  const media = [];
  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    const asset = await uploadLinkedInImage(accessToken, authorUrn, mediaUrls[0]);
    media.push({
      status: 'READY',
      media: asset,
      title: { text: 'Image' },
      description: { text: 'Image attachment' }
    });
  }

  const postData = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: media.length > 0 ? 'IMAGE' : 'NONE',
        ...(media.length > 0 ? { media } : {})
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const res = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });

  const postId = res.data.id;
  return {
    id: postId,
    url: `https://www.linkedin.com/feed/update/${postId}`,
    target_name: target.name
  };
}

async function postToLinkedIn(accessToken, platformUserId, content, mediaUrls, selectedTargetIds, grantedScope = '', orgAccessToken = null, pageAccounts = []) {
  const { orgTargetsFromPageAccounts } = require('./utils/linkedin');
  const orgIds = orgTargetsFromPageAccounts(pageAccounts).map((t) => t.replace('organization:', ''));
  const targets = await listLinkedInTargets(accessToken, orgAccessToken, grantedScope, orgIds);

  const normalizeLinkedInTargetId = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('person:') || raw.startsWith('organization:')) return raw;
    return `person:${raw}`;
  };

  if (targets.length === 0) {
    throw new Error('No LinkedIn target available for posting.');
  }

  if ((!selectedTargetIds || selectedTargetIds.length === 0) && targets.length > 1) {
    throw new Error('Select at least one LinkedIn target before posting.');
  }

  const normalizedSelectedIds = Array.isArray(selectedTargetIds)
    ? [...new Set(selectedTargetIds.map((targetId) => String(targetId || '').trim()).filter(Boolean))]
    : [];

  const selected = normalizedSelectedIds.length > 0
    ? targets.filter((target) => {
        const targetId = String(target.id || '').trim();
        const normalizedTargetId = normalizeLinkedInTargetId(targetId);
        return normalizedSelectedIds.some((savedId) => {
          const normalizedSavedId = normalizeLinkedInTargetId(savedId);
          return savedId === targetId
            || normalizedSavedId === normalizedTargetId
            || savedId === normalizedTargetId;
        });
      })
    : (() => {
        const fallbackTargetId = typeof platformUserId === 'string' && platformUserId
          ? (platformUserId.includes(':') ? platformUserId : `person:${platformUserId}`)
          : null;
        const fallback = fallbackTargetId ? targets.find((target) => target.id === fallbackTargetId) : null;
        return [fallback || targets[0]].filter(Boolean);
      })();

  if (selected.length === 0) {
    throw new Error('The selected LinkedIn target is no longer available. Refresh and try again.');
  }

  const publishResults = await Promise.allSettled(
    selected.map((target) => {
      // Use org token for organization targets if available
      const tokenToUse = (orgAccessToken && target.id.startsWith('organization:'))
        ? orgAccessToken
        : accessToken;
      return publishToLinkedInTarget(tokenToUse, target, content, mediaUrls);
    })
  );

  return publishResults.map((result, index) => {
    const target = selected[index];
    if (result.status === 'fulfilled') {
      return {
        ...result.value,
        status: 'success',
        target_name: result.value.target_name || target.name
      };
    }

    return {
      status: 'failed',
      error_message: toPlatformError('linkedin', result.reason).message,
      target_name: target.name
    };
  });
}

async function postToReddit(accessToken, content, subreddit) {
  // Phase 10: the old version hardcoded sr='test', so
  // every Reddit post landed in r/test. A subreddit is
  // now required per post (stored on the post, entered
  // in Compose) and validated here; without a valid one
  // the attempt fails visibly instead of posting to a
  // subreddit nobody chose.
  const { validateSubreddit, buildRedditSubmit } = require('./utils/xrp');
  const checked = validateSubreddit(subreddit);
  if (!checked.ok) throw new Error(checked.error);
  const res = await axios.post('https://oauth.reddit.com/api/submit', new URLSearchParams(
    buildRedditSubmit({ subreddit: checked.subreddit, content })
  ), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'HiSocial/1.0'
    }
  });
  const postUrl = res.data?.json?.data?.url;
  return { id: postUrl, url: postUrl };
}

async function postToInstagram(accessToken, userId, content, mediaUrls) {
  if (!mediaUrls || mediaUrls.length === 0) {
    throw new Error('Instagram requires at least one image');
  }

  const igUserId = String(userId);
  const imageUrl = await resolveInstagramImageUrl(mediaUrls[0]);
  console.log(`[Instagram] Posting to user ${igUserId} with image URL: ${imageUrl}`);

  // Create media container
  let containerRes;
  try {
    containerRes = await axios.post(
      `https://graph.facebook.com/v18.0/${igUserId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          media_type: 'IMAGE',
          caption: content,
          access_token: accessToken
        }
      }
    );
  } catch (igErr) {
    const apiData = igErr.response?.data;
    console.error('[Instagram] Media container creation failed:', JSON.stringify(apiData || igErr.message));
    throw igErr;
  }

  const creationId = containerRes.data.id;
  await waitForInstagramMediaReady(accessToken, creationId);

  // Publish
  const publishRes = await axios.post(
    `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
    null,
    {
      params: {
        creation_id: creationId,
        access_token: accessToken
      }
    }
  );

  return { id: publishRes.data.id, url: `https://www.instagram.com/p/${publishRes.data.id}` };
}

function normalizeImageCandidate(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return value;
  }

  if ((parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com') && parsed.pathname === '/url') {
    const nested = parsed.searchParams.get('url') || parsed.searchParams.get('q');
    if (nested) return nested;
  }

  return parsed.toString();
}

function extractHtmlImageLink(html = '', baseUrl = '') {
  const matchers = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (const matcher of matchers) {
    const found = html.match(matcher)?.[1];
    if (!found) continue;
    try {
      return new URL(found, baseUrl).toString();
    } catch {
      return found;
    }
  }

  return '';
}

async function resolveInstagramImageUrl(inputUrl, depth = 0) {
  const candidate = normalizeImageCandidate(toPublicMediaUrl(inputUrl));
  if (!candidate) {
    throw new Error('Instagram image URL is empty. Provide a direct public image URL.');
  }

  // If the URL was successfully rewritten to the configured public HTTPS base URL
  // (e.g. a Cloudflare tunnel), it is already publicly accessible — skip local/HTTP guards.
  const publicBaseUrl = getConfiguredPublicBackendUrl();
  let servedFromPublicBase = false;
  if (publicBaseUrl) {
    try {
      const candidateHost = new URL(candidate).hostname.toLowerCase();
      const publicHost = new URL(publicBaseUrl).hostname.toLowerCase();
      servedFromPublicBase = candidateHost === publicHost && candidate.startsWith('https://');
    } catch { /* ignore parse errors */ }
  }

  if (!servedFromPublicBase) {
    if (getLocalUploadFilePath(candidate)) {
      throw new Error(
        publicBaseUrl
          ? 'Instagram still sees a local-only image URL. Check that PUBLIC_BACKEND_URL is a public HTTPS address reachable from Meta servers.'
          : 'Instagram requires a public HTTPS image URL. Images uploaded locally are currently served from localhost, which Instagram cannot reach. Set PUBLIC_BACKEND_URL to a public HTTPS base URL or use a direct public image link.'
      );
    }

    // Guard: reject non-HTTPS or internal/Docker hostnames — they pass the HEAD check from inside
    // the container but are unreachable by Meta servers (localhost, Docker service names, etc.).
    try {
      const parsedCandidate = new URL(candidate);
      const host = parsedCandidate.hostname.toLowerCase();
      const isLocalHost = localMediaHosts.has(host);
      // Docker service names have no dot (e.g. 'backend', 'socialhub_backend')
      const isDockerInternal = !host.includes('.');
      const isHttp = parsedCandidate.protocol === 'http:';
      if (isLocalHost || isDockerInternal || isHttp) {
        throw new Error(
          publicBaseUrl
            ? `Instagram cannot reach the URL "${candidate}". The resolved URL is not publicly accessible (non-HTTPS or internal host). Ensure PUBLIC_BACKEND_URL is set to a public HTTPS URL reachable from Meta servers.`
            : 'Instagram requires a public HTTPS image URL. Set PUBLIC_BACKEND_URL to a publicly accessible HTTPS base URL (e.g. your ngrok or production domain) so Instagram can fetch the image.'
        );
      }
    } catch (guardErr) {
      if (String(guardErr.message).includes('Instagram') || String(guardErr.message).includes('Meta')) throw guardErr;
      // URL is malformed — fall through to the depth check and HEAD/GET attempts below
    }
  }

  if (depth > 2) {
    throw new Error('Unable to resolve a direct image URL. Use a direct .jpg/.png image link.');
  }

  try {
    const headRes = await axios.head(candidate, {
      maxRedirects: 5,
      timeout: 15000,
      headers: { 'User-Agent': 'HiSocial/1.0' },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = String(headRes.headers?.['content-type'] || '').toLowerCase();
    const finalUrl = headRes.request?.res?.responseUrl || candidate;

    if (contentType.startsWith('image/')) {
      return finalUrl;
    }
  } catch {
  }

  try {
    const getRes = await axios.get(candidate, {
      maxRedirects: 5,
      timeout: 15000,
      headers: { 'User-Agent': 'HiSocial/1.0' },
      validateStatus: (status) => status >= 200 && status < 400,
      responseType: 'text',
    });

    const contentType = String(getRes.headers?.['content-type'] || '').toLowerCase();
    const finalUrl = getRes.request?.res?.responseUrl || candidate;

    if (contentType.startsWith('image/')) {
      return finalUrl;
    }

    if (contentType.includes('text/html')) {
      const embeddedImage = extractHtmlImageLink(String(getRes.data || ''), finalUrl);
      if (embeddedImage && embeddedImage !== candidate) {
        return resolveInstagramImageUrl(embeddedImage, depth + 1);
      }
    }
  } catch {
  }

  throw new Error(
    'Instagram needs a direct public image URL (JPEG/PNG/GIF/WebP/HEIC/AVIF). Avoid Google redirect links, web page links (like ibb.co page URLs), and temporary/auth-protected URLs.'
  );
}

async function waitForInstagramMediaReady(accessToken, creationId) {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const statusRes = await axios.get(`https://graph.facebook.com/v18.0/${creationId}`, {
      params: {
        fields: 'status_code,status',
        access_token: accessToken,
      }
    });

    const statusCode = String(statusRes.data?.status_code || '').toUpperCase();
    if (!statusCode || statusCode === 'FINISHED' || statusCode === 'PUBLISHED') {
      return;
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      const statusText = statusRes.data?.status || 'Media processing failed';
      throw new Error(`Instagram media processing failed: ${statusText}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

// Phase 10: refresh a Reddit access token when it is
// expired or has no recorded expiry. Pre-Phase-10 rows
// never stored an expiry, so missing expiry refreshes
// once and then stores one — after that, only genuinely
// expired tokens refresh. On failure the old token is
// kept and the attempt fails visibly.
async function refreshRedditTokenIfNeeded(db, userId, tokenRow) {
  if (!tokenRow || !tokenRow.refresh_token) return tokenRow;
  const expiresAt = tokenRow.token_expires_at ? new Date(tokenRow.token_expires_at).getTime() : NaN;
  if (!Number.isNaN(expiresAt) && expiresAt > Date.now() + 5 * 60 * 1000) return tokenRow;
  try {
    const { refreshRedditToken } = require('./utils/xrp');
    const refreshed = await refreshRedditToken({
      refreshToken: tokenRow.refresh_token,
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
    });
    await db.query(
      `UPDATE social_accounts SET access_token=$1, token_expires_at=$2, updated_at=NOW()
       WHERE user_id=$3 AND platform='reddit' AND platform_user_id=$4`,
      [refreshed.accessToken, refreshed.expiresAt, userId, tokenRow.platform_user_id]
    );
    return { ...tokenRow, access_token: refreshed.accessToken, token_expires_at: refreshed.expiresAt };
  } catch (e) {
    console.warn('Reddit token refresh failed:', e.response?.data || e.message);
    return tokenRow;
  }
}

async function postToPinterest(accessToken, content, mediaUrls, boardId) {
  // Phase 10: the old version always pinned to the first
  // board. A board chosen in Compose is now used when
  // set; the first board remains only as a documented
  // fallback, not a silent default. Video URLs fail
  // visibly: video pins need a different media_source
  // flow, and sending one as image_url would fail
  // confusingly at the API.
  const { pinterestDescription, isVideoUrl } = require('./utils/xrp');
  if (!boardId) {
    const boardsRes = await axios.get('https://api.pinterest.com/v5/boards',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    boardId = boardsRes.data.items?.[0]?.id;
  }
  if (!boardId) throw new Error('No Pinterest board found');

  const pinData = {
    title: content.substring(0, 100),
    description: pinterestDescription(content),
    board_id: boardId
  };
  if (mediaUrls?.length > 0) {
    if (isVideoUrl(mediaUrls[0])) {
      throw new Error('Pinterest video pins need a video upload flow that is not implemented yet — attach an image instead.');
    }
    pinData.media_source = { source_type: 'image_url', url: mediaUrls[0] };
  }
  const res = await axios.post('https://api.pinterest.com/v5/pins', pinData,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  return { id: res.data.id, url: `https://www.pinterest.com/pin/${res.data.id}` };
}

async function publishStoredPost(pool, post) {
  const platformsToQuery = post.platforms.includes('linkedin')
    ? [...new Set([...post.platforms, 'linkedin_page'])]
    : post.platforms;

  const tokensResult = await pool.query(
    `SELECT platform, access_token, refresh_token, platform_user_id, scope, token_expires_at
     FROM social_accounts WHERE user_id=$1 AND platform=ANY($2) AND is_active=true`,
    [post.user_id, platformsToQuery]
  );

  const tokens = {};
  tokensResult.rows.forEach((row) => { tokens[row.platform] = row; });

  // Phase 7: every stored linkedin_page row, as above.
  let linkedInPageAccounts = [];
  if (post.platforms.includes('linkedin')) {
    const pageResult = await pool.query(
      `SELECT platform_user_id, access_token FROM social_accounts
       WHERE user_id=$1 AND platform='linkedin_page' AND is_active=true`,
      [post.user_id]
    );
    linkedInPageAccounts = pageResult.rows;
  }

  // Phase 8: refresh an expired YouTube token before posting.
  if (post.platforms.includes('youtube') && tokens['youtube']) {
    tokens['youtube'] = await refreshYouTubeTokenIfNeeded(pool, post.user_id, tokens['youtube']);
  }

  // Phase 9: TikTok tokens live only 24 hours.
  if (post.platforms.includes('tiktok') && tokens['tiktok']) {
    tokens['tiktok'] = await refreshTikTokTokenIfNeeded(pool, post.user_id, tokens['tiktok']);
  }

  // Phase 10: Reddit tokens live 1 hour and were never
  // refreshed, so Reddit broke an hour after connect.
  if (post.platforms.includes('reddit') && tokens['reddit']) {
    tokens['reddit'] = await refreshRedditTokenIfNeeded(pool, post.user_id, tokens['reddit']);
  }

  const results = await Promise.allSettled(
    post.platforms.map((platform) => postToPlatform(platform, tokens[platform], post.content, post.media_urls || [], {
      facebookPageIds: post.facebook_page_ids || [],
      linkedinTargetIds: post.linkedin_target_ids || [],
      linkedInPageToken: tokens['linkedin_page']?.access_token || null,
      linkedInPageAccounts,
      redditSubreddit: post.reddit_subreddit,
      pinterestBoardId: post.pinterest_board_id
    }))
  );

  const platformResults = [];
  for (let i = 0; i < post.platforms.length; i += 1) {
    const platform = post.platforms[i];
    const attempts = normalizeAttemptResults(platform, results[i]);

    for (const attempt of attempts) {
      const success = attempt.status === 'success';
      const inserted = await pool.query(
        `INSERT INTO platform_posts (post_id, platform, platform_post_id, platform_post_url, status, error_message, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          post.id,
          attempt.platform,
          success ? attempt.id : null,
          success ? attempt.url : null,
          attempt.status,
          success ? null : (attempt.error_message || 'Unknown error'),
          success ? new Date() : null,
        ]
      );

      platformResults.push(inserted.rows[0]);
    }
  }

  const anySuccess = platformResults.some((row) => row.status === 'success');
  const allSuccess = platformResults.length > 0 && platformResults.every((row) => row.status === 'success');
  const finalStatus = allSuccess ? 'published' : (anySuccess ? 'partial' : 'failed');

  const updateRes = await pool.query(
    `UPDATE posts SET status=$1, published_at=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
    [finalStatus, anySuccess ? new Date() : null, post.id]
  );

  return {
    post: updateRes.rows[0],
    results: platformResults,
    finalStatus,
  };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
async function runScheduledPosts(pool) {
  try {
    const result = await pool.query(
      `SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at <= NOW() LIMIT 10`
    );

    for (const post of result.rows) {
      const claimed = await pool.query(
        `UPDATE posts SET status='posting' WHERE id=$1 AND status='scheduled' RETURNING id`,
        [post.id]
      );
      if (claimed.rowCount === 0) continue;

      try {
        const latestRes = await pool.query(`SELECT * FROM posts WHERE id=$1 LIMIT 1`, [post.id]);
        if (!latestRes.rows[0]) continue;
        const publishResult = await publishStoredPost(pool, latestRes.rows[0]);
        const finalStatus = publishResult.finalStatus;
        console.log(`📅 Scheduler: published post ${post.id} [${finalStatus}]`);
      } catch (e) {
        console.error(`📅 Scheduler: error on post ${post.id}:`, e.message);
        await pool.query(`UPDATE posts SET status='failed' WHERE id=$1`, [post.id]);
      }
    }
  } catch (e) {
    console.error('📅 Scheduler error:', e.message);
  }
}

router.startScheduler = function (pool) {
  console.log('📅 Post scheduler started — checking every 60 seconds');
  setInterval(() => runScheduledPosts(pool), 60 * 1000);
};

module.exports = router;
