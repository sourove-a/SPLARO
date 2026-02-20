import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../lib/log';
import { productUpdateSchema } from '../../../../../lib/validators';

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const id = String(context.params.id || '').trim();
    if (!id) return jsonError('INVALID_ID', 'Invalid product id.', 400);

    const body = await req.json().catch(() => null);
    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid product payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.products.findIndex((item) => item.id === id);
      if (idx < 0) return jsonError('NOT_FOUND', 'Product not found.', 404);
      const before = { ...mem.products[idx] };
      mem.products[idx] = {
        ...mem.products[idx],
        ...payload,
        updated_at: new Date().toISOString(),
      } as any;
      const after = mem.products[idx];

      await writeAuditLog({ actorId: null, action: 'PRODUCT_UPDATED', entityType: 'product', entityId: id, before, after, ipAddress: ip });
      await writeSystemLog({ eventType: 'PRODUCT_UPDATED_FALLBACK', description: `Product updated: ${id}`, ipAddress: ip });
      return jsonSuccess({ storage: 'fallback', item: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'Product not found.', 404);

    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(payload)) {
      fields.push(`${key} = ?`);
      params.push(key === 'active' ? (value ? 1 : 0) : value);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    if (fields.length > 0) {
      await db.execute(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    }

    const [updatedRows] = await db.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : null;

    await writeAuditLog({ actorId: null, action: 'PRODUCT_UPDATED', entityType: 'product', entityId: id, before: existing, after: updated, ipAddress: ip });
    await writeSystemLog({ eventType: 'PRODUCT_UPDATED', description: `Product updated: ${id}`, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', item: updated });
  }, {
    rateLimitScope: 'admin_products_write',
    rateLimitLimit: 60,
    rateLimitWindowMs: 60_000,
  });
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const id = String(context.params.id || '').trim();
    if (!id) return jsonError('INVALID_ID', 'Invalid product id.', 400);

    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.products.findIndex((item) => item.id === id);
      if (idx < 0) return jsonError('NOT_FOUND', 'Product not found.', 404);
      const before = { ...mem.products[idx] };
      mem.products[idx] = { ...mem.products[idx], active: false, updated_at: new Date().toISOString() };
      const after = mem.products[idx];

      await writeAuditLog({ actorId: null, action: 'PRODUCT_SOFT_DELETED', entityType: 'product', entityId: id, before, after, ipAddress: ip });
      await writeSystemLog({ eventType: 'PRODUCT_SOFT_DELETED_FALLBACK', description: `Product soft delete: ${id}`, ipAddress: ip });

      return jsonSuccess({ storage: 'fallback', item: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'Product not found.', 404);

    await db.execute('UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    const [updatedRows] = await db.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : null;

    await writeAuditLog({ actorId: null, action: 'PRODUCT_SOFT_DELETED', entityType: 'product', entityId: id, before: existing, after: updated, ipAddress: ip });
    await writeSystemLog({ eventType: 'PRODUCT_SOFT_DELETED', description: `Product soft delete: ${id}`, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', item: updated });
  }, {
    rateLimitScope: 'admin_products_write',
    rateLimitLimit: 60,
    rateLimitWindowMs: 60_000,
  });
}
