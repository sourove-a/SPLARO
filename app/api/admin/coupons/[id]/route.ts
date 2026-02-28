import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../lib/log';
import { couponUpdateSchema } from '../../../../../lib/validators';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const routeParams = await context.params;
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const id = String(routeParams.id || '').trim();
    if (!id) return jsonError('INVALID_ID', 'Invalid coupon id.', 400);

    const body = await req.json().catch(() => null);
    const parsed = couponUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid coupon payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.coupons.findIndex((item) => item.id === id);
      if (idx < 0) return jsonError('NOT_FOUND', 'Coupon not found.', 404);
      const before = { ...mem.coupons[idx] };
      mem.coupons[idx] = {
        ...mem.coupons[idx],
        ...payload,
        code: payload.code ? payload.code.toUpperCase() : mem.coupons[idx].code,
        updated_at: new Date().toISOString(),
      } as any;
      const after = mem.coupons[idx];

      await writeAuditLog({ action: 'COUPON_UPDATED', entityType: 'coupon', entityId: id, before, after, ipAddress: ip });
      await writeSystemLog({ eventType: 'COUPON_UPDATED_FALLBACK', description: `Coupon updated: ${id}`, ipAddress: ip });

      return jsonSuccess({ storage: 'fallback', item: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'Coupon not found.', 404);

    if (payload.code && payload.code.toUpperCase() !== String(existing.code).toUpperCase()) {
      const [slugRows] = await db.execute('SELECT id FROM coupons WHERE code = ? AND id <> ? LIMIT 1', [payload.code.toUpperCase(), id]);
      if (Array.isArray(slugRows) && slugRows.length > 0) {
        return jsonError('COUPON_EXISTS', 'Coupon code already exists.', 409);
      }
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'undefined') continue;
      if (key === 'code') {
        fields.push('code = ?');
        params.push(String(value).toUpperCase());
        continue;
      }
      if (key === 'is_active') {
        fields.push('is_active = ?');
        params.push(value ? 1 : 0);
        continue;
      }
      fields.push(`${key} = ?`);
      params.push(value);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    if (fields.length > 0) {
      await db.execute(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    }

    const [updatedRows] = await db.execute('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? (updatedRows[0] as any) : null;

    await writeAuditLog({ action: 'COUPON_UPDATED', entityType: 'coupon', entityId: id, before: existing, after: updated, ipAddress: ip });
    await writeSystemLog({ eventType: 'COUPON_UPDATED', description: `Coupon updated: ${id}`, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', item: updated });
  }, {
    rateLimitScope: 'admin_coupons_write',
    rateLimitLimit: 50,
    rateLimitWindowMs: 60_000,
  });
}
