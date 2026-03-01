import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeSystemLog } from '../../../../lib/log';
import { hashPassword } from '../../../../lib/password';
import { authResetPasswordSchema } from '../../../../lib/validators';

const AUTH_COOKIE = 'splaro_auth_user';
const CSRF_COOKIE = 'splaro_csrf';

function encodeAuthCookie(payload: { id: string; email: string; role: string }) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function isExpired(value: unknown): boolean {
  if (!value) return true;
  const timestamp = new Date(String(value)).getTime();
  return !Number.isFinite(timestamp) || timestamp < Date.now();
}

export async function POST(request: NextRequest) {
  return withApiHandler(
    request,
    async ({ request: req, ip }) => {
      const body = await req.json().catch(() => null);
      const parsed = authResetPasswordSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('VALIDATION_ERROR', 'Invalid reset payload.', 400, {
          details: parsed.error.flatten(),
        });
      }

      const payload = parsed.data;
      const email = payload.email.toLowerCase();
      const otp = payload.otp.trim();
      const db = await getDbPool();

      let user:
        | {
          id: string;
          email: string;
          role: string;
          name: string;
          phone?: string;
          district?: string;
          thana?: string;
          address?: string;
          is_blocked?: number | boolean;
          reset_code?: string | null;
          reset_expiry?: string | Date | null;
        }
        | null = null;

      if (!db) {
        const mem = fallbackStore();
        const memUser = mem.users.find((item) => item.email.toLowerCase() === email);
        if (!memUser) {
          return jsonError('IDENTITY_NOT_FOUND', 'No account found for this email.', 404);
        }
        if (String((memUser as any).reset_code || '').trim() !== otp || isExpired((memUser as any).reset_expiry)) {
          return jsonError('INVALID_OR_EXPIRED_CODE', 'Invalid or expired code.', 400);
        }

        memUser.password_hash = hashPassword(payload.password);
        memUser.updated_at = new Date().toISOString();
        (memUser as any).reset_code = null;
        (memUser as any).reset_expiry = null;

        user = {
          id: memUser.id,
          email: memUser.email,
          role: memUser.role,
          name: memUser.name,
          phone: memUser.phone,
          district: memUser.district,
          thana: memUser.thana,
          address: memUser.address,
          is_blocked: memUser.is_blocked,
        };
      } else {
        const [rows] = await db.execute(
          `SELECT id, name, email, phone, district, thana, address, role, is_blocked, reset_code, reset_expiry
           FROM users
           WHERE email = ?
           LIMIT 1`,
          [email],
        );
        const row = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
        if (!row) {
          return jsonError('IDENTITY_NOT_FOUND', 'No account found for this email.', 404);
        }
        if (String(row.reset_code || '').trim() !== otp || isExpired(row.reset_expiry)) {
          return jsonError('INVALID_OR_EXPIRED_CODE', 'Invalid or expired code.', 400);
        }
        if (Number(row.is_blocked || 0) === 1) {
          return jsonError('USER_BLOCKED', 'Account is blocked.', 403);
        }

        await db.execute(
          `UPDATE users
           SET password_hash = ?, reset_code = NULL, reset_expiry = NULL, last_password_change_at = NOW(), updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [hashPassword(payload.password), row.id],
        );

        await db.execute(
          `INSERT INTO login_history (user_id, email, ip_address, user_agent)
           VALUES (?, ?, ?, ?)`,
          [row.id, row.email, ip, req.headers.get('user-agent') || null],
        );

        user = {
          id: String(row.id),
          email: String(row.email),
          role: String(row.role || 'user'),
          name: String(row.name || ''),
          phone: row.phone ? String(row.phone) : '',
          district: row.district ? String(row.district) : '',
          thana: row.thana ? String(row.thana) : '',
          address: row.address ? String(row.address) : '',
          is_blocked: row.is_blocked,
        };
      }

      if (!user) {
        return jsonError('RESET_FAILED', 'Could not reset password.', 500);
      }

      const token = `auth-${randomUUID()}`;
      const csrfToken = randomBytes(24).toString('hex');

      await writeSystemLog({
        eventType: 'AUTH_PASSWORD_RESET_SUCCESS',
        description: `Password reset + auto login: ${user.email}`,
        userId: user.id,
        ipAddress: ip,
      });

      const response = jsonSuccess({
        message: 'PASSWORD_RESET_SUCCESS',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          district: user.district || '',
          thana: user.thana || '',
          address: user.address || '',
          role: user.role || 'user',
          is_blocked: Number(user.is_blocked || 0) === 1,
        },
      });

      response.cookies.set(AUTH_COOKIE, encodeAuthCookie({
        id: user.id,
        email: user.email,
        role: user.role || 'user',
      }), {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      response.cookies.set(CSRF_COOKIE, csrfToken, {
        httpOnly: false,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24,
      });

      return response;
    },
    {
      rateLimitScope: 'auth_reset_password',
      rateLimitLimit: 15,
      rateLimitWindowMs: 60_000,
    },
  );
}
