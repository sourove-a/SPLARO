import type { Pool } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import { ensureTables } from './migrate';
import { resolveDbEnv, type StorageMode } from './env';

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;
let migrationPromise: Promise<void> | null = null;
let storageMode: StorageMode = 'fallback';
let connectedHost = '';
let lastError = '';

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
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const env = resolveDbEnv();
    if (!env.configured) {
      storageMode = 'fallback';
      lastError = `Missing env: ${env.missing.join(', ')}`;
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
          connectionLimit: 10,
          waitForConnections: true,
          queueLimit: 0,
          connectTimeout: 5000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          decimalNumbers: true,
          charset: 'utf8mb4',
        });

        await candidate.query('SELECT 1');
        await ensureMigrated(candidate);

        pool = candidate;
        storageMode = 'mysql';
        connectedHost = host;
        lastError = '';
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown connection error';
        lastError = `${host}: ${message}`;
      }
    }

    storageMode = 'fallback';
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
