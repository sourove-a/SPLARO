import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../lib/log';
import { orderStatusSchema, orderNoteSchema } from '../../../../../lib/validators';

export async function GET(request: NextRequest, context: { params: Promise<{ order_no: string }> }) {
  return withApiHandler(request, async ({ request: req }) => {
    const routeParams = await context.params;
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const orderNo = String(routeParams.order_no || '').trim();
    if (!orderNo) return jsonError('INVALID_ORDER_NO', 'Invalid order number.', 400);

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      const order = mem.orders.find((item) => item.order_no === orderNo);
      if (!order) return jsonError('NOT_FOUND', 'Order not found.', 404);
      const items = mem.orderItems.filter((item) => item.order_id === order.id);
      const timeline = mem.auditLogs.filter((item) => item.entity_type === 'order' && item.entity_id === orderNo);
      return jsonSuccess({ storage: 'fallback', order, items, timeline });
    }

    const [orderRows] = await db.execute('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
    const order = Array.isArray(orderRows) && orderRows[0] ? (orderRows[0] as any) : null;
    if (!order) return jsonError('NOT_FOUND', 'Order not found.', 404);

    const [itemRows] = await db.execute(
      `SELECT id, order_id, product_id, product_name, product_url, image_url, quantity, unit_price, line_total
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [order.id],
    );

    const [timelineRows] = await db.execute(
      `SELECT id, action, entity_type, entity_id, before_json, after_json, created_at
       FROM audit_logs
       WHERE entity_type = 'order' AND entity_id = ?
       ORDER BY created_at ASC`,
      [orderNo],
    );

    return jsonSuccess({
      storage: 'mysql',
      order,
      items: Array.isArray(itemRows) ? itemRows : [],
      timeline: Array.isArray(timelineRows) ? timelineRows : [],
    });
  });
}

/**
 * PATCH /api/admin/orders/[order_no]
 * Update a single order: status, admin_note, refund flags.
 * Body: { action: 'status' | 'note' | 'refund'; ...fields }
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ order_no: string }> }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const routeParams = await context.params;
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const orderNo = String(routeParams.order_no || '').trim();
    if (!orderNo) return jsonError('INVALID_ORDER_NO', 'Invalid order number.', 400);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('INVALID_PAYLOAD', 'Invalid update payload.', 400);
    }

    const action = String((body as any).action || 'status').trim().toLowerCase();
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.orders.findIndex((o) => o.order_no === orderNo);
      if (idx < 0) return jsonError('NOT_FOUND', 'Order not found.', 404);
      const before = { ...mem.orders[idx] };
      const now = new Date().toISOString();

      if (action === 'status') {
        const parsed = orderStatusSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError('VALIDATION_ERROR', 'Invalid status payload.', 400, {
            details: parsed.error.flatten(),
          });
        }
        const { status, refund_requested, refunded, actor_id } = parsed.data;
        mem.orders[idx] = {
          ...mem.orders[idx],
          status,
          ...(typeof refund_requested === 'boolean' ? { is_refund_requested: refund_requested } : {}),
          ...(typeof refunded === 'boolean' ? { is_refunded: refunded } : {}),
          updated_at: now,
        };
        await writeAuditLog({ actorId: actor_id || null, action: 'ORDER_STATUS_UPDATED', entityType: 'order', entityId: orderNo, before, after: mem.orders[idx], ipAddress: ip });
        await writeSystemLog({ eventType: 'ORDER_STATUS_UPDATED_FALLBACK', description: `Order ${orderNo} → ${status}`, ipAddress: ip });
      } else if (action === 'note') {
        const parsed = orderNoteSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError('VALIDATION_ERROR', 'Invalid note payload.', 400, {
            details: parsed.error.flatten(),
          });
        }
        mem.orders[idx] = { ...mem.orders[idx], admin_note: parsed.data.note, updated_at: now };
        await writeAuditLog({ actorId: parsed.data.actor_id || null, action: 'ORDER_NOTE_UPDATED', entityType: 'order', entityId: orderNo, before, after: mem.orders[idx], ipAddress: ip });
      } else {
        return jsonError('UNKNOWN_ACTION', `Unknown action: ${action}.`, 400);
      }

      return jsonSuccess({ storage: 'fallback', order: mem.orders[idx] });
    }

    const [existingRows] = await db.execute('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'Order not found.', 404);

    if (action === 'status') {
      const parsed = orderStatusSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('VALIDATION_ERROR', 'Invalid status payload.', 400, {
          details: parsed.error.flatten(),
        });
      }
      const { status, refund_requested, refunded, actor_id } = parsed.data;

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
      await db.execute(`UPDATE orders SET ${setParts.join(', ')} WHERE order_no = ?`, params);

      await writeAuditLog({
        actorId: actor_id || null,
        action: 'ORDER_STATUS_UPDATED',
        entityType: 'order',
        entityId: orderNo,
        before: { status: existing.status },
        after: { status },
        ipAddress: ip,
      });
      await writeSystemLog({ eventType: 'ORDER_STATUS_UPDATED', description: `Order ${orderNo} → ${status}`, userId: actor_id || null, ipAddress: ip });

    } else if (action === 'note') {
      const parsed = orderNoteSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('VALIDATION_ERROR', 'Invalid note payload.', 400, {
          details: parsed.error.flatten(),
        });
      }
      await db.execute('UPDATE orders SET admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE order_no = ?', [parsed.data.note, orderNo]);

      await writeAuditLog({
        actorId: parsed.data.actor_id || null,
        action: 'ORDER_NOTE_UPDATED',
        entityType: 'order',
        entityId: orderNo,
        before: { admin_note: existing.admin_note },
        after: { admin_note: parsed.data.note },
        ipAddress: ip,
      });
    } else {
      return jsonError('UNKNOWN_ACTION', `Unknown action: ${action}.`, 400);
    }

    const [updatedRows] = await db.execute('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : existing;

    return jsonSuccess({ storage: 'mysql', order: updated });
  }, {
    rateLimitScope: 'admin_orders_patch',
    rateLimitLimit: 120,
    rateLimitWindowMs: 60_000,
  });
}
