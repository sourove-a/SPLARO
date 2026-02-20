import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess, parsePagination, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../lib/log';
import { productCreateSchema } from '../../../../lib/validators';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const { page, pageSize } = parsePagination(req.nextUrl.searchParams);
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const category = String(req.nextUrl.searchParams.get('category') || '').trim();
    const type = String(req.nextUrl.searchParams.get('type') || '').trim();

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      let rows = mem.products;
      if (q) {
        const term = q.toLowerCase();
        rows = rows.filter((row) => row.name.toLowerCase().includes(term) || row.slug.toLowerCase().includes(term));
      }
      if (category) rows = rows.filter((row) => row.category_id === category);
      if (type) rows = rows.filter((row) => row.product_type === type);

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

    if (q) {
      where.push('(name LIKE ? OR slug LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term);
    }
    if (category) {
      where.push('category_id = ?');
      params.push(category);
    }
    if (type) {
      where.push('product_type = ?');
      params.push(type);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM products ${whereSql}`, params);
    const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);

    const safeOffset = (safePage - 1) * pageSize;
    const [rows] = await db.execute(
      `SELECT id, name, slug, category_id, product_type, image_url, product_url, price, active, created_at, updated_at
       FROM products
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

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const body = await req.json().catch(() => null);
    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid product payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const id = randomUUID();
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const exists = mem.products.some((item) => item.slug === payload.slug);
      if (exists) return jsonError('SLUG_EXISTS', 'Product slug already exists.', 409);

      const now = new Date().toISOString();
      const next = {
        id,
        name: payload.name,
        slug: payload.slug,
        category_id: payload.category_id,
        product_type: payload.product_type,
        image_url: payload.image_url,
        product_url: payload.product_url,
        price: payload.price,
        active: payload.active,
        created_at: now,
        updated_at: now,
      };
      mem.products.unshift(next);

      await writeAuditLog({ actorId: null, action: 'PRODUCT_CREATED', entityType: 'product', entityId: id, after: next, ipAddress: ip });
      await writeSystemLog({ eventType: 'PRODUCT_CREATED_FALLBACK', description: `Product created: ${payload.slug}`, ipAddress: ip });

      return jsonSuccess({ storage: 'fallback', item: next }, 201);
    }

    const [existingRows] = await db.execute('SELECT id FROM products WHERE slug = ? LIMIT 1', [payload.slug]);
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return jsonError('SLUG_EXISTS', 'Product slug already exists.', 409);
    }

    await db.execute(
      `INSERT INTO products
       (id, name, slug, category_id, product_type, image_url, product_url, price, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, payload.name, payload.slug, payload.category_id, payload.product_type, payload.image_url, payload.product_url, payload.price, payload.active ? 1 : 0],
    );

    await writeAuditLog({ actorId: null, action: 'PRODUCT_CREATED', entityType: 'product', entityId: id, after: payload, ipAddress: ip });
    await writeSystemLog({ eventType: 'PRODUCT_CREATED', description: `Product created: ${payload.slug}`, ipAddress: ip });

    const [rows] = await db.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
    const item = Array.isArray(rows) && rows[0] ? rows[0] : null;

    return jsonSuccess({ storage: 'mysql', item }, 201);
  }, {
    rateLimitScope: 'admin_products_write',
    rateLimitLimit: 60,
    rateLimitWindowMs: 60_000,
  });
}
