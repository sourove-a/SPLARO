import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../lib/log';
import { orderStatusSchema } from '../../../../../lib/validators';

/**
 * PATCH /api/admin/orders/status
 * Bulk or single order status update.
 * Body: { order_no: string; status: OrderStatus; actor_id?: string }
 *       OR { order_nos: string[]; status: OrderStatus; actor_id?: string }
 */
export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('INVALID_PAYLOAD', 'Invalid status update payload.', 400);
    }

    const statusParsed = orderStatusSchema.safeParse(body);
    if (!statusParsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid status value.', 400, {
        details: statusParsed.error.flatten(),
      });
    }

    const { status, actor_id, refund_requested, refunded } = statusParsed.data;

    // Support both single order_no and bulk order_nos
    const rawOrderNo = String((body as any).order_no || '').trim();
    const rawOrderNos: string[] = Array.isArray((body as any).order_nos)
      ? (body as any).order_nos.map((n: unknown) => String(n || '').trim()).filter(Boolean)
      : [];

    if (!rawOrderNo && rawOrderNos.length === 0) {
      return jsonError('MISSING_ORDER_NO', 'Provide order_no or order_nos.', 400);
    }

    const orderNos = rawOrderNo ? [rawOrderNo, ...rawOrderNos] : rawOrderNos;
    const uniqueOrderNos = [...new Set(orderNos)];

    if (uniqueOrderNos.length > 100) {
      return jsonError('BATCH_TOO_LARGE', 'Cannot update more than 100 orders at once.', 400);
    }

    const db = await getDbPool();
    const now = new Date().toISOString();
    const updated: string[] = [];
    const notFound: string[] = [];

    if (!db) {
      const mem = fallbackStore();

      for (const orderNo of uniqueOrderNos) {
        const idx = mem.orders.findIndex((o) => o.order_no === orderNo);
        if (idx < 0) {
          notFound.push(orderNo);
          continue;
        }

        const before = { ...mem.orders[idx] };
        mem.orders[idx] = {
          ...mem.orders[idx],
          status,
          ...(typeof refund_requested === 'boolean' ? { is_refund_requested: refund_requested } : {}),
          ...(typeof refunded === 'boolean' ? { is_refunded: refunded } : {}),
          updated_at: now,
        };
        const after = mem.orders[idx];

        await writeAuditLog({
          actorId: actor_id || null,
          action: 'ORDER_STATUS_UPDATED',
          entityType: 'order',
          entityId: orderNo,
          before,
          after,
          ipAddress: ip,
        });

        updated.push(orderNo);
      }

      await writeSystemLog({
        eventType: 'ORDER_STATUS_BULK_FALLBACK',
        description: `Status → ${status} for ${updated.length} order(s). Not found: ${notFound.length}`,
        userId: actor_id || null,
        ipAddress: ip,
      });

      return jsonSuccess({
        storage: 'fallback',
        status,
        updated,
        not_found: notFound,
        updated_count: updated.length,
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      for (const orderNo of uniqueOrderNos) {
        const [existing] = await conn.execute('SELECT id, status FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
        const row = Array.isArray(existing) && existing[0] ? (existing[0] as any) : null;

        if (!row) {
          notFound.push(orderNo);
          continue;
        }

        const setParts: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
        const params: unknown[] = [status];

        if (typeof refund_requested === 'boolean') {
          setParts.push('is_refund_requested = ?');
          params.push(refund_requested ? 1 : 0);
        }
        if (typeof refunded === 'boolean') {
          setParts.push('is_refunded = ?');
          params.push(refunded ? 1 : 0);
        }

        params.push(orderNo);
        await conn.execute(`UPDATE orders SET ${setParts.join(', ')} WHERE order_no = ?`, params);

        await writeAuditLog({
          actorId: actor_id || null,
          action: 'ORDER_STATUS_UPDATED',
          entityType: 'order',
          entityId: orderNo,
          before: { order_no: orderNo, status: row.status },
          after: { order_no: orderNo, status },
          ipAddress: ip,
        });

        updated.push(orderNo);
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    await writeSystemLog({
      eventType: 'ORDER_STATUS_BULK',
      description: `Status → ${status} for ${updated.length} order(s). Not found: ${notFound.length}`,
      userId: actor_id || null,
      ipAddress: ip,
    });

    return jsonSuccess({
      storage: 'mysql',
      status,
      updated,
      not_found: notFound,
      updated_count: updated.length,
    });
  }, {
    rateLimitScope: 'admin_orders_status',
    rateLimitLimit: 120,
    rateLimitWindowMs: 60_000,
  });
}
