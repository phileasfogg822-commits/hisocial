const { runFullPipeline } = require('./aiCreativeEngine');
const { executeAISocialCreativeEngineV2, generateImageWithEngineV2 } = require('./aiSocialCreativeEngineV2');

/**
 * Generate a post using the AI Creative Engine and return the results
 */
async function generatePostWithAI({ 
  tone, 
  niche, 
  category, 
  topic, 
  provider = 'gemini',
  heading = '',
  post_text = '',
  hashtags = [],
  ratio = '1:1',
  style = 'modern',
  useEngine = false,
  enhanceWithGemini = false
}, userId, db) {
  // Create a temporary session for this generation
  const sessionResult = await db.query(
    `INSERT INTO ai_creative_sessions (user_id, tone, niche, category, topic, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, tone, niche, category, topic, 'running']
  );
  const sessionId = sessionResult.rows[0].id;

  let result;
  
  // Use V2 engine if requested, otherwise use V1
  if (useEngine) {
    // Run the AI Creative Engine V2 pipeline
    const engineInput = {
      tone: tone || 'professional',
      niche: niche || '',
      category: category || '',
      topic: topic || '',
      post_text: post_text || '',
      heading: heading || '',
      hashtags: hashtags || [],
      ratio: ratio || '1:1',
      style: style || 'modern'
    };

    result = executeAISocialCreativeEngineV2(engineInput);
    
    if (result.status === 'error') {
      throw new Error(result.error || 'AI Creative Engine V2 failed to generate content');
    }
    
    // If validation failed, return error
    if (result.status === 'success' && result.validation && !result.validation.passed) {
      throw new Error(`Design failed validation: ${result.validation.failed_checks.join(', ')}`);
    }
    
    // If successful, prepare the result in the expected format
    if (result.status === 'success') {
      // Extract content from the post_text if available, or generate using V1 as fallback
      if (!post_text) {
        // Use V1 engine to generate content as fallback
        result = await runFullPipeline(
          { tone, niche, category, topic },
          sessionId,
          provider,
          async (phaseUpdate) => {
            // Log phase to database
            try {
              await db.query(
                `INSERT INTO ai_phase_logs (session_id, phase_number, phase_name, input_data, output_data, status, scores, duration_ms)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  sessionId,
                  phaseUpdate.phaseNumber,
                  phaseUpdate.phaseName,
                  phaseUpdate.input ? JSON.stringify(phaseUpdate.input) : null,
                  phaseUpdate.output ? JSON.stringify(phaseUpdate.output) : null,
                  phaseUpdate.status,
                  phaseUpdate.scores ? JSON.stringify(phaseUpdate.scores) : null,
                  phaseUpdate.duration_ms || 0
                ]
              );
            } catch (dbErr) {
              console.error('Error logging phase:', dbErr);
            }
          }
        );
      } else {
        // Format result to match V1 structure for consistency
        result = {
          content: {
            post_content: post_text,
            headline: heading,
            hashtags: Array.isArray(hashtags) ? hashtags.join(' ') : hashtags,
            image_ratio: ratio,
            image_style: style,
            image_prompt: result.prompt // Use the V2 generated prompt
          },
          allPhases: {}
        };
      }
    }
  } else {
    // Run the AI Creative Engine V1 pipeline (existing behavior)
    result = await runFullPipeline(
      { tone, niche, category, topic },
      sessionId,
      provider,
      async (phaseUpdate) => {
        // Log phase to database
        try {
          await db.query(
            `INSERT INTO ai_phase_logs (session_id, phase_number, phase_name, input_data, output_data, status, scores, duration_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              sessionId,
              phaseUpdate.phaseNumber,
              phaseUpdate.phaseName,
              phaseUpdate.input ? JSON.stringify(phaseUpdate.input) : null,
              phaseUpdate.output ? JSON.stringify(phaseUpdate.output) : null,
              phaseUpdate.status,
              phaseUpdate.scores ? JSON.stringify(phaseUpdate.scores) : null,
              phaseUpdate.duration_ms || 0
            ]
          );
        } catch (dbErr) {
          console.error('Error logging phase:', dbErr);
        }
      }
    );
  }

  // If we have an image prompt and provider, try to generate the image
  if (result.content.image_prompt && process.env.ALIBABA_DASHSCOPE_API_KEY && !process.env.ALIBABA_DASHSCOPE_API_KEY.startsWith('your_')) {
    try {
      // Try to generate the image using the V2 engine if available
      const engineResult = executeAISocialCreativeEngineV2({
        tone: tone || 'professional',
        niche: niche || '',
        category: category || '',
        topic: topic || '',
        post_text: result.content.post_content || post_text,
        heading: result.content.headline || heading,
        hashtags: result.content.hashtags || hashtags,
        ratio: result.content.image_ratio || ratio,
        style: result.content.image_style || style
      });
      
      if (engineResult.status === 'success' && engineResult.validation?.passed) {
        const imageResult = await generateImageWithEngineV2(engineResult, 'alibaba');
        result.content.generated_image_url = imageResult.url;
      }
    } catch (imageErr) {
      console.error('Image generation failed (non-critical):', imageErr.message);
      // Don't fail the whole process if image generation fails
    }
  }

  // Save generated content
  try {
    await db.query(
      `INSERT INTO ai_generated_content (session_id, post_content, headline, hashtags, image_ratio, image_style, image_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        result.content.post_content,
        result.content.headline,
        result.content.hashtags,
        result.content.image_ratio,
        result.content.image_style,
        result.content.image_prompt
      ]
    );
  } catch (dbErr) {
    console.error('Error saving generated content:', dbErr);
  }

  // Update session status to completed
  await db.query(
    `UPDATE ai_creative_sessions SET status=$2, final_prompt=$3, image_url=$4, image_generated_at=$5 WHERE id=$1`,
    [
      sessionId,
      'completed',
      result.content.image_prompt,
      result.content.generated_image_url || null,
      result.content.generated_image_url ? new Date() : null
    ]
  );

  return result;
}

/**
 * Generate and schedule a post using the AI Creative Engine
 */
async function generateAndSchedulePost({ 
  tone, 
  niche, 
  category, 
  topic, 
  platforms, 
  scheduled_at, 
  provider = 'gemini',
  heading = '',
  post_text = '',
  hashtags = [],
  ratio = '1:1',
  style = 'modern',
  useEngine = false,
  enhanceWithGemini = false
}, userId, db) {
  // Generate content using AI Creative Engine
  const aiResult = await generatePostWithAI({ 
    tone, 
    niche, 
    category, 
    topic, 
    provider,
    heading,
    post_text,
    hashtags,
    ratio,
    style,
    useEngine,
    enhanceWithGemini
  }, userId, db);

  // Create the scheduled post
  const postResult = await db.query(
    `INSERT INTO posts (user_id, content, platforms, media_urls, status, scheduled_at, generation_source, generation_batch_id, generation_index, generation_total)
     VALUES ($1,$2,$3,$4,'scheduled',$5,$6,$7,$8,$9) RETURNING *`,
    [
      userId,
      aiResult.content.post_content,
      platforms,
      aiResult.content.generated_image_url ? [aiResult.content.generated_image_url] : [],
      new Date(scheduled_at),
      'ai_creative_engine',
      `ai_gen_${Date.now()}`,
      1,
      1
    ]
  );

  return {
    post: postResult.rows[0],
    aiResult,
    scheduled: true
  };
}

/**
 * Generate and publish a post immediately using the AI Creative Engine
 */
async function generateAndPublishPost({ 
  tone, 
  niche, 
  category, 
  topic, 
  platforms, 
  provider = 'gemini',
  heading = '',
  post_text = '',
  hashtags = [],
  ratio = '1:1',
  style = 'modern',
  useEngine = false,
  enhanceWithGemini = false
}, userId, db, postToPlatform) {
  // Generate content using AI Creative Engine
  const aiResult = await generatePostWithAI({ 
    tone, 
    niche, 
    category, 
    topic, 
    provider,
    heading,
    post_text,
    hashtags,
    ratio,
    style,
    useEngine,
    enhanceWithGemini
  }, userId, db);

  // Create post record
  const postResult = await db.query(
    `INSERT INTO posts (user_id, content, platforms, media_urls, status, generation_source, generation_batch_id, generation_index, generation_total)
     VALUES ($1,$2,$3,$4,'posting',$5,$6,$7,$8) RETURNING *`,
    [
      userId,
      aiResult.content.post_content,
      platforms,
      aiResult.content.generated_image_url ? [aiResult.content.generated_image_url] : [],
      'ai_creative_engine',
      `ai_gen_${Date.now()}`,
      1,
      1
    ]
  );
  const post = postResult.rows[0];

  // Post to each platform
  const results = await Promise.allSettled(
    platforms.map((platform) => postToPlatform(platform, null, aiResult.content.post_content, aiResult.content.generated_image_url ? [aiResult.content.generated_image_url] : []))
  );

  // Record results
  const platformResults = [];
  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    const result = results[i];
    // Note: We would need to adapt this based on the actual postToPlatform implementation
    // For now, we'll just return a basic structure
    if (result.status === 'fulfilled') {
      platformResults.push({
        platform,
        status: 'success',
        platform_post_id: result.value?.id || null,
        platform_post_url: result.value?.url || null
      });
    } else {
      platformResults.push({
        platform,
        status: 'failed',
        error_message: result.reason?.message || 'Unknown error'
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

  return {
    post,
    results: platformResults,
    published: anySuccess
  };
}

module.exports = {
  generatePostWithAI,
  generateAndSchedulePost,
  generateAndPublishPost
};