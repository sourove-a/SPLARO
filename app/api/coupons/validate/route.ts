import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';

const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(64),
  subtotal: z.coerce.number().min(0).optional().default(0),
});

/**
 * POST /api/coupons/validate
 * Validate a coupon code and compute the discount for a given subtotal.
 * Body: { code: string; subtotal?: number }
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const body = await req.json().catch(() => null);
    const parsed = validateCouponSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid coupon validation payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const { code, subtotal } = parsed.data;
    const upperCode = code.toUpperCase();
    const db = await getDbPool();

    type CouponRow = {
      id: string;
      code: string;
      discount_type: 'PERCENT' | 'FIXED';
      discount_value: number;
      expiry_at?: string | null;
      usage_limit: number;
      used_count: number;
      is_active: boolean | number;
    };

    let coupon: CouponRow | null = null;

    if (!db) {
      const mem = fallbackStore();
      const found = mem.coupons.find((c) => c.code === upperCode);
      if (!found) return jsonError('COUPON_NOT_FOUND', 'Coupon code not found.', 404);
      coupon = found as CouponRow;
    } else {
      const [rows] = await db.execute(
        `SELECT id, code, discount_type, discount_value, expiry_at, usage_limit, used_count, is_active
         FROM coupons WHERE code = ? LIMIT 1`,
        [upperCode],
      );
      coupon = Array.isArray(rows) && rows[0] ? (rows[0] as CouponRow) : null;
      if (!coupon) return jsonError('COUPON_NOT_FOUND', 'Coupon code not found.', 404);
    }

    // Validate active
    if (!coupon.is_active) {
      return jsonError('COUPON_INACTIVE', 'This coupon is no longer active.', 400);
    }

    // Validate expiry
    if (coupon.expiry_at) {
      const expiry = new Date(coupon.expiry_at).getTime();
      if (Number.isFinite(expiry) && expiry < Date.now()) {
        return jsonError('COUPON_EXPIRED', 'This coupon has expired.', 400);
      }
    }

    // Validate usage limit
    const usageLimit = Number(coupon.usage_limit || 0);
    const usedCount = Number(coupon.used_count || 0);
    if (usageLimit > 0 && usedCount >= usageLimit) {
      return jsonError('COUPON_USAGE_LIMIT', 'This coupon has reached its usage limit.', 400);
    }

    // Compute discount amount
    let discountAmount = 0;
    const discountValue = Number(coupon.discount_value || 0);

    if (coupon.discount_type === 'PERCENT') {
      discountAmount = Math.round((subtotal * discountValue) / 100 * 100) / 100;
    } else {
      discountAmount = Math.min(discountValue, subtotal);
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);

    return jsonSuccess({
      valid: true,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: discountValue,
      discount_amount: discountAmount,
      subtotal,
      after_discount: afterDiscount,
    });
  }, {
    rateLimitScope: 'coupon_validate',
    rateLimitLimit: 30,
    rateLimitWindowMs: 60_000,
  });
}
