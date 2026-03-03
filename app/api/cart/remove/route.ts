import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

/**
 * POST /api/cart/remove
 * Remove a specific product from the cart.
 * Body: { cart_key?: string; product_id: string }
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => null) as any;
    if (!body || typeof body !== 'object') {
      return jsonError('VALIDATION_ERROR', 'Invalid remove payload.', 400);
    }

    const productId = String(body.product_id || '').trim();
    if (!productId) {
      return jsonError('VALIDATION_ERROR', 'product_id is required.', 400);
    }

    const cartKey = String(body.cart_key || ip || 'guest').trim();
    const store = fallbackStore();
    const current = store.cartByKey.get(cartKey) || [];
    const next = current.filter((item: any) => item.product_id !== productId);
    store.cartByKey.set(cartKey, next);

    return jsonSuccess({ cart_key: cartKey, items: next, removed: productId });
  });
}
