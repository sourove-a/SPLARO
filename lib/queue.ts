import { randomUUID } from 'node:crypto';
import { getDbPool } from './db';
import { logError, logInfo } from './logger';
import { withOperationTimeout } from './error-handler';

export type QueueType = 'SHEETS' | 'TELEGRAM' | 'PUSH' | 'INTEGRATION' | 'ORDER_EVENT';
export type QueueStatus = 'PENDING' | 'PROCESSING' | 'RETRY' | 'DONE' | 'DEAD';

export type QueueJobPayload = Record<string, unknown>;

type QueueInsertResult = {
  id: string;
  mode: 'redis' | 'mysql' | 'memory';
};

type QueueStat = {
  status: QueueStatus;
  total: number;
};

type OptionalBullQueue = {
  add: (name: string, data: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ id?: string | number }>;
};

let bullQueuePromise: Promise<OptionalBullQueue | null> | null = null;
const memoryQueue: Array<{
  id: string;
  queueType: QueueType;
  payload: QueueJobPayload;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  status: QueueStatus;
}> = [];

async function ensureSyncQueueTable(): Promise<void> {
  const db = await getDbPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      queue_key VARCHAR(64) NOT NULL,
      sync_type VARCHAR(64) NOT NULL,
      payload_json LONGTEXT NULL,
      status ENUM('PENDING','PROCESSING','RETRY','DONE','DEAD') NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 5,
      next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at DATETIME NULL,
      last_http_code INT NULL,
      last_error TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_sync_queue_queue_key (queue_key),
      KEY idx_sync_queue_status_next (status, next_attempt_at),
      KEY idx_sync_queue_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getBullQueue(): Promise<OptionalBullQueue | null> {
  if (bullQueuePromise) return bullQueuePromise;
  bullQueuePromise = (async () => {
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    if (!redisUrl) return null;

    try {
      const dynamicImport = new Function('mod', 'return import(mod)') as (mod: string) => Promise<any>;
      const bull = await dynamicImport('bullmq');
      const queueName = String(process.env.BULLMQ_QUEUE_NAME || 'splaro-jobs').trim();
      const queue = new bull.Queue(queueName, {
        connection: { url: redisUrl },
        defaultJobOptions: {
          removeOnComplete: 300,
          removeOnFail: 500,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 600,
          },
        },
      });
      logInfo('queue_bullmq_enabled', { queueName });
      return queue as OptionalBullQueue;
    } catch (error) {
      logError('queue_bullmq_init_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  })();
  return bullQueuePromise;
}

function encodePayload(payload: QueueJobPayload): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return '{}';
  }
}

function parsePayload(raw: unknown): QueueJobPayload {
  try {
    if (typeof raw !== 'string') return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function enqueueJob(input: {
  type: QueueType;
  payload: QueueJobPayload;
  idempotencyKey?: string;
  maxAttempts?: number;
}): Promise<QueueInsertResult> {
  const queueKey = String(input.idempotencyKey || randomUUID()).trim();
  const maxAttempts = Math.max(1, Math.min(10, Number(input.maxAttempts || 5)));

  const bullQueue = await getBullQueue();
  if (bullQueue) {
    const job = await withOperationTimeout(
      () => bullQueue.add(input.type, input.payload, {
        jobId: queueKey,
        attempts: maxAttempts,
      }),
      5_000,
      'QUEUE_TIMEOUT',
      'Queue add timeout',
    );
    return {
      id: String(job?.id || queueKey),
      mode: 'redis',
    };
  }

  const db = await getDbPool();
  if (db) {
    await ensureSyncQueueTable();
    await db.execute(
      `INSERT INTO sync_queue (queue_key, sync_type, payload_json, status, attempts, max_attempts, next_attempt_at)
       VALUES (?, ?, ?, 'PENDING', 0, ?, NOW())
       ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), max_attempts = VALUES(max_attempts), updated_at = CURRENT_TIMESTAMP`,
      [queueKey, input.type, encodePayload(input.payload), maxAttempts],
    );
    return {
      id: queueKey,
      mode: 'mysql',
    };
  }

  memoryQueue.push({
    id: queueKey,
    queueType: input.type,
    payload: input.payload,
    attempts: 0,
    maxAttempts,
    nextAttemptAt: Date.now(),
    status: 'PENDING',
  });
  return {
    id: queueKey,
    mode: 'memory',
  };
}

export async function markJobDone(queueKey: string, errorMessage?: string | null): Promise<void> {
  const key = String(queueKey || '').trim();
  if (!key) return;
  const db = await getDbPool();
  if (!db) {
    const row = memoryQueue.find((item) => item.id === key);
    if (!row) return;
    row.status = errorMessage ? 'DEAD' : 'DONE';
    row.attempts += 1;
    return;
  }
  await ensureSyncQueueTable();
  if (errorMessage) {
    await db.execute(
      `UPDATE sync_queue
       SET status = 'DEAD', attempts = attempts + 1, last_error = ?, locked_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE queue_key = ?`,
      [errorMessage, key],
    );
    return;
  }
  await db.execute(
    `UPDATE sync_queue
     SET status = 'DONE', attempts = attempts + 1, last_error = NULL, locked_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE queue_key = ?`,
    [key],
  );
}

export async function processMysqlQueue(
  handlers: Partial<Record<QueueType, (payload: QueueJobPayload) => Promise<void>>>,
  limit = 25,
): Promise<{ processed: number; failed: number; dead: number }> {
  const db = await getDbPool();
  if (!db) return { processed: 0, failed: 0, dead: 0 };
  await ensureSyncQueueTable();

  const batchLimit = Math.max(1, Math.min(200, Number(limit || 25)));
  const [rows] = await db.execute(
    `SELECT id, queue_key, sync_type, payload_json, attempts, max_attempts
     FROM sync_queue
     WHERE status IN ('PENDING', 'RETRY') AND next_attempt_at <= NOW()
     ORDER BY id ASC
     LIMIT ?`,
    [batchLimit],
  );

  const jobs = Array.isArray(rows) ? rows as any[] : [];
  let processed = 0;
  let failed = 0;
  let dead = 0;

  for (const job of jobs) {
    const id = Number(job.id);
    const queueKey = String(job.queue_key || id);
    const queueType = String(job.sync_type || 'INTEGRATION').toUpperCase() as QueueType;
    const attempts = Number(job.attempts || 0);
    const maxAttempts = Number(job.max_attempts || 5);
    const payload = parsePayload(job.payload_json);
    const handler = handlers[queueType];

    if (!handler) {
      await db.execute(
        `UPDATE sync_queue
         SET status = 'DEAD', attempts = attempts + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [`NO_HANDLER_FOR_${queueType}`, id],
      );
      failed += 1;
      dead += 1;
      continue;
    }

    await db.execute(
      `UPDATE sync_queue SET status = 'PROCESSING', locked_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );

    try {
      await withOperationTimeout(() => handler(payload), 10_000, 'JOB_TIMEOUT', 'Queue job timed out');
      await db.execute(
        `UPDATE sync_queue
         SET status = 'DONE', attempts = attempts + 1, locked_at = NULL, last_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id],
      );
      processed += 1;
    } catch (error) {
      const nextAttempts = attempts + 1;
      const isDead = nextAttempts >= maxAttempts;
      const delaySeconds = Math.min(120, Math.pow(2, Math.max(1, nextAttempts)));
      await db.execute(
        `UPDATE sync_queue
         SET status = ?, attempts = ?, locked_at = NULL, last_error = ?, next_attempt_at = ${isDead ? 'NOW()' : 'DATE_ADD(NOW(), INTERVAL ? SECOND)'}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        isDead
          ? ['DEAD', nextAttempts, error instanceof Error ? error.message : String(error), id]
          : ['RETRY', nextAttempts, error instanceof Error ? error.message : String(error), delaySeconds, id],
      );
      failed += 1;
      if (isDead) dead += 1;

      logError('queue_job_failed', {
        queueKey,
        queueType,
        attempts: nextAttempts,
        maxAttempts,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed, failed, dead };
}

export async function getQueueStats(): Promise<{
  mode: 'redis' | 'mysql' | 'memory';
  status: QueueStatus[];
  totals: Record<QueueStatus, number>;
}> {
  const db = await getDbPool();
  const defaultTotals: Record<QueueStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    RETRY: 0,
    DONE: 0,
    DEAD: 0,
  };

  if (!db) {
    for (const row of memoryQueue) {
      defaultTotals[row.status] += 1;
    }
    return {
      mode: 'memory',
      status: ['PENDING', 'PROCESSING', 'RETRY', 'DONE', 'DEAD'],
      totals: defaultTotals,
    };
  }

  await ensureSyncQueueTable();
  const [rows] = await db.query(
    `SELECT status, COUNT(*) AS total
     FROM sync_queue
     GROUP BY status`,
  );
  const stats = Array.isArray(rows) ? rows as QueueStat[] : [];
  for (const row of stats) {
    const status = String(row.status || '').toUpperCase() as QueueStatus;
    if (status in defaultTotals) {
      defaultTotals[status] = Number(row.total || 0);
    }
  }
  return {
    mode: (await getBullQueue()) ? 'redis' : 'mysql',
    status: ['PENDING', 'PROCESSING', 'RETRY', 'DONE', 'DEAD'],
    totals: defaultTotals,
  };
}
