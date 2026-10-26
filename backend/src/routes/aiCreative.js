const express = require('express');
const { runFullPipeline } = require('../services/aiCreativeEngine');

const router = express.Router();

// POST /api/ai/creative/generate - Start AI creative engine pipeline with SSE streaming
router.post('/creative/generate', async (req, res) => {
  const { tone, niche, category, topic, provider } = req.body;
  const userId = req.user?.id;

  console.log('\n✨ [API] POST /api/ai/creative/generate received');
  console.log('   👤 User ID:', userId);
  console.log('   📋 Request params:', { tone, niche, category, topic, provider });

  if (!userId) {
    console.log('   ❌ Unauthorized - no user ID');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!tone || !niche || !category || !topic) {
    console.log('   ❌ Missing required fields');
    return res.status(400).json({ error: 'Missing required fields: tone, niche, category, topic' });
  }

  // Validate provider if specified
  const aiProvider = provider || process.env.AI_PROVIDER || 'gemini';
  if (!['gemini', 'bigmodel'].includes(aiProvider)) {
    console.log(`   ❌ Invalid provider: ${aiProvider}`);
    return res.status(400).json({ error: 'Invalid provider. Use: gemini, bigmodel' });
  }

  console.log(`   ✅ Validation passed. Provider: ${aiProvider}`);

  // Set up SSE headers (CORS is handled by main app middleware)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event, data) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // Client disconnected
      console.log('   📴 Client disconnected');
    }
  };

  const db = req.app.locals.db;
  const requestStartTime = Date.now();

  try {
    // Create session in database
    const sessionResult = await db.query(
      `INSERT INTO ai_creative_sessions (user_id, tone, niche, category, topic, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, tone, niche, category, topic, 'running']
    );
    const sessionId = sessionResult.rows[0].id;
    console.log(`   📌 Session created: ${sessionId}`);
    send('session', { sessionId, provider: aiProvider });

    // Run pipeline with phase update callback
    const result = await runFullPipeline(
      { tone, niche, category, topic },
      sessionId,
      aiProvider,
      async (phaseUpdate) => {
        // Send phase update to client
        send('phase', phaseUpdate);

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
      console.log(`   💾 Content saved to database`);
    } catch (dbErr) {
      console.error('Error saving generated content:', dbErr);
    }

    // Update session status to completed
    await db.query(
      `UPDATE ai_creative_sessions SET status = $1, final_prompt = $2 WHERE id = $3`,
      ['completed', result.content.image_prompt, sessionId]
    );

    const totalDuration = Date.now() - requestStartTime;
    console.log(`\n✅ [API] Pipeline completed successfully`);
    console.log(`   ⏱️  Total request duration: ${totalDuration}ms`);
    console.log(`   📊 Final image prompt length: ${result.content.image_prompt?.length || 0} chars\n`);

    send('complete', { sessionId, result });
  } catch (err) {
    const errorDuration = Date.now() - requestStartTime;
    console.error(`\n❌ [API] Pipeline error after ${errorDuration}ms:`, err);
    send('error', { message: err.message });
    
    // Try to update session status
    try {
      const sessionMatch = /sessionId: (\d+)/.exec(err.stack || '');
      if (sessionMatch) {
        const sessionId = sessionMatch[1];
        await db.query(
          `UPDATE ai_creative_sessions SET status = $1 WHERE id = $2`,
          ['failed', sessionId]
        );
      }
    } catch (updateErr) {
      console.error('Error updating session status:', updateErr);
    }
  }

  res.end();
});

// GET /api/ai/creative/history - Get user's creative sessions
router.get('/creative/history', async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = req.app.locals.db;

  try {
    const result = await db.query(
      `SELECT 
        s.id, s.created_at, s.updated_at, s.tone, s.niche, s.category, s.topic, 
        s.status, s.final_prompt, s.image_url, s.image_generated_at,
        gc.post_content, gc.headline, gc.hashtags, gc.image_ratio, gc.image_style, gc.image_prompt
       FROM ai_creative_sessions s
       LEFT JOIN ai_generated_content gc ON gc.session_id = s.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/ai/creative/:sessionId - Get specific session with phase logs
router.get('/creative/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = req.app.locals.db;

  try {
    // Verify session belongs to user
    const sessionResult = await db.query(
      `SELECT * FROM ai_creative_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get phase logs
    const logsResult = await db.query(
      `SELECT * FROM ai_phase_logs WHERE session_id = $1 ORDER BY phase_number`,
      [sessionId]
    );

    // Get generated content
    const contentResult = await db.query(
      `SELECT * FROM ai_generated_content WHERE session_id = $1`,
      [sessionId]
    );

    res.json({
      session,
      phases: logsResult.rows,
      content: contentResult.rows[0] || null
    });
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// DELETE /api/ai/creative/:sessionId - Delete a session
router.delete('/creative/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = req.app.locals.db;

  try {
    // Verify session belongs to user
    const sessionResult = await db.query(
      `SELECT * FROM ai_creative_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete will cascade to related tables
    await db.query(`DELETE FROM ai_creative_sessions WHERE id = $1`, [sessionId]);

    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;