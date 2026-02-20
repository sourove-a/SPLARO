import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonSuccess, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      const totalSales = mem.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const now = Date.now();
      const daily = Array.from({ length: 7 }, (_, i) => {
        const start = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
        const key = start.toISOString().slice(0, 10);
        const count = mem.orders.filter((order) => order.created_at.slice(0, 10) === key).length;
        const sales = mem.orders
          .filter((order) => order.created_at.slice(0, 10) === key)
          .reduce((sum, order) => sum + Number(order.total || 0), 0);
        return { date: key, orders: count, sales };
      });

      return jsonSuccess({
        storage: 'fallback',
        summary: {
          users: mem.users.length,
          orders: mem.orders.length,
          products: mem.products.filter((p) => p.active).length,
          subscriptions: mem.subscriptions.length,
          total_sales: totalSales,
        },
        daily,
      });
    }

    const [summaryRows] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users_count,
        (SELECT COUNT(*) FROM orders) AS orders_count,
        (SELECT COUNT(*) FROM products WHERE active = 1) AS products_count,
        (SELECT COUNT(*) FROM subscriptions) AS subscriptions_count,
        (SELECT COALESCE(SUM(total),0) FROM orders) AS total_sales
    `);

    const [dailyRows] = await db.query(`
      SELECT DATE(created_at) AS date,
             COUNT(*) AS orders,
             COALESCE(SUM(total),0) AS sales
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    const summary = Array.isArray(summaryRows) && summaryRows[0] ? (summaryRows[0] as any) : {};

    return jsonSuccess({
      storage: 'mysql',
      summary: {
        users: Number(summary.users_count || 0),
        orders: Number(summary.orders_count || 0),
        products: Number(summary.products_count || 0),
        subscriptions: Number(summary.subscriptions_count || 0),
        total_sales: Number(summary.total_sales || 0),
      },
      daily: Array.isArray(dailyRows) ? dailyRows : [],
    });
  });
}
