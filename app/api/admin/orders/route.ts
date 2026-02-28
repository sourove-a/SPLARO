import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonSuccess, parsePagination, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const { page, pageSize } = parsePagination(req.nextUrl.searchParams);
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const status = String(req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      let rows = mem.orders;
      if (status) rows = rows.filter((row) => row.status === status);
      if (q) {
        const term = q.toLowerCase();
        rows = rows.filter((row) =>
          row.order_no.toLowerCase().includes(term) ||
          row.name.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term) ||
          row.phone.toLowerCase().includes(term) ||
          String((row as any).admin_note || '').toLowerCase().includes(term),
        );
      }

      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      return jsonSuccess({
        storage: 'fallback',
        items: rows.slice(start, start + pageSize),
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
    }

    const where: string[] = [];
    const params: unknown[] = [];

    if (status) {
      where.push('status = ?');
      params.push(status);
    }

    if (q) {
      where.push('(order_no LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM orders ${whereSql}`, params);
    const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);

    const safeOffset = (safePage - 1) * pageSize;
    const [rows] = await db.execute(
      `SELECT id, order_no, user_id, name, email, phone, address, district, thana, status, subtotal, shipping, discount, total, created_at, updated_at
       , admin_note, is_refund_requested, is_refunded
       FROM orders
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, safeOffset],
    );

    return jsonSuccess({
      storage: 'mysql',
      items: Array.isArray(rows) ? rows : [],
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
  });
}
