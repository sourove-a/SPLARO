import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeSystemLog } from '../../../../lib/log';
import { verifyPassword } from '../../../../lib/password';
import { authLoginSchema } from '../../../../lib/validators';

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => null);
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid login payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();
    const email = payload.email.toLowerCase();

    if (!db) {
      const mem = fallbackStore();
      const user = mem.users.find((u) => u.email.toLowerCase() === email);
      if (!user || !user.password_hash || !verifyPassword(payload.password, user.password_hash)) {
        return jsonError('INVALID_CREDENTIALS', 'Invalid credentials.', 401);
      }
      if (user.is_blocked) return jsonError('USER_BLOCKED', 'Account is blocked.', 403);

      const token = `fallback-${randomUUID()}`;
      await writeSystemLog({ eventType: 'AUTH_LOGIN_FALLBACK', description: `Fallback login: ${email}`, userId: user.id, ipAddress: ip });
      return jsonSuccess({ storage: 'fallback', token, user: { ...user, password_hash: undefined } });
    }

    const [rows] = await db.execute(
      `SELECT id, name, email, phone, district, thana, address, password_hash, role, is_blocked, created_at, updated_at
       FROM users WHERE email = ? LIMIT 1`,
      [email],
    );

    const user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
    if (!user) return jsonError('INVALID_CREDENTIALS', 'Invalid credentials.', 401);
    if (!user.password_hash) return jsonError('PASSWORD_NOT_SET', 'Password login is not enabled for this account.', 400);
    if (!verifyPassword(payload.password, String(user.password_hash))) return jsonError('INVALID_CREDENTIALS', 'Invalid credentials.', 401);
    if (Number(user.is_blocked) === 1) return jsonError('USER_BLOCKED', 'Account is blocked.', 403);

    const token = `mysql-${randomUUID()}`;
    await db.execute(
      `INSERT INTO login_history (user_id, email, ip_address, user_agent)
       VALUES (?, ?, ?, ?)`,
      [
        user.id,
        email,
        ip,
        req.headers.get('user-agent') || null,
      ],
    );
    await writeSystemLog({ eventType: 'AUTH_LOGIN', description: `User login: ${email}`, userId: user.id, ipAddress: ip });

    return jsonSuccess({
      storage: 'mysql',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        district: user.district,
        thana: user.thana,
        address: user.address,
        role: user.role,
        is_blocked: Number(user.is_blocked) === 1,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  }, {
    rateLimitScope: 'auth_login',
    rateLimitLimit: 40,
    rateLimitWindowMs: 60_000,
  });
}
