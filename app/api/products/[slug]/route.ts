import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getCacheStore } from '../../../../lib/cache';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { setPublicCacheHeaders } from '../../../../lib/httpCache';

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withApiHandler(request, async () => {
    const routeParams = await context.params;
    const slug = String(routeParams.slug || '').trim();
    if (!slug) return jsonError('INVALID_SLUG', 'Invalid slug.', 400);

    const cache = await getCacheStore();
    const cacheKey = `products:slug:${slug}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return setPublicCacheHeaders(jsonSuccess({ ...cached, cache_hit: true }), {
        sMaxAge: 120,
        staleWhileRevalidate: 600,
      });
    }

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      const product = mem.products.find((item) => item.slug === slug && item.active);
      if (!product) return jsonError('NOT_FOUND', 'Product not found.', 404);
      const payload = { storage: 'fallback', item: product };
      await cache.set(cacheKey, payload, 120);
      return setPublicCacheHeaders(jsonSuccess({ ...payload, cache_hit: false }), {
        sMaxAge: 120,
        staleWhileRevalidate: 600,
      });
    }

    const [rows] = await db.execute(
      `SELECT id, name, slug, category_id, product_type, image_url, product_url, price, active, created_at, updated_at
       FROM products WHERE slug = ? AND active = 1 LIMIT 1`,
      [slug],
    );

    const item = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!item) return jsonError('NOT_FOUND', 'Product not found.', 404);

    const payload = { storage: 'mysql', item };
    await cache.set(cacheKey, payload, 120);
    return setPublicCacheHeaders(jsonSuccess({ ...payload, cache_hit: false }), {
      sMaxAge: 120,
      staleWhileRevalidate: 600,
    });
  });
}
