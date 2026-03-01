import type { Pool } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import { ensureTables } from './migrate';
import { resolveDbEnv, type StorageMode } from './env';
import { isTransientDbError, withRetries } from './error-handler';
import { logError, logInfo } from './logger';

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;
let migrationPromise: Promise<void> | null = null;
let storageMode: StorageMode = 'fallback';
let connectedHost = '';
let lastError = '';
let lastInitAttemptAt = 0;

const REINIT_BACKOFF_MS = 10_000;

function safeNumber(input: unknown, fallback: number, min = 1, max = 10_000): number {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function poolTargetSize(): number {
  return safeNumber(process.env.DB_POOL_TARGET || 6, 6, 5, 10);
}

async function ensureMigrated(activePool: Pool): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = ensureTables(activePool).catch((error: unknown) => {
      migrationPromise = null;
      throw error;
    });
  }
  await migrationPromise;
}

async function init(): Promise<void> {
  const now = Date.now();
  if (!pool && now - lastInitAttemptAt < REINIT_BACKOFF_MS) {
    return;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    lastInitAttemptAt = Date.now();
    const env = resolveDbEnv();
    if (!env.configured) {
      storageMode = 'fallback';
      lastError = `Missing env: ${env.missing.join(', ')}`;
      initPromise = null;
      return;
    }

    for (const host of env.hostCandidates) {
      try {
        const candidate = createPool({
          host,
          port: env.port,
          user: env.user,
          password: env.password,
          database: env.name,
          connectionLimit: poolTargetSize(),
          maxIdle: poolTargetSize(),
          idleTimeout: safeNumber(process.env.DB_IDLE_TIMEOUT_SECONDS || 90, 90, 15, 3600) * 1000,
          waitForConnections: true,
          queueLimit: 0,
          connectTimeout: safeNumber(process.env.DB_CONNECT_TIMEOUT_SECONDS || 5, 5, 2, 20) * 1000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          decimalNumbers: true,
          charset: 'utf8mb4',
        });

        candidate.on('connection', (connection: any) => {
          const lockWaitTimeout = safeNumber(process.env.DB_LOCK_WAIT_TIMEOUT_SECONDS || 10, 10, 3, 120);
          const queryTimeoutMs = safeNumber(process.env.DB_QUERY_TIMEOUT_MS || 3500, 3500, 500, 60_000);
          const safeExec = (sql: string) => {
            try {
              connection.query(sql, () => {
                // best-effort session tuning
              });
            } catch {
              // no-op
            }
          };
          safeExec(`SET SESSION innodb_lock_wait_timeout = ${lockWaitTimeout}`);
          safeExec(`SET SESSION wait_timeout = ${safeNumber(process.env.DB_IDLE_TIMEOUT_SECONDS || 90, 90, 15, 3600)}`);
          safeExec(`SET SESSION interactive_timeout = ${safeNumber(process.env.DB_IDLE_TIMEOUT_SECONDS || 90, 90, 15, 3600)}`);
          safeExec(`SET SESSION max_execution_time = ${queryTimeoutMs}`);
        });

        await withRetries(
          () => candidate.query('SELECT 1'),
          {
            maxRetries: safeNumber(process.env.DB_RETRY_MAX || 3, 3, 0, 5),
            baseDelayMs: safeNumber(process.env.DB_RETRY_BASE_DELAY_MS || 120, 120, 50, 2_000),
            shouldRetry: (error) => isTransientDbError(error),
          },
        );
        await ensureMigrated(candidate);

        pool = candidate;
        storageMode = 'mysql';
        connectedHost = host;
        lastError = '';
        initPromise = null;
        logInfo('db_pool_connected', {
          host,
          port: env.port,
          database: env.name,
          poolTarget: poolTargetSize(),
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown connection error';
        lastError = `${host}: ${message}`;
        logError('db_pool_connect_failed', {
          host,
          port: env.port,
          database: env.name,
          error: message,
        });
      }
    }

    storageMode = 'fallback';
    initPromise = null;
  })();

  return initPromise;
}

export async function getDbPool(): Promise<Pool | null> {
  await init();
  return pool;
}

export async function getStorageInfo(): Promise<{
  storage: StorageMode;
  connected: boolean;
  dbHost: string;
  dbName: string;
  dbPort: number;
  error?: string;
}> {
  const env = resolveDbEnv();
  await init();

  return {
    storage: storageMode,
    connected: Boolean(pool),
    dbHost: connectedHost || env.host,
    dbName: env.name,
    dbPort: env.port,
    error: lastError || undefined,
  };
}

export async function withDb<T>(fn: (db: Pool) => Promise<T>): Promise<T | null> {
  const db = await getDbPool();
  if (!db) return null;
  return fn(db);
}

export async function nextOrderNumber(): Promise<string | null> {
  const db = await getDbPool();
  if (!db) return null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO order_counters (id, seq) VALUES (1, 0) ON DUPLICATE KEY UPDATE seq = seq');
    await conn.query('UPDATE order_counters SET seq = LAST_INSERT_ID(seq + 1) WHERE id = 1');
    const [rows] = await conn.query('SELECT LAST_INSERT_ID() AS seq');
    await conn.commit();

    const seq = Array.isArray(rows) && rows[0] ? Number((rows[0] as { seq: number }).seq) : 1;
    return `SPL-${String(seq).padStart(6, '0')}`;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
