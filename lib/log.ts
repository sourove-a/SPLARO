import { getDbPool } from './db';

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
  } catch {
    // best-effort logging
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
  } catch {
    // best-effort logging
  }
}

export async function trackRequestTiming(input: {
  path: string;
  method: string;
  durationMs: number;
  status: number;
  ipAddress?: string | null;
}): Promise<void> {
  const description = `${input.method} ${input.path} status=${input.status} duration_ms=${Math.round(input.durationMs)}`;
  await writeSystemLog({
    eventType: 'REQUEST_TIMING',
    description,
    ipAddress: input.ipAddress || null,
  });
}
