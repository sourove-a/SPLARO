import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../../lib/env';
import { fallbackStore } from '../../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../../lib/log';
import { orderStatusSchema } from '../../../../../../lib/validators';

export async function PATCH(request: NextRequest, context: { params: Promise<{ order_no: string }> }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const routeParams = await context.params;
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const orderNo = String(routeParams.order_no || '').trim();
    if (!orderNo) return jsonError('INVALID_ORDER_NO', 'Invalid order number.', 400);

    const body = await req.json().catch(() => null);
    const parsed = orderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid status payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const actorId = payload.actor_id || null;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.orders.findIndex((item) => item.order_no === orderNo);
      if (idx < 0) return jsonError('NOT_FOUND', 'Order not found.', 404);
      const before = { ...mem.orders[idx] };
      mem.orders[idx] = {
        ...mem.orders[idx],
        status: payload.status,
        is_refund_requested: typeof payload.refund_requested === 'boolean' ? payload.refund_requested : (mem.orders[idx] as any).is_refund_requested,
        is_refunded: typeof payload.refunded === 'boolean' ? payload.refunded : (mem.orders[idx] as any).is_refunded,
        updated_at: new Date().toISOString(),
      };
      const after = mem.orders[idx];

      await writeAuditLog({
        actorId,
        action: 'ORDER_STATUS_UPDATED',
        entityType: 'order',
        entityId: orderNo,
        before,
        after,
        ipAddress: ip,
      });
      await writeSystemLog({
        eventType: 'ORDER_STATUS_UPDATED_FALLBACK',
        description: `${orderNo} => ${payload.status}`,
        userId: actorId,
        ipAddress: ip,
      });

      return jsonSuccess({ storage: 'fallback', order: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'Order not found.', 404);

    await db.execute(
      `UPDATE orders
       SET status = ?,
           is_refund_requested = COALESCE(?, is_refund_requested),
           is_refunded = COALESCE(?, is_refunded),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_no = ?`,
      [
        payload.status,
        typeof payload.refund_requested === 'boolean' ? (payload.refund_requested ? 1 : 0) : null,
        typeof payload.refunded === 'boolean' ? (payload.refunded ? 1 : 0) : null,
        orderNo,
      ],
    );

    const [updatedRows] = await db.execute('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? (updatedRows[0] as any) : null;

    await writeAuditLog({
      actorId,
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'order',
      entityId: orderNo,
      before: existing,
      after: updated,
      ipAddress: ip,
    });
    await writeSystemLog({
      eventType: 'ORDER_STATUS_UPDATED',
      description: `${orderNo} => ${payload.status}`,
      userId: actorId,
      ipAddress: ip,
    });

    return jsonSuccess({ storage: 'mysql', order: updated });
  }, {
    rateLimitScope: 'admin_order_status_patch',
    rateLimitLimit: 80,
    rateLimitWindowMs: 60_000,
  });
}
