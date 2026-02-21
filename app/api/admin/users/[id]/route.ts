import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const id = String(context.params.id || '').trim();
    if (!id) return jsonError('INVALID_ID', 'Invalid user id.', 400);

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      const user = mem.users.find((item) => item.id === id);
      if (!user) return jsonError('NOT_FOUND', 'User not found.', 404);
      const orders = mem.orders.filter((order) => order.user_id === user.id || order.email === user.email);
      return jsonSuccess({ storage: 'fallback', user, orders });
    }

    const [userRows] = await db.execute(
      'SELECT id, name, email, phone, district, thana, address, role, is_blocked, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    const user = Array.isArray(userRows) && userRows[0] ? (userRows[0] as any) : null;
    if (!user) return jsonError('NOT_FOUND', 'User not found.', 404);

    const [orderRows] = await db.execute(
      `SELECT id, order_no, status, subtotal, shipping, discount, total, created_at
       FROM orders
       WHERE user_id = ? OR email = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [id, user.email],
    );

    return jsonSuccess({ storage: 'mysql', user, orders: Array.isArray(orderRows) ? orderRows : [] });
  });
}
