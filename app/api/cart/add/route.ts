import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => null) as any;
    if (!body || typeof body !== 'object') {
      return jsonError('VALIDATION_ERROR', 'Invalid cart payload.', 400);
    }

    const productId = String(body.product_id || '').trim();
    const quantity = Number(body.quantity || 1);
    if (!productId || !Number.isFinite(quantity) || quantity < 1) {
      return jsonError('VALIDATION_ERROR', 'product_id and quantity are required.', 400);
    }

    const cartKey = String(body.cart_key || ip || 'guest').trim();
    const store = fallbackStore();
    const current = store.cartByKey.get(cartKey) || [];
    const next = [...current];
    const idx = next.findIndex((item: any) => item.product_id === productId);
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: Number(next[idx].quantity || 0) + quantity };
    } else {
      next.push({ product_id: productId, quantity, added_at: new Date().toISOString() });
    }

    store.cartByKey.set(cartKey, next);
    return jsonSuccess({ cart_key: cartKey, items: next });
  });
}
