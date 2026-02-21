import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../../lib/env';
import { fallbackStore } from '../../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../../lib/log';
import { userRoleSchema } from '../../../../../../lib/validators';

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const userId = String(context.params.id || '').trim();
    if (!userId) return jsonError('INVALID_ID', 'Invalid user id.', 400);

    const body = await req.json().catch(() => null);
    const parsed = userRoleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid role payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const idx = mem.users.findIndex((user) => user.id === userId);
      if (idx < 0) return jsonError('NOT_FOUND', 'User not found.', 404);

      const before = { ...mem.users[idx] };
      mem.users[idx] = {
        ...mem.users[idx],
        role: payload.role,
        updated_at: new Date().toISOString(),
      } as any;
      const after = mem.users[idx];

      await writeAuditLog({
        actorId: payload.actor_id || null,
        action: 'USER_ROLE_UPDATED',
        entityType: 'user',
        entityId: userId,
        before,
        after,
        ipAddress: ip,
      });
      await writeSystemLog({
        eventType: 'USER_ROLE_UPDATED_FALLBACK',
        description: `User ${userId} role=${payload.role}`,
        userId: payload.actor_id || null,
        ipAddress: ip,
      });

      return jsonSuccess({ storage: 'fallback', user: after });
    }

    const [existingRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as any) : null;
    if (!existing) return jsonError('NOT_FOUND', 'User not found.', 404);

    await db.execute('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [payload.role, userId]);

    const [updatedRows] = await db.execute(
      'SELECT id, name, email, phone, district, thana, address, role, is_blocked, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? (updatedRows[0] as any) : null;

    await writeAuditLog({
      actorId: payload.actor_id || null,
      action: 'USER_ROLE_UPDATED',
      entityType: 'user',
      entityId: userId,
      before: existing,
      after: updated,
      ipAddress: ip,
    });
    await writeSystemLog({
      eventType: 'USER_ROLE_UPDATED',
      description: `User ${userId} role=${payload.role}`,
      userId: payload.actor_id || null,
      ipAddress: ip,
    });

    return jsonSuccess({ storage: 'mysql', user: updated });
  }, {
    rateLimitScope: 'admin_users_role',
    rateLimitLimit: 60,
    rateLimitWindowMs: 60_000,
  });
}
