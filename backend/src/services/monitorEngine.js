const { scrapeLinkedInPosts } = require('./linkedinScraper');
const { buildFingerprint, isDuplicateAgainstExisting } = require('./deduplicationService');
const { scoreOpportunity, generateResponses, isActionableOpportunityCandidate } = require('./aiAnalyzer');

async function scanMonitorJob({ db, jobRow }) {
  const parsedJob = {
    id: jobRow.id,
    userId: jobRow.user_id,
    keywords: jobRow.keywords || [],
    includeWords: jobRow.include_words || [],
    excludeWords: jobRow.exclude_words || [],
    context: jobRow.context || '',
    platform: jobRow.platform || 'linkedin',
    linkedInSessionCookie: jobRow.linkedin_session_cookie || '',
  };

  let posts = [];
  try {
    posts = await scrapeLinkedInPosts({
      keywords: parsedJob.keywords,
      includeWords: parsedJob.includeWords,
      excludeWords: parsedJob.excludeWords,
      linkedInSessionCookie: parsedJob.linkedInSessionCookie,
    });
  } catch (e) {
    console.error('LinkedIn scrape failed for monitor job:', parsedJob.id, e.message || e);
    posts = [];
  }

  const existing = await db.query(
    `SELECT id, content, company, job_title, url, external_contact
     FROM monitor_posts
     WHERE user_id = $1
       AND job_id = $2
     ORDER BY created_at DESC
     LIMIT 500`,
    [parsedJob.userId, parsedJob.id]
  );

  const inserted = [];
  let deduped = 0;
  let filteredIntent = 0;
  let filteredScore = 0;
  const sampleCandidates = [];

  for (const post of posts) {
    if (!isActionableOpportunityCandidate(post)) {
      filteredIntent += 1;
      if (sampleCandidates.length < 20) {
        sampleCandidates.push({
          author: post.author || null,
          url: post.url || null,
          preview: String(post.content || '').slice(0, 180),
          decision: 'filtered_noise',
          reason: 'generic_linkedin_page',
          score: 0,
          hasHiringIntent: false,
          matchedKeywords: []
        });
      }
      continue;
    }

    const fingerprintHash = buildFingerprint({
      content: post.content,
      company: post.company,
      jobTitle: post.jobTitle,
      url: post.url,
      externalContact: post.externalContact,
    });

    const duplicateCheck = isDuplicateAgainstExisting(post, existing.rows);
    if (duplicateCheck.duplicate) {
      deduped += 1;
      if (sampleCandidates.length < 20) {
        sampleCandidates.push({
          author: post.author || null,
          url: post.url || null,
          preview: String(post.content || '').slice(0, 180),
          decision: 'deduped',
          reason: duplicateCheck.reason || 'dedupe_rule',
          score: 0,
          hasHiringIntent: false,
          matchedKeywords: []
        });
      }
      continue;
    }

    const scoreInfo = scoreOpportunity({ post, job: parsedJob });
    if (!scoreInfo.hasHiringIntent) {
      filteredIntent += 1;
      if (sampleCandidates.length < 20) {
        sampleCandidates.push({
          author: post.author || null,
          url: post.url || null,
          preview: String(post.content || '').slice(0, 180),
          decision: 'filtered_intent',
          reason: 'no_hiring_intent',
          score: scoreInfo.score,
          hasHiringIntent: scoreInfo.hasHiringIntent,
          matchedKeywords: scoreInfo.keywordHits || []
        });
      }
      continue;
    }

    if (scoreInfo.score < 50) {
      filteredScore += 1;
      if (sampleCandidates.length < 20) {
        sampleCandidates.push({
          author: post.author || null,
          url: post.url || null,
          preview: String(post.content || '').slice(0, 180),
          decision: 'filtered_score',
          reason: 'score_below_threshold',
          score: scoreInfo.score,
          hasHiringIntent: scoreInfo.hasHiringIntent,
          matchedKeywords: scoreInfo.keywordHits || []
        });
      }
      continue;
    }

    const insertRes = await db.query(
      `INSERT INTO monitor_posts (
        user_id, job_id, platform, author, company, job_title, content, url,
        external_contact, matched_keywords, fingerprint_hash, relevance_score,
        ai_is_hiring, ai_is_relevant, scanned_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, NOW()
      )
      ON CONFLICT (user_id, fingerprint_hash)
      DO NOTHING
      RETURNING id, content`,
      [
        parsedJob.userId,
        parsedJob.id,
        parsedJob.platform,
        post.author || null,
        post.company || null,
        post.jobTitle || null,
        post.content,
        post.url || null,
        post.externalContact || null,
        scoreInfo.keywordHits,
        fingerprintHash,
        scoreInfo.score,
        scoreInfo.hasHiringIntent,
        scoreInfo.score >= 60,
      ]
    );

    if (insertRes.rows[0]) {
      const savedPost = { id: insertRes.rows[0].id, content: post.content };
      inserted.push(savedPost.id);
      if (sampleCandidates.length < 20) {
        sampleCandidates.push({
          author: post.author || null,
          url: post.url || null,
          preview: String(post.content || '').slice(0, 180),
          decision: 'inserted',
          reason: 'passed_all_filters',
          score: scoreInfo.score,
          hasHiringIntent: scoreInfo.hasHiringIntent,
          matchedKeywords: scoreInfo.keywordHits || []
        });
      }

      const responses = await generateResponses({
        post,
        userContext: parsedJob.context,
        tone: 'professional',
      });

      await db.query(
        `INSERT INTO ai_responses (post_id, comment, dm, proposal, tone)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (post_id) DO UPDATE SET
           comment = EXCLUDED.comment,
           dm = EXCLUDED.dm,
           proposal = EXCLUDED.proposal,
           tone = EXCLUDED.tone,
           updated_at = NOW()`,
        [savedPost.id, responses.comment, responses.dm, responses.proposal, 'professional']
      );
    }
  }

  await db.query(
    `UPDATE monitor_jobs
     SET last_scanned_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [parsedJob.id]
  );

  return {
    scanned: posts.length,
    inserted: inserted.length,
    deduped,
    filteredIntent,
    filteredScore,
    sampleCandidates,
  };
}

module.exports = {
  scanMonitorJob,
};
