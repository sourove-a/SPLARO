import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

export async function GET(request: NextRequest, context: { params: { order_no: string } }) {
  return withApiHandler(request, async () => {
    const orderNo = String(context.params.order_no || '').trim();
    if (!orderNo) return jsonError('INVALID_ORDER_NO', 'Invalid order number.', 400);

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      const order = mem.orders.find((item) => item.order_no === orderNo);
      if (!order) return jsonError('NOT_FOUND', 'Order not found.', 404);
      const items = mem.orderItems.filter((item) => item.order_id === order.id);
      return jsonSuccess({ storage: 'fallback', order, items });
    }

    const [orderRows] = await db.execute(
      `SELECT id, order_no, user_id, name, email, phone, address, district, thana, status, subtotal, shipping, discount, total, created_at, updated_at
       FROM orders
       WHERE order_no = ?
       LIMIT 1`,
      [orderNo],
    );

    const order = Array.isArray(orderRows) && orderRows[0] ? (orderRows[0] as any) : null;
    if (!order) return jsonError('NOT_FOUND', 'Order not found.', 404);

    const [itemRows] = await db.execute(
      `SELECT id, order_id, product_id, product_name, product_url, image_url, quantity, unit_price, line_total
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [order.id],
    );

    return jsonSuccess({
      storage: 'mysql',
      order,
      items: Array.isArray(itemRows) ? itemRows : [],
    });
  });
}
