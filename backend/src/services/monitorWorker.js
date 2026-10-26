const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { scanMonitorJob } = require('./monitorEngine');

const QUEUE_NAME = 'monitor-scan-jobs';

let queue;
let worker;
let pollingTimer;
let dbPool;

function runWithTimeout(taskPromise, timeoutMs) {
  return Promise.race([
    taskPromise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Monitor scan timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    })
  ]);
}

function getConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

async function enqueueScan({ jobId, trigger = 'manual' }) {
  if (!queue) throw new Error('Monitor queue is not initialized');
  return queue.add(
    'scan-monitor-job',
    { jobId, trigger },
    { removeOnComplete: true, removeOnFail: 100 }
  );
}

async function pollAndEnqueueAutoRuns() {
  if (!dbPool || !queue) return;

  const rows = await dbPool.query(
    `SELECT id, run_every_minutes, last_scanned_at, last_enqueued_at
     FROM monitor_jobs
     WHERE auto_run = true`
  );

  for (const job of rows.rows) {
    const everyMinutes = Math.max(parseInt(job.run_every_minutes, 10) || 15, 1);
    const reference = job.last_scanned_at || job.last_enqueued_at;
    const elapsedMs = reference ? (Date.now() - new Date(reference).getTime()) : Number.MAX_SAFE_INTEGER;
    const thresholdMs = everyMinutes * 60 * 1000;

    if (elapsedMs >= thresholdMs) {
      await enqueueScan({ jobId: job.id, trigger: 'auto' });
      await dbPool.query(
        `UPDATE monitor_jobs SET last_enqueued_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [job.id]
      );
    }
  }
}

function createMonitorWorker({ db }) {
  if (worker) return { queue, worker };

  dbPool = db;
  const connection = getConnection();
  queue = new Queue(QUEUE_NAME, { connection });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const jobRowRes = await dbPool.query(
        `SELECT * FROM monitor_jobs WHERE id = $1`,
        [job.data.jobId]
      );

      const jobRow = jobRowRes.rows[0];
      if (!jobRow) return { skipped: true, reason: 'job_not_found' };

      const runRow = await dbPool.query(
        `INSERT INTO monitor_scan_runs
         (user_id, job_id, queue_job_id, trigger, status, started_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'running', NOW(), NOW(), NOW())
         RETURNING id`,
        [jobRow.user_id, jobRow.id, String(job.id), job.data.trigger || 'manual']
      );

      const runId = runRow.rows[0].id;
      const timeoutMs = Math.max(parseInt(process.env.MONITOR_SCAN_TIMEOUT_MS, 10) || 120000, 30000);

      try {
        const result = await runWithTimeout(scanMonitorJob({ db: dbPool, jobRow }), timeoutMs);
        await dbPool.query(
          `UPDATE monitor_scan_runs
           SET status = 'completed',
               finished_at = NOW(),
               scanned_count = $2,
               inserted_count = $3,
               deduped_count = $4,
               filtered_intent_count = $5,
               filtered_score_count = $6,
               sample_candidates = $7::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [
            runId,
            result.scanned || 0,
            result.inserted || 0,
            result.deduped || 0,
            result.filteredIntent || 0,
            result.filteredScore || 0,
            JSON.stringify(result.sampleCandidates || [])
          ]
        );
        return result;
      } catch (error) {
        await dbPool.query(
          `UPDATE monitor_scan_runs
           SET status = 'failed',
               finished_at = NOW(),
               error_message = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [runId, error?.message || String(error)]
        );
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('failed', (job, error) => {
    console.error('Monitor worker job failed:', job?.id, error?.message || error, error?.stack || '');
  });

  worker.on('completed', (job, result) => {
    console.log('Monitor worker job completed:', job.id, result);
  });

  pollingTimer = setInterval(() => {
    pollAndEnqueueAutoRuns().catch((e) => console.error('Auto-run enqueue failed:', e.message));
  }, 60 * 1000);

  pollAndEnqueueAutoRuns().catch((e) => console.error('Initial auto-run enqueue failed:', e.message));

  return { queue, worker };
}

module.exports = {
  createMonitorWorker,
  enqueueScan,
};
