import { NextRequest } from 'next/server';
import { getDbPool, getStorageInfo } from '../../../lib/db';
import { jsonSuccess, requestIp } from '../../../lib/env';
import { setNoStoreHeaders } from '../../../lib/httpCache';
import { getCacheStore } from '../../../lib/cache';
import { getQueueStats } from '../../../lib/queue';
import { getRequestId, withOperationTimeout } from '../../../lib/error-handler';
import { getEnvValidationReport } from '../../../lib/envValidation';

type ProbeState = {
  status: 'OK' | 'WARNING' | 'DOWN';
  latency_ms: number | null;
  last_checked_at: string;
  error: string;
  next_action: string;
};

function probeOk(latencyMs: number | null, lastCheckedAt: string): ProbeState {
  return {
    status: 'OK',
    latency_ms: latencyMs,
    last_checked_at: lastCheckedAt,
    error: '',
    next_action: '',
  };
}

function probeWarn(lastCheckedAt: string, error: string, nextAction: string, latencyMs: number | null = null): ProbeState {
  return {
    status: 'WARNING',
    latency_ms: latencyMs,
    last_checked_at: lastCheckedAt,
    error,
    next_action: nextAction,
  };
}

function probeDown(lastCheckedAt: string, error: string, nextAction: string, latencyMs: number | null = null): ProbeState {
  return {
    status: 'DOWN',
    latency_ms: latencyMs,
    last_checked_at: lastCheckedAt,
    error,
    next_action: nextAction,
  };
}

export async function GET(request: NextRequest) {
  const started = Date.now();
  const requestId = getRequestId(request.headers);
  const ip = requestIp(request.headers);
  const info = await getStorageInfo();
  const nowIso = new Date().toISOString();

  const services: Record<string, ProbeState> = {};
  let mode: 'NORMAL' | 'DEGRADED' = 'NORMAL';
  let dbLatency: number | null = null;
  const envValidation = getEnvValidationReport();

  const db = await getDbPool();
  if (!db) {
    mode = 'DEGRADED';
    services.db = probeDown(
      nowIso,
      info.error || 'DATABASE_CONNECTION_FAILED',
      'Check DB credentials and server availability.',
    );
  } else {
    const dbStarted = Date.now();
    try {
      await withOperationTimeout(() => db.query('SELECT 1 AS ok'), 4_000, 'DB_HEALTH_TIMEOUT', 'Database health probe timed out.');
      dbLatency = Date.now() - dbStarted;
      services.db = probeOk(dbLatency, nowIso);
    } catch (error) {
      mode = 'DEGRADED';
      const message = error instanceof Error ? error.message : 'DATABASE_HEALTH_CHECK_FAILED';
      services.db = probeDown(nowIso, message, 'Inspect database connectivity and slow query load.', Date.now() - dbStarted);
    }
  }

  const cacheStarted = Date.now();
  try {
    const cache = await getCacheStore();
    const healthKey = `health:${requestId}`;
    await withOperationTimeout(() => cache.set(healthKey, { ok: true, ts: nowIso }, 10), 2_500, 'CACHE_SET_TIMEOUT', 'Cache set timeout.');
    const readBack = await withOperationTimeout(() => cache.get<{ ok: boolean }>(healthKey), 2_500, 'CACHE_GET_TIMEOUT', 'Cache read timeout.');
    await cache.del(healthKey);
    if (!readBack?.ok) {
      services.cache = probeWarn(nowIso, 'CACHE_READBACK_MISMATCH', 'Inspect cache backend configuration.', Date.now() - cacheStarted);
    } else {
      services.cache = probeOk(Date.now() - cacheStarted, nowIso);
    }
  } catch (error) {
    services.cache = probeWarn(
      nowIso,
      error instanceof Error ? error.message : 'CACHE_PROBE_FAILED',
      'Cache unavailable. Memory fallback is active.',
      Date.now() - cacheStarted,
    );
  }

  const queueStarted = Date.now();
  try {
    const queue = await getQueueStats();
    const dead = Number(queue.totals.DEAD || 0);
    const retry = Number(queue.totals.RETRY || 0);
    if (dead > 0) {
      services.queue = probeWarn(
        nowIso,
        `DEAD_JOBS:${dead}`,
        'Recover dead queue jobs and inspect last error.',
        Date.now() - queueStarted,
      );
    } else if (retry > 10) {
      services.queue = probeWarn(
        nowIso,
        `RETRY_BACKLOG:${retry}`,
        'Queue has high retry backlog.',
        Date.now() - queueStarted,
      );
    } else {
      services.queue = probeOk(Date.now() - queueStarted, nowIso);
    }
  } catch (error) {
    services.queue = probeWarn(
      nowIso,
      error instanceof Error ? error.message : 'QUEUE_PROBE_FAILED',
      'Inspect queue table/worker status.',
      Date.now() - queueStarted,
    );
  }

  const telegramEnabled = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  services.telegram = telegramEnabled
    ? probeOk(null, nowIso)
    : probeWarn(nowIso, 'TELEGRAM_DISABLED', 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');

  const sheetsEnabled = Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.GOOGLE_OAUTH_CLIENT_ID);
  services.sheets = sheetsEnabled
    ? probeOk(null, nowIso)
    : probeWarn(nowIso, 'SHEETS_DISABLED', 'Configure Google Sheets webhook/OAuth credentials.');

  const pushEnabled = Boolean(process.env.PUSH_VAPID_PUBLIC_KEY && process.env.PUSH_VAPID_PRIVATE_KEY);
  services.push = pushEnabled
    ? probeOk(null, nowIso)
    : probeWarn(nowIso, 'PUSH_DISABLED', 'Configure PUSH_VAPID_PUBLIC_KEY and PUSH_VAPID_PRIVATE_KEY.');

  const sslEnabled = Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);
  services.sslcommerz = sslEnabled
    ? probeOk(null, nowIso)
    : probeWarn(nowIso, 'SSLCOMMERZ_DISABLED', 'Configure SSLCommerz credentials.');

  const steadfastEnabled = Boolean(process.env.STEADFAST_API_KEY || process.env.STEADFAST_TOKEN);
  services.steadfast = steadfastEnabled
    ? probeOk(null, nowIso)
    : probeWarn(nowIso, 'STEADFAST_DISABLED', 'Configure Steadfast API credentials.');

  return setNoStoreHeaders(jsonSuccess({
    ok: true,
    status: 'success',
    service: 'SPLARO_API',
    timestamp: nowIso,
    request_id: requestId,
    mode,
    ip,
    envSource: process.env.DB_PASSWORD_URLENC ? 'RUNTIME_ENV:DB_PASSWORD_URLENC' : 'RUNTIME_ENV',
    dbPasswordSource: process.env.DB_PASSWORD_URLENC ? 'DB_PASSWORD_URLENC' : (process.env.DB_PASSWORD ? 'DB_PASSWORD' : (process.env.DB_PASS ? 'DB_PASS' : '')),
    services,
    queue: services.queue.status === 'OK' ? undefined : {
      note: 'Use queue recovery worker for DEAD/RETRY jobs.',
    },
    envValidation,
    uptime_ms: Date.now() - started,
    db: {
      connected: Boolean(db),
      latency_ms: dbLatency,
      storage: info.storage,
      host: info.dbHost,
      name: info.dbName,
      port: info.dbPort,
      error: info.error || null,
    },
    storage: info.storage,
    dbHost: info.dbHost,
    dbName: info.dbName,
    mode_hint: info.storage === 'mysql' ? 'NORMAL' : 'DEGRADED',
  }));
}
