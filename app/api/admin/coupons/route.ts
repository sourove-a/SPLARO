import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess, parsePagination, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../lib/log';
import { couponCreateSchema } from '../../../../lib/validators';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const { page, pageSize } = parsePagination(req.nextUrl.searchParams);
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const active = String(req.nextUrl.searchParams.get('active') || '').trim();

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      let rows = mem.coupons;
      if (q) {
        const term = q.toLowerCase();
        rows = rows.filter((item) => item.code.toLowerCase().includes(term));
      }
      if (active === 'true') rows = rows.filter((item) => item.is_active);
      if (active === 'false') rows = rows.filter((item) => !item.is_active);

      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;
      return jsonSuccess({
        storage: 'fallback',
        items: rows.slice(offset, offset + pageSize),
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
    }

    const where: string[] = [];
    const params: unknown[] = [];
    if (q) {
      where.push('code LIKE ?');
      params.push(`%${q}%`);
    }
    if (active === 'true') where.push('is_active = 1');
    if (active === 'false') where.push('is_active = 0');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM coupons ${whereSql}`, params);
    const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const [rows] = await db.execute(
      `SELECT id, code, discount_type, discount_value, expiry_at, usage_limit, used_count, is_active, created_at, updated_at
       FROM coupons
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
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

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const body = await req.json().catch(() => null);
    const parsed = couponCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid coupon payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const code = payload.code.toUpperCase();
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      if (mem.coupons.some((item) => item.code === code)) {
        return jsonError('COUPON_EXISTS', 'Coupon code already exists.', 409);
      }
      const now = new Date().toISOString();
      const next = {
        id: randomUUID(),
        code,
        discount_type: payload.discount_type,
        discount_value: Number(payload.discount_value),
        expiry_at: payload.expiry_at || null,
        usage_limit: Number(payload.usage_limit || 0),
        used_count: 0,
        is_active: Boolean(payload.is_active),
        created_at: now,
        updated_at: now,
      } as any;
      mem.coupons.unshift(next);
      await writeSystemLog({ eventType: 'COUPON_CREATED_FALLBACK', description: `Coupon created: ${code}`, ipAddress: ip });
      return jsonSuccess({ storage: 'fallback', item: next }, 201);
    }

    const [existsRows] = await db.execute('SELECT id FROM coupons WHERE code = ? LIMIT 1', [code]);
    if (Array.isArray(existsRows) && existsRows.length > 0) {
      return jsonError('COUPON_EXISTS', 'Coupon code already exists.', 409);
    }

    const id = randomUUID();
    await db.execute(
      `INSERT INTO coupons
       (id, code, discount_type, discount_value, expiry_at, usage_limit, used_count, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        code,
        payload.discount_type,
        payload.discount_value,
        payload.expiry_at || null,
        payload.usage_limit || 0,
        payload.is_active ? 1 : 0,
      ],
    );

    const [rows] = await db.execute('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    const item = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;

    await writeAuditLog({ action: 'COUPON_CREATED', entityType: 'coupon', entityId: id, after: item, ipAddress: ip });
    await writeSystemLog({ eventType: 'COUPON_CREATED', description: `Coupon created: ${code}`, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', item }, 201);
  }, {
    rateLimitScope: 'admin_coupons_write',
    rateLimitLimit: 50,
    rateLimitWindowMs: 60_000,
  });
}
