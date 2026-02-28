import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool, getStorageInfo } from '../../../../lib/db';
import { jsonSuccess, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { getCacheStore } from '../../../../lib/cache';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const cache = await getCacheStore();
    const cacheKey = 'admin:metrics:v2';
    try {
      const cached = await cache.get<any>(cacheKey);
      if (cached) {
        return jsonSuccess({ ...cached, cache_hit: true });
      }
    } catch {
      // continue without cache
    }

    const db = await getDbPool();
    const storage = await getStorageInfo();

    if (!db) {
      const mem = fallbackStore();
      const now = Date.now();
      const todayKey = new Date().toISOString().slice(0, 10);
      const totalSales = mem.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const salesToday = mem.orders
        .filter((order) => String(order.created_at || '').slice(0, 10) === todayKey)
        .reduce((sum, order) => sum + Number(order.total || 0), 0);
      const sales7Days = mem.orders
        .filter((order) => new Date(order.created_at).getTime() >= now - 7 * 24 * 60 * 60 * 1000)
        .reduce((sum, order) => sum + Number(order.total || 0), 0);
      const sales30Days = mem.orders
        .filter((order) => new Date(order.created_at).getTime() >= now - 30 * 24 * 60 * 60 * 1000)
        .reduce((sum, order) => sum + Number(order.total || 0), 0);

      const daily = Array.from({ length: 7 }, (_, i) => {
        const start = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
        const key = start.toISOString().slice(0, 10);
        const count = mem.orders.filter((order) => order.created_at.slice(0, 10) === key).length;
        const sales = mem.orders
          .filter((order) => order.created_at.slice(0, 10) === key)
          .reduce((sum, order) => sum + Number(order.total || 0), 0);
        return { date: key, orders: count, sales };
      });

      const payload = {
        storage: 'fallback',
        system_status: {
          db: { connected: false, host: storage.dbHost, name: storage.dbName, error: storage.error || null },
          cache: { available: true },
        },
        summary: {
          sales_today: salesToday,
          sales_7d: sales7Days,
          sales_30d: sales30Days,
          users: mem.users.length,
          orders: mem.orders.length,
          products: mem.products.filter((p) => p.active).length,
          subscriptions: mem.subscriptions.length,
          total_sales: totalSales,
        },
        revenue_chart_7d: daily,
        low_stock: mem.products
          .filter((p: any) => Boolean(p.active) && Number(p.stock_quantity || 0) <= 5)
          .slice(0, 12),
        recent_orders: mem.orders.slice(0, 10),
      };
      try {
        await cache.set(cacheKey, payload, 30);
      } catch {}
      return jsonSuccess({ ...payload, cache_hit: false });
    }

    const [summaryRows] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users_count,
        (SELECT COUNT(*) FROM orders) AS orders_count,
        (SELECT COUNT(*) FROM products WHERE active = 1) AS products_count,
        (SELECT COUNT(*) FROM subscriptions) AS subscriptions_count,
        (SELECT COALESCE(SUM(total),0) FROM orders) AS total_sales,
        (SELECT COALESCE(SUM(total),0) FROM orders WHERE DATE(created_at) = CURDATE()) AS sales_today,
        (SELECT COALESCE(SUM(total),0) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS sales_7d,
        (SELECT COALESCE(SUM(total),0) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS sales_30d
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

    const [lowStockRows] = await db.query(`
      SELECT id, name, slug, stock_quantity, active, updated_at
      FROM products
      WHERE active = 1 AND stock_quantity <= 5
      ORDER BY stock_quantity ASC, updated_at DESC
      LIMIT 12
    `);

    const [recentRows] = await db.query(`
      SELECT id, order_no, name, email, phone, status, total, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const summary = Array.isArray(summaryRows) && summaryRows[0] ? (summaryRows[0] as any) : {};

    const payload = {
      storage: 'mysql',
      system_status: {
        db: { connected: true, host: storage.dbHost, name: storage.dbName, error: null },
        cache: { available: true },
      },
      summary: {
        sales_today: Number(summary.sales_today || 0),
        sales_7d: Number(summary.sales_7d || 0),
        sales_30d: Number(summary.sales_30d || 0),
        users: Number(summary.users_count || 0),
        orders: Number(summary.orders_count || 0),
        products: Number(summary.products_count || 0),
        subscriptions: Number(summary.subscriptions_count || 0),
        total_sales: Number(summary.total_sales || 0),
      },
      revenue_chart_7d: Array.isArray(dailyRows) ? dailyRows : [],
      low_stock: Array.isArray(lowStockRows) ? lowStockRows : [],
      recent_orders: Array.isArray(recentRows) ? recentRows : [],
    };
    try {
      await cache.set(cacheKey, payload, 30);
    } catch {}
    return jsonSuccess({ ...payload, cache_hit: false });
  });
}
