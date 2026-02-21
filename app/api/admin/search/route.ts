import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonSuccess, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    if (!q) {
      return jsonSuccess({ q: '', storage: 'fallback', results: { users: [], orders: [], campaigns: [] } });
    }

    const termLower = q.toLowerCase();
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const users = mem.users
        .filter((u) => String(u.name || '').toLowerCase().includes(termLower) || String(u.email || '').toLowerCase().includes(termLower) || String(u.phone || '').toLowerCase().includes(termLower))
        .slice(0, 25);
      const orders = mem.orders
        .filter((o) => String(o.order_no || '').toLowerCase().includes(termLower) || String(o.email || '').toLowerCase().includes(termLower) || String(o.phone || '').toLowerCase().includes(termLower))
        .slice(0, 25);
      const campaigns = mem.campaigns
        .filter((c) => c.name.toLowerCase().includes(termLower) || c.status.toLowerCase().includes(termLower))
        .slice(0, 25);

      return jsonSuccess({
        storage: 'fallback',
        q,
        results: { users, orders, campaigns },
        quickLinks: {
          users: '/admin/users',
          orders: '/admin/orders',
          campaigns: '/admin/campaigns',
        },
      });
    }

    const term = `%${q}%`;

    const [userRows] = await db.query(
      `SELECT id, name, email, phone, role, created_at
       FROM users
       WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [term, term, term],
    );

    const [orderRows] = await db.query(
      `SELECT id, order_no, name, email, phone, status, total, created_at
       FROM orders
       WHERE order_no LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [term, term, term, term],
    );

    const [campaignRows] = await db.query(
      `SELECT id, name, status, audience_segment, target_count, created_at
       FROM campaigns
       WHERE deleted_at IS NULL AND (name LIKE ? OR status LIKE ?)
       ORDER BY created_at DESC
       LIMIT 25`,
      [term, term],
    );

    return jsonSuccess({
      storage: 'mysql',
      q,
      results: {
        users: Array.isArray(userRows) ? userRows : [],
        orders: Array.isArray(orderRows) ? orderRows : [],
        campaigns: Array.isArray(campaignRows) ? campaignRows : [],
      },
      quickLinks: {
        users: '/admin/users',
        orders: '/admin/orders',
        campaigns: '/admin/campaigns',
      },
    });
  });
}
