import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../../lib/env';
import { fallbackStore } from '../../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../../lib/log';
import { userBlockSchema } from '../../../../../../lib/validators';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const routeParams = await context.params;
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const userId = String(routeParams.id || '').trim();
    if (!userId) return jsonError('INVALID_ID', 'Invalid user id.', 400);

    const body = await req.json().catch(() => null);
    const parsed = userBlockSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid block payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const actorId = payload.actor_id || null;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.users.findIndex((user) => user.id === userId);
      if (idx < 0) return jsonError('NOT_FOUND', 'User not found.', 404);
      const before = { ...mem.users[idx] };
      mem.users[idx] = {
        ...mem.users[idx],
        is_blocked: payload.is_blocked,
        updated_at: new Date().toISOString(),
      };
      const after = mem.users[idx];

      await writeAuditLog({ actorId, action: 'USER_BLOCK_UPDATED', entityType: 'user', entityId: userId, before, after, ipAddress: ip });
      await writeSystemLog({ eventType: 'USER_BLOCK_UPDATED_FALLBACK', description: `User ${userId} blocked=${payload.is_blocked}`, userId: actorId, ipAddress: ip });

      return jsonSuccess({ storage: 'fallback', user: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'User not found.', 404);

    await db.execute('UPDATE users SET is_blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [payload.is_blocked ? 1 : 0, userId]);
    const [updatedRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? (updatedRows[0] as any) : null;

    await writeAuditLog({ actorId, action: 'USER_BLOCK_UPDATED', entityType: 'user', entityId: userId, before: existing, after: updated, ipAddress: ip });
    await writeSystemLog({ eventType: 'USER_BLOCK_UPDATED', description: `User ${userId} blocked=${payload.is_blocked}`, userId: actorId, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', user: updated });
  }, {
    rateLimitScope: 'admin_users_block',
    rateLimitLimit: 80,
    rateLimitWindowMs: 60_000,
  });
}
