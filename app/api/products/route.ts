import { NextRequest } from 'next/server';
import { getCacheStore } from '../../../lib/cache';
import { withApiHandler } from '../../../lib/apiRoute';
import { getDbPool } from '../../../lib/db';
import { jsonError, jsonSuccess } from '../../../lib/env';
import { fallbackStore } from '../../../lib/fallbackStore';
import { setPublicCacheHeaders } from '../../../lib/httpCache';
import { productQuerySchema } from '../../../lib/validators';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const parsedQuery = productQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsedQuery.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid query parameters.', 400, {
        details: parsedQuery.error.flatten(),
      });
    }

    const query = parsedQuery.data;
    const db = await getDbPool();
    const cache = await getCacheStore();
    const cacheKey = `products:list:${query.page}:${query.pageSize}:${query.q}:${query.category}:${query.type}:${query.sort}`;

    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return setPublicCacheHeaders(jsonSuccess({ ...cached, cache_hit: true }), {
        sMaxAge: 60,
        staleWhileRevalidate: 300,
      });
    }

    if (!db) {
      const mem = fallbackStore();
      let rows = mem.products.filter((item) => item.active);
      if (query.q) {
        const term = query.q.toLowerCase();
        rows = rows.filter((row) => row.name.toLowerCase().includes(term) || row.slug.toLowerCase().includes(term));
      }
      if (query.category) rows = rows.filter((row) => row.category_id === query.category);
      if (query.type) rows = rows.filter((row) => row.product_type === query.type);
      if (query.sort === 'price_asc') rows = rows.sort((a, b) => a.price - b.price);
      if (query.sort === 'price_desc') rows = rows.sort((a, b) => b.price - a.price);
      if (query.sort === 'newest') rows = rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, totalPages);
      const offset = (page - 1) * query.pageSize;
      const items = rows.slice(offset, offset + query.pageSize);

      const payload = { storage: 'fallback', items, total, page, pageSize: query.pageSize, totalPages };
      await cache.set(cacheKey, payload, 45);
      return setPublicCacheHeaders(jsonSuccess({ ...payload, cache_hit: false }), {
        sMaxAge: 60,
        staleWhileRevalidate: 300,
      });
    }

    const where: string[] = ['active = 1'];
    const params: unknown[] = [];

    if (query.q) {
      where.push('(name LIKE ? OR slug LIKE ?)');
      params.push(`%${query.q}%`, `%${query.q}%`);
    }
    if (query.category) {
      where.push('category_id = ?');
      params.push(query.category);
    }
    if (query.type) {
      where.push('product_type = ?');
      params.push(query.type);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortSql = query.sort === 'price_asc' ? 'price ASC' : query.sort === 'price_desc' ? 'price DESC' : 'created_at DESC';

    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM products ${whereSql}`, params);
    const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;

    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const offset = (page - 1) * query.pageSize;

    const safeOffset = (page - 1) * query.pageSize;
    const [rows] = await db.execute(
      `SELECT id, name, slug, category_id, product_type, image_url, product_url, price, active, created_at, updated_at
       FROM products
       ${whereSql}
       ORDER BY ${sortSql}
       LIMIT ? OFFSET ?`,
      [...params, query.pageSize, safeOffset],
    );

    const payload = {
      storage: 'mysql',
      items: Array.isArray(rows) ? rows : [],
      total,
      page,
      pageSize: query.pageSize,
      totalPages,
    };

    await cache.set(cacheKey, payload, 45);
    return setPublicCacheHeaders(jsonSuccess({ ...payload, cache_hit: false }), {
      sMaxAge: 60,
      staleWhileRevalidate: 300,
    });
  });
}
