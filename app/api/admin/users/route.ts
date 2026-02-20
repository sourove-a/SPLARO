import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonSuccess, parsePagination, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const { page, pageSize } = parsePagination(req.nextUrl.searchParams);
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();

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
      return jsonSuccess({ storage: 'fallback', items: rows.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages });
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

    return jsonSuccess({ storage: 'mysql', items: Array.isArray(rows) ? rows : [], total, page: safePage, pageSize, totalPages });
  });
}
