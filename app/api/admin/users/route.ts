import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonSuccess, parsePagination, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { toCsv } from '../../../../lib/csv';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const { page, pageSize } = parsePagination(req.nextUrl.searchParams);
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const includeHistory = String(req.nextUrl.searchParams.get('includeHistory') || '') === '1';
    const format = String(req.nextUrl.searchParams.get('format') || '').trim().toLowerCase();

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      let rows = mem.users;
      if (q) {
        const term = q.toLowerCase();
        rows = rows.filter((row) =>
          row.name.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term) ||
          row.phone.toLowerCase().includes(term),
        );
      }
      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;

      const paged = rows.slice(start, start + pageSize).map((user) => {
        const history = mem.orders.filter((order) => order.user_id === user.id || order.email === user.email);
        return {
          ...user,
          order_count: history.length,
          total_spend: history.reduce((sum, order) => sum + Number(order.total || 0), 0),
          order_history: includeHistory ? history.slice(0, 20) : undefined,
        };
      });

      if (format === 'csv') {
        const csv = toCsv(
          paged.map((item) => ({
            id: item.id,
            name: item.name,
            email: item.email,
            phone: item.phone,
            role: item.role,
            is_blocked: item.is_blocked ? 1 : 0,
            order_count: item.order_count,
            total_spend: item.total_spend,
            created_at: item.created_at,
          })),
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename=\"splaro-users-page-${safePage}.csv\"`,
          },
        });
      }

      return jsonSuccess({ storage: 'fallback', items: paged, total, page: safePage, pageSize, totalPages });
    }

    const where = q ? 'WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?)' : '';
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM users ${where}`, params);
    const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);

    const safeOffset = (safePage - 1) * pageSize;
    const [rows] = await db.execute(
      `SELECT id, name, email, phone, district, thana, address, role, is_blocked, created_at, updated_at
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, safeOffset],
    );

    const items = Array.isArray(rows) ? (rows as any[]) : [];
    const enriched = [];
    for (const user of items) {
      const [historyCountRows] = await db.execute(
        `SELECT COUNT(*) AS order_count, COALESCE(SUM(total),0) AS total_spend
         FROM orders
         WHERE user_id = ? OR email = ?`,
        [user.id, user.email],
      );
      const agg = Array.isArray(historyCountRows) && historyCountRows[0] ? (historyCountRows[0] as any) : { order_count: 0, total_spend: 0 };
      let history: any[] | undefined;
      if (includeHistory) {
        const [historyRows] = await db.execute(
          `SELECT order_no, status, total, created_at
           FROM orders
           WHERE user_id = ? OR email = ?
           ORDER BY created_at DESC
           LIMIT 20`,
          [user.id, user.email],
        );
        history = Array.isArray(historyRows) ? historyRows as any[] : [];
      }
      enriched.push({
        ...user,
        order_count: Number(agg.order_count || 0),
        total_spend: Number(agg.total_spend || 0),
        order_history: history,
      });
    }

    if (format === 'csv') {
      const csv = toCsv(
        enriched.map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone,
          role: item.role,
          is_blocked: item.is_blocked ? 1 : 0,
          order_count: item.order_count,
          total_spend: item.total_spend,
          created_at: item.created_at,
        })),
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename=\"splaro-users-page-${safePage}.csv\"`,
        },
      });
    }

    return jsonSuccess({ storage: 'mysql', items: enriched, total, page: safePage, pageSize, totalPages });
  });
}
