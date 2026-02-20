import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../lib/apiRoute';
import { jsonSuccess } from '../../../lib/env';
import { fallbackStore } from '../../../lib/fallbackStore';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const cartKey = String(req.nextUrl.searchParams.get('cart_key') || ip || 'guest').trim();
    const store = fallbackStore();
    const items = store.cartByKey.get(cartKey) || [];
    return jsonSuccess({ cart_key: cartKey, items });
  });
}
