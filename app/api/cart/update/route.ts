import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

/**
 * POST /api/cart/update
 * Update the quantity of a product in the cart.
 * Body: { cart_key?: string; product_id: string; quantity: number }
 * Setting quantity to 0 removes the item.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => null) as any;
    if (!body || typeof body !== 'object') {
      return jsonError('VALIDATION_ERROR', 'Invalid update payload.', 400);
    }

    const productId = String(body.product_id || '').trim();
    const quantity = Number(body.quantity);

    if (!productId) {
      return jsonError('VALIDATION_ERROR', 'product_id is required.', 400);
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return jsonError('VALIDATION_ERROR', 'quantity must be a non-negative number.', 400);
    }
    if (quantity > 999) {
      return jsonError('VALIDATION_ERROR', 'quantity cannot exceed 999.', 400);
    }

    const cartKey = String(body.cart_key || ip || 'guest').trim();
    const store = fallbackStore();
    const current = store.cartByKey.get(cartKey) || [];

    let next: any[];
    if (quantity === 0) {
      // Quantity 0 means remove
      next = current.filter((item: any) => item.product_id !== productId);
    } else {
      const idx = current.findIndex((item: any) => item.product_id === productId);
      if (idx < 0) {
        return jsonError('NOT_IN_CART', 'Product not found in cart.', 404);
      }
      next = [...current];
      next[idx] = { ...next[idx], quantity };
    }

    store.cartByKey.set(cartKey, next);
    return jsonSuccess({ cart_key: cartKey, items: next });
  });
}
