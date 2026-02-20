import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

export async function GET(request: NextRequest, context: { params: { slug: string } }) {
  return withApiHandler(request, async () => {
    const slug = String(context.params.slug || '').trim();
    if (!slug) return jsonError('INVALID_SLUG', 'Invalid slug.', 400);

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      const product = mem.products.find((item) => item.slug === slug && item.active);
      if (!product) return jsonError('NOT_FOUND', 'Product not found.', 404);
      return jsonSuccess({ storage: 'fallback', item: product });
    }

    const [rows] = await db.execute(
      `SELECT id, name, slug, category_id, product_type, image_url, product_url, price, active, created_at, updated_at
       FROM products WHERE slug = ? AND active = 1 LIMIT 1`,
      [slug],
    );

    const item = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!item) return jsonError('NOT_FOUND', 'Product not found.', 404);

    return jsonSuccess({ storage: 'mysql', item });
  });
}
