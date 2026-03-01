import { getDbPool } from './db';

function emitLocalLog(level: 'info' | 'error', event: string, payload: Record<string, unknown>): void {
  const logger = level === 'error' ? console.error : console.log;
  logger(JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...payload,
  }));
}

export async function writeSystemLog(input: {
  eventType: string;
  description: string;
  userId?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const db = await getDbPool();
    if (!db) return;

    await db.execute(
      `INSERT INTO system_logs (event_type, event_description, user_id, ip_address)
       VALUES (?, ?, ?, ?)`,
      [input.eventType, input.description, input.userId || null, input.ipAddress || null],
    );
  } catch (error) {
    emitLocalLog('error', 'system_log_write_failed', {
      eventType: input.eventType,
      description: input.description,
      userId: input.userId || null,
      ipAddress: input.ipAddress || null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function writeAuditLog(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const db = await getDbPool();
    if (!db) return;

    await db.execute(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.actorId || null,
        input.action,
        input.entityType,
        input.entityId,
        input.before == null ? null : JSON.stringify(input.before),
        input.after == null ? null : JSON.stringify(input.after),
        input.ipAddress || null,
      ],
    );
  } catch (error) {
    emitLocalLog('error', 'audit_log_write_failed', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId || null,
      ipAddress: input.ipAddress || null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function trackRequestTiming(input: {
  path: string;
  method: string;
  durationMs: number;
  status: number;
  requestId?: string;
  cacheHit?: boolean | null;
  ipAddress?: string | null;
}): Promise<void> {
  const description = `${input.method} ${input.path} status=${input.status} duration_ms=${Math.round(input.durationMs)} request_id=${input.requestId || '-'} cache_hit=${input.cacheHit == null ? '-' : input.cacheHit}`;
  await writeSystemLog({
    eventType: 'REQUEST_TIMING',
    description,
    ipAddress: input.ipAddress || null,
  });

  emitLocalLog('info', 'request_timing', {
    path: input.path,
    method: input.method,
    status: input.status,
    duration_ms: Math.round(input.durationMs),
    request_id: input.requestId || '',
    cache_hit: input.cacheHit == null ? null : Boolean(input.cacheHit),
    ip: input.ipAddress || null,
  });
}
