import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';

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
