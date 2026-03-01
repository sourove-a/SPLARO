import { getDbPool, getStorageInfo } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';
import type {
  AdminOrder,
  AdminProduct,
  DashboardSnapshot,
  IntegrationSnapshot,
  PaginatedResult,
  TopProduct,
} from './types';

type ProductQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  category?: string;
  type?: string;
};

type OrderQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
};

type QueueBucket = {
  pending: number;
  retry: number;
  dead: number;
};

const toNum = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const safePage = (value: number | undefined, fallback = 1): number => {
  const n = Number(value || fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const safePageSize = (value: number | undefined, fallback = 20): number => {
  const n = Number(value || fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(n)));
};

const normalizeOrderRow = (row: any): AdminOrder => ({
  id: String(row.id || ''),
  order_no: String(row.order_no || ''),
  name: String(row.name || ''),
  email: String(row.email || ''),
  phone: String(row.phone || ''),
  status: String(row.status || ''),
  subtotal: toNum(row.subtotal),
  shipping: toNum(row.shipping),
  discount: toNum(row.discount),
  total: toNum(row.total),
  created_at: String(row.created_at || ''),
  updated_at: String(row.updated_at || ''),
  admin_note: typeof row.admin_note === 'string' ? row.admin_note : '',
  is_refund_requested: Boolean(row.is_refund_requested),
  is_refunded: Boolean(row.is_refunded),
});

const normalizeProductRow = (row: any): AdminProduct => ({
  id: String(row.id || ''),
  name: String(row.name || ''),
  slug: String(row.slug || ''),
  category_id: String(row.category_id || ''),
  product_type: String(row.product_type || '').toLowerCase() === 'bag' ? 'bag' : 'shoe',
  image_url: String(row.image_url || ''),
  product_url: String(row.product_url || ''),
  price: toNum(row.price),
  discount_price: row.discount_price == null ? null : toNum(row.discount_price),
  stock_quantity: toNum(row.stock_quantity),
  active: Boolean(Number(row.active) || row.active),
  created_at: String(row.created_at || ''),
  updated_at: String(row.updated_at || ''),
});

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const db = await getDbPool();
  const storage = await getStorageInfo();

  if (!db) {
    const mem = fallbackStore();
    const totalRevenue = mem.orders.reduce((sum, order) => sum + toNum(order.total), 0);
    const salesTodayKey = new Date().toISOString().slice(0, 10);
    const salesToday = mem.orders
      .filter((order) => String(order.created_at || '').slice(0, 10) === salesTodayKey)
      .reduce((sum, order) => sum + toNum(order.total), 0);

    return {
      storage: 'fallback',
      mode: storage.connected ? 'NORMAL' : 'DEGRADED',
      summary: {
        totalRevenue,
        salesToday,
        ordersCount: mem.orders.length,
        productsCount: mem.products.filter((item) => item.active).length,
        customersCount: mem.users.length,
        avgOrderValue: mem.orders.length > 0 ? Number((totalRevenue / mem.orders.length).toFixed(2)) : 0,
      },
      revenue7d: Array.from({ length: 7 }, (_, idx) => {
        const d = new Date(Date.now() - (6 - idx) * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        const rows = mem.orders.filter((order) => String(order.created_at || '').slice(0, 10) === key);
        return {
          date: key,
          orders: rows.length,
          sales: rows.reduce((sum, row) => sum + toNum(row.total), 0),
        };
      }),
      recentOrders: mem.orders.slice(0, 10).map(normalizeOrderRow),
      topProducts: mem.products.slice(0, 8).map((item) => ({
        product_id: item.id,
        product_name: item.name,
        units: toNum(item.stock_quantity),
        revenue: toNum(item.price),
      })),
    };
  }

  const [summaryRows] = await db.query(`
    SELECT
      (SELECT COALESCE(SUM(total), 0) FROM orders) AS total_revenue,
      (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = CURDATE()) AS sales_today,
      (SELECT COUNT(*) FROM orders) AS orders_count,
      (SELECT COUNT(*) FROM products WHERE active = 1) AS products_count,
      (SELECT COUNT(*) FROM users) AS customers_count,
      (SELECT COALESCE(AVG(total), 0) FROM orders) AS avg_order_value
  `);

  const summary = Array.isArray(summaryRows) && summaryRows[0] ? (summaryRows[0] as any) : {};

  const [recentOrdersRows] = await db.query(`
    SELECT id, order_no, name, email, phone, status, subtotal, shipping, discount, total, created_at, updated_at, admin_note, is_refund_requested, is_refunded
    FROM orders
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const [revenueRows] = await db.query(`
    SELECT DATE(created_at) AS date, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS sales
    FROM orders
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `);

  let topProducts: TopProduct[] = [];
  try {
    const [topRows] = await db.query(`
      SELECT
        COALESCE(NULLIF(oi.product_id, ''), CONCAT('legacy-', oi.product_name)) AS product_id,
        MAX(oi.product_name) AS product_name,
        COALESCE(SUM(oi.quantity), 0) AS units,
        COALESCE(SUM(oi.line_total), 0) AS revenue
      FROM order_items oi
      GROUP BY COALESCE(NULLIF(oi.product_id, ''), CONCAT('legacy-', oi.product_name))
      ORDER BY units DESC
      LIMIT 8
    `);
    topProducts = (Array.isArray(topRows) ? topRows : []).map((row: any) => ({
      product_id: String(row.product_id || ''),
      product_name: String(row.product_name || ''),
      units: toNum(row.units),
      revenue: toNum(row.revenue),
    }));
  } catch {
    const [productRows] = await db.query(`
      SELECT id, name, price
      FROM products
      WHERE active = 1
      ORDER BY updated_at DESC
      LIMIT 8
    `);
    topProducts = (Array.isArray(productRows) ? productRows : []).map((row: any) => ({
      product_id: String(row.id || ''),
      product_name: String(row.name || ''),
      units: 0,
      revenue: toNum(row.price),
    }));
  }

  return {
    storage: 'mysql',
    mode: storage.connected ? 'NORMAL' : 'DEGRADED',
    summary: {
      totalRevenue: toNum(summary.total_revenue),
      salesToday: toNum(summary.sales_today),
      ordersCount: toNum(summary.orders_count),
      productsCount: toNum(summary.products_count),
      customersCount: toNum(summary.customers_count),
      avgOrderValue: Number(toNum(summary.avg_order_value).toFixed(2)),
    },
    revenue7d: (Array.isArray(revenueRows) ? revenueRows : []).map((row: any) => ({
      date: String(row.date || ''),
      orders: toNum(row.orders),
      sales: toNum(row.sales),
    })),
    recentOrders: (Array.isArray(recentOrdersRows) ? recentOrdersRows : []).map((row: any) => normalizeOrderRow(row)),
    topProducts,
  };
}

export async function listAdminProducts(params: ProductQuery = {}): Promise<PaginatedResult<AdminProduct>> {
  const page = safePage(params.page, 1);
  const pageSize = safePageSize(params.pageSize, 20);
  const q = String(params.q || '').trim();
  const category = String(params.category || '').trim();
  const type = String(params.type || '').trim().toLowerCase();

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    let rows = mem.products.slice();

    if (q) {
      const term = q.toLowerCase();
      rows = rows.filter((row) => row.name.toLowerCase().includes(term) || row.slug.toLowerCase().includes(term));
    }
    if (category) rows = rows.filter((row) => row.category_id === category);
    if (type) rows = rows.filter((row) => row.product_type === type);

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, totalPages);
    const start = (current - 1) * pageSize;

    return {
      storage: 'fallback',
      items: rows.slice(start, start + pageSize).map(normalizeProductRow),
      total,
      page: current,
      pageSize,
      totalPages,
    };
  }

  const where: string[] = [];
  const values: unknown[] = [];

  if (q) {
    where.push('(name LIKE ? OR slug LIKE ?)');
    values.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push('category_id = ?');
    values.push(category);
  }
  if (type) {
    where.push('product_type = ?');
    values.push(type);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM products ${whereSql}`, values);
  const total = Array.isArray(countRows) && countRows[0] ? toNum((countRows[0] as any).total) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const offset = (current - 1) * pageSize;

  const [rows] = await db.execute(
    `SELECT id, name, slug, category_id, product_type, image_url, product_url, price, discount_price, stock_quantity, active, created_at, updated_at
     FROM products
     ${whereSql}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );

  return {
    storage: 'mysql',
    items: (Array.isArray(rows) ? rows : []).map((row: any) => normalizeProductRow(row)),
    total,
    page: current,
    pageSize,
    totalPages,
  };
}

export async function listAdminOrders(params: OrderQuery = {}): Promise<PaginatedResult<AdminOrder>> {
  const page = safePage(params.page, 1);
  const pageSize = safePageSize(params.pageSize, 20);
  const q = String(params.q || '').trim();
  const status = String(params.status || '').trim().toUpperCase();

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    let rows = mem.orders.slice();

    if (status) rows = rows.filter((row) => row.status === status);
    if (q) {
      const term = q.toLowerCase();
      rows = rows.filter((row) =>
        row.order_no.toLowerCase().includes(term)
        || row.name.toLowerCase().includes(term)
        || row.email.toLowerCase().includes(term)
        || row.phone.toLowerCase().includes(term),
      );
    }

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, totalPages);
    const start = (current - 1) * pageSize;

    return {
      storage: 'fallback',
      items: rows.slice(start, start + pageSize).map(normalizeOrderRow),
      total,
      page: current,
      pageSize,
      totalPages,
    };
  }

  const where: string[] = [];
  const values: unknown[] = [];

  if (status) {
    where.push('status = ?');
    values.push(status);
  }
  if (q) {
    where.push('(order_no LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    values.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM orders ${whereSql}`, values);
  const total = Array.isArray(countRows) && countRows[0] ? toNum((countRows[0] as any).total) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const offset = (current - 1) * pageSize;

  const [rows] = await db.execute(
    `SELECT id, order_no, name, email, phone, status, subtotal, shipping, discount, total, created_at, updated_at, admin_note, is_refund_requested, is_refunded
     FROM orders
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );

  return {
    storage: 'mysql',
    items: (Array.isArray(rows) ? rows : []).map((row: any) => normalizeOrderRow(row)),
    total,
    page: current,
    pageSize,
    totalPages,
  };
}

export async function getIntegrationsSnapshot(): Promise<IntegrationSnapshot[]> {
  const db = await getDbPool();
  const nowIso = new Date().toISOString();

  const queueBuckets: Record<string, QueueBucket> = {
    telegram: { pending: 0, retry: 0, dead: 0 },
    push: { pending: 0, retry: 0, dead: 0 },
    sheets: { pending: 0, retry: 0, dead: 0 },
  };

  const updatedByService: Record<string, { enabled: boolean; updatedAt: string }> = {};

  if (db) {
    try {
      const [queueRows] = await db.query(`
        SELECT sync_type, status, COUNT(*) AS total
        FROM sync_queue
        GROUP BY sync_type, status
      `);
      const rows = Array.isArray(queueRows) ? queueRows : [];
      for (const row of rows as any[]) {
        const syncType = String(row.sync_type || '').toUpperCase();
        const status = String(row.status || '').toUpperCase();
        const total = toNum(row.total);

        const bucketKey = syncType.includes('TELEGRAM')
          ? 'telegram'
          : syncType.includes('PUSH')
            ? 'push'
            : syncType.includes('SHEET')
              ? 'sheets'
              : '';
        if (!bucketKey) continue;
        if (status === 'PENDING') queueBuckets[bucketKey].pending += total;
        if (status === 'RETRY') queueBuckets[bucketKey].retry += total;
        if (status === 'DEAD') queueBuckets[bucketKey].dead += total;
      }
    } catch {
      // table can be absent during bootstrap; keep defaults
    }

    try {
      const [settingRows] = await db.query(`
        SELECT service, MAX(enabled) AS enabled, MAX(updated_at) AS updated_at
        FROM integration_settings
        GROUP BY service
      `);
      const rows = Array.isArray(settingRows) ? settingRows : [];
      for (const row of rows as any[]) {
        const key = String(row.service || '').toLowerCase();
        if (!key) continue;
        updatedByService[key] = {
          enabled: Boolean(Number(row.enabled) || row.enabled),
          updatedAt: String(row.updated_at || nowIso),
        };
      }
    } catch {
      // optional table
    }
  }

  const envEnabled = {
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    sheets: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.GOOGLE_OAUTH_CLIENT_ID),
    push: Boolean(process.env.PUSH_VAPID_PUBLIC_KEY),
    sslcommerz: Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD),
    steadfast: Boolean(process.env.STEADFAST_API_KEY || process.env.STEADFAST_API_SECRET),
    pathao: Boolean(process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET),
    bkash: Boolean(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET),
    nagad: Boolean(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_MERCHANT_PRIVATE_KEY),
    redis: Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL),
    ga4: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    meta: Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
  };

  const resolveStatus = (enabled: boolean, pending = 0, retry = 0, dead = 0): 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' => {
    if (!enabled) return 'DISCONNECTED';
    if (dead > 0 || retry > 0) return 'DEGRADED';
    if (pending > 200) return 'DEGRADED';
    return 'CONNECTED';
  };

  const buildIntegration = (
    key: string,
    name: string,
    category: string,
    hint: string,
    queueKey?: keyof typeof queueBuckets,
  ): IntegrationSnapshot => {
    const queue = queueKey ? queueBuckets[queueKey] : { pending: 0, retry: 0, dead: 0 };
    const configured = Boolean((envEnabled as Record<string, boolean>)[key]);
    const fromDb = updatedByService[key];
    const enabled = fromDb ? fromDb.enabled || configured : configured;

    return {
      key,
      name,
      category,
      enabled,
      status: resolveStatus(enabled, queue.pending, queue.retry, queue.dead),
      hint,
      lastUpdatedAt: fromDb?.updatedAt || nowIso,
      pending: queue.pending,
      retry: queue.retry,
      dead: queue.dead,
    };
  };

  return [
    buildIntegration('telegram', 'Telegram Control Bot', 'Messaging', 'Instant order alerts and inline status controls.', 'telegram'),
    buildIntegration('sheets', 'Google Sheets Sync', 'Data Sync', 'Backup synchronization for orders/users/subscribers.', 'sheets'),
    buildIntegration('push', 'Web Push', 'Notifications', 'Browser push notifications for marketing and order updates.', 'push'),
    buildIntegration('sslcommerz', 'SSLCommerz', 'Payments', 'Primary card and wallet payment gateway.'),
    buildIntegration('bkash', 'bKash', 'Payments', 'bKash direct payment and refund callbacks.'),
    buildIntegration('nagad', 'Nagad', 'Payments', 'Nagad merchant checkout integration.'),
    buildIntegration('steadfast', 'Steadfast', 'Logistics', 'Parcel booking and shipment status sync.'),
    buildIntegration('pathao', 'Pathao', 'Logistics', 'Last-mile and same-day fulfillment provider.'),
    buildIntegration('redis', 'Redis Cache', 'Performance', 'Edge caching, queue dedupe and session acceleration.'),
    buildIntegration('ga4', 'Google Analytics 4', 'Analytics', 'Event tracking, attribution and conversion funnels.'),
    buildIntegration('meta', 'Meta Pixel', 'Marketing', 'Retargeting audiences and ROAS tracking.'),
    buildIntegration('smtp', 'SMTP Mailer', 'Communication', 'Transactional email for invoices and OTP.'),
  ];
}
