import { getDbPool, getStorageInfo } from '../../../lib/db';
import { fallbackStore } from '../../../lib/fallbackStore';
import { jsonSuccess } from '../../../lib/env';
import { setPublicCacheHeaders } from '../../../lib/httpCache';

export async function GET() {
  const db = await getDbPool();
  const storage = await getStorageInfo();

  if (!db) {
    const mem = fallbackStore();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last24hOrders = mem.orders.filter((o) => new Date(o.created_at).getTime() >= cutoff).length;

    return setPublicCacheHeaders(jsonSuccess({
      storage: 'fallback',
      counts: {
        users: mem.users.length,
        orders: mem.orders.length,
        subscriptions: mem.subscriptions.length,
        products: mem.products.length,
      },
      last_24h_orders: last24hOrders,
      dbHost: storage.dbHost,
      dbName: storage.dbName,
    }), {
      sMaxAge: 30,
      staleWhileRevalidate: 120,
    });
  }

  const [countRows] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users_count,
      (SELECT COUNT(*) FROM orders) AS orders_count,
      (SELECT COUNT(*) FROM subscriptions) AS subscriptions_count,
      (SELECT COUNT(*) FROM products WHERE active = 1) AS products_count,
      (SELECT COUNT(*) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)) AS orders_24h
  `);

  const row = Array.isArray(countRows) && countRows[0] ? (countRows[0] as any) : {};

  return setPublicCacheHeaders(jsonSuccess({
    storage: 'mysql',
    counts: {
      users: Number(row.users_count || 0),
      orders: Number(row.orders_count || 0),
      subscriptions: Number(row.subscriptions_count || 0),
      products: Number(row.products_count || 0),
    },
    last_24h_orders: Number(row.orders_24h || 0),
    dbHost: storage.dbHost,
    dbName: storage.dbName,
  }), {
    sMaxAge: 30,
    staleWhileRevalidate: 120,
  });
}
