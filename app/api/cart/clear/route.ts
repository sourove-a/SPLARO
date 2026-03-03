import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

/**
 * POST /api/cart/clear
 * Clear all items from the cart for a given cart_key.
 * Body: { cart_key?: string }
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => ({})) as any;
    const cartKey = String(body?.cart_key || ip || 'guest').trim();

    const store = fallbackStore();
    store.cartByKey.set(cartKey, []);

    return jsonSuccess({ cart_key: cartKey, items: [], cleared: true });
  });
}
