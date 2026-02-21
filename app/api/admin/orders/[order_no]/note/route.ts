import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../../lib/env';
import { fallbackStore } from '../../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../../lib/log';
import { orderNoteSchema } from '../../../../../../lib/validators';

export async function POST(request: NextRequest, context: { params: { order_no: string } }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const orderNo = String(context.params.order_no || '').trim();
    if (!orderNo) return jsonError('INVALID_ORDER_NO', 'Invalid order number.', 400);

    const body = await req.json().catch(() => null);
    const parsed = orderNoteSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid note payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.orders.findIndex((item) => item.order_no === orderNo);
      if (idx < 0) return jsonError('NOT_FOUND', 'Order not found.', 404);

      const before = { ...mem.orders[idx] };
      mem.orders[idx] = {
        ...mem.orders[idx],
        admin_note: payload.note,
        updated_at: new Date().toISOString(),
      };
      const after = mem.orders[idx];

      await writeAuditLog({
        actorId: payload.actor_id || null,
        action: 'ORDER_NOTE_UPDATED',
        entityType: 'order',
        entityId: orderNo,
        before,
        after,
        ipAddress: ip,
      });
      await writeSystemLog({
        eventType: 'ORDER_NOTE_UPDATED_FALLBACK',
        description: `Order note updated: ${orderNo}`,
        userId: payload.actor_id || null,
        ipAddress: ip,
      });

      return jsonSuccess({ storage: 'fallback', order: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'Order not found.', 404);

    await db.execute(
      'UPDATE orders SET admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE order_no = ?',
      [payload.note, orderNo],
    );

    const [updatedRows] = await db.execute('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? (updatedRows[0] as any) : null;

    await writeAuditLog({
      actorId: payload.actor_id || null,
      action: 'ORDER_NOTE_UPDATED',
      entityType: 'order',
      entityId: orderNo,
      before: existing,
      after: updated,
      ipAddress: ip,
    });
    await writeSystemLog({
      eventType: 'ORDER_NOTE_UPDATED',
      description: `Order note updated: ${orderNo}`,
      userId: payload.actor_id || null,
      ipAddress: ip,
    });

    return jsonSuccess({ storage: 'mysql', order: updated });
  }, {
    rateLimitScope: 'admin_orders_note',
    rateLimitLimit: 80,
    rateLimitWindowMs: 60_000,
  });
}
