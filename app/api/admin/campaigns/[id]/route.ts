import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../lib/log';
import { campaignUpdateSchema } from '../../../../../lib/validators';

function actionStatus(action?: string): 'Active' | 'Paused' | 'Completed' | null {
  if (action === 'activate') return 'Active';
  if (action === 'pause') return 'Paused';
  if (action === 'complete') return 'Completed';
  return null;
}

async function computeTargetCount(db: any, segment: 'ALL_USERS' | 'NEW_SIGNUPS_7D' | 'INACTIVE_30D'): Promise<number> {
  if (segment === 'ALL_USERS') {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM users WHERE is_blocked = 0');
    return Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
  }
  if (segment === 'NEW_SIGNUPS_7D') {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM users WHERE is_blocked = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    return Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
  }
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM users u
     LEFT JOIN (
       SELECT email, MAX(created_at) AS last_order_at
       FROM orders
       GROUP BY email
     ) o ON o.email = u.email
     WHERE u.is_blocked = 0 AND (o.last_order_at IS NULL OR o.last_order_at < DATE_SUB(NOW(), INTERVAL 30 DAY))`,
  );
  return Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const id = String(context.params.id || '').trim();
    if (!id) return jsonError('INVALID_ID', 'Invalid campaign id.', 400);

    const db = await getDbPool();
    if (!db) {
      const item = fallbackStore().campaigns.find((row) => row.id === id && !row.deleted_at);
      if (!item) return jsonError('NOT_FOUND', 'Campaign not found.', 404);
      return jsonSuccess({ storage: 'fallback', item, logs: [] });
    }

    const [rows] = await db.execute('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
    const item = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
    if (!item) return jsonError('NOT_FOUND', 'Campaign not found.', 404);

    const [logRows] = await db.execute(
      `SELECT id, action, entity_type, entity_id, before_json, after_json, created_at
       FROM audit_logs
       WHERE entity_type = 'campaign' AND entity_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [id],
    );

    return jsonSuccess({ storage: 'mysql', item, logs: Array.isArray(logRows) ? logRows : [] });
  });
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const id = String(context.params.id || '').trim();
    if (!id) return jsonError('INVALID_ID', 'Invalid campaign id.', 400);

    const body = await req.json().catch(() => null);
    const action = String((body as any)?.action || '').trim().toLowerCase();
    const normalizedBody = body && typeof body === 'object'
      ? {
          ...body,
          audience_segment: (body as any).audience_segment || (body as any).audienceSegment || (body as any).segment?.type,
          target_count: (body as any).target_count ?? (body as any).targetCount,
          pulse_percent: (body as any).pulse_percent ?? (body as any).pulsePercent,
          schedule_time: (body as any).schedule_time || (body as any).scheduleTime,
          content: (body as any).content || (body as any).description,
        }
      : {};
    const parsed = campaignUpdateSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid campaign payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.campaigns.findIndex((item) => item.id === id && !item.deleted_at);
      if (idx < 0) return jsonError('NOT_FOUND', 'Campaign not found.', 404);

      const before = { ...mem.campaigns[idx] };

      if (action === 'delete') {
        mem.campaigns[idx] = {
          ...mem.campaigns[idx],
          deleted_at: new Date().toISOString(),
          status: 'Completed',
          updated_at: new Date().toISOString(),
        } as any;
      } else {
        mem.campaigns[idx] = {
          ...mem.campaigns[idx],
          ...payload,
          status: actionStatus(action) || payload.status || mem.campaigns[idx].status,
          updated_at: new Date().toISOString(),
        } as any;
      }

      const after = { ...mem.campaigns[idx] };
      await writeAuditLog({ action: 'CAMPAIGN_UPDATED', entityType: 'campaign', entityId: id, before, after, ipAddress: ip });
      await writeSystemLog({ eventType: 'CAMPAIGN_UPDATED_FALLBACK', description: `Campaign updated: ${id}`, ipAddress: ip });

      return jsonSuccess({ storage: 'fallback', item: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'Campaign not found.', 404);

    if (action === 'delete') {
      await db.execute('UPDATE campaigns SET deleted_at = NOW(), status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['Completed', id]);
    } else {
      const fields: string[] = [];
      const params: unknown[] = [];

      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'undefined') continue;
        fields.push(`${key} = ?`);
        params.push(value);
      }

      const nextStatus = actionStatus(action);
      if (nextStatus) {
        fields.push('status = ?');
        params.push(nextStatus);
      }

      if (payload.audience_segment) {
        const computed = await computeTargetCount(db, payload.audience_segment);
        fields.push('target_count = ?');
        params.push(computed);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      await db.execute(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    }

    const [updatedRows] = await db.execute('SELECT * FROM campaigns WHERE id = ? LIMIT 1', [id]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? (updatedRows[0] as any) : null;

    await writeAuditLog({ action: 'CAMPAIGN_UPDATED', entityType: 'campaign', entityId: id, before: existing, after: updated, ipAddress: ip });
    await writeSystemLog({ eventType: 'CAMPAIGN_UPDATED', description: `Campaign updated: ${id}`, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', item: updated });
  }, {
    rateLimitScope: 'admin_campaigns_write',
    rateLimitLimit: 40,
    rateLimitWindowMs: 60_000,
  });
}
