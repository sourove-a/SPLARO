import { randomInt } from 'node:crypto';
import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeSystemLog } from '../../../../lib/log';
import { sendMail } from '../../../../lib/mailer';
import { authForgotPasswordSchema } from '../../../../lib/validators';

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export async function POST(request: NextRequest) {
  return withApiHandler(
    request,
    async ({ request: req, ip }) => {
      const body = await req.json().catch(() => null);
      const parsed = authForgotPasswordSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('VALIDATION_ERROR', 'Invalid email payload.', 400, {
          details: parsed.error.flatten(),
        });
      }

      const email = parsed.data.email.toLowerCase();
      const otp = generateOtp();
      const expiryAt = new Date(Date.now() + 10 * 60 * 1000);
      const db = await getDbPool();

      if (!db) {
        const mem = fallbackStore();
        const user = mem.users.find((u) => u.email.toLowerCase() === email);
        if (!user) {
          return jsonError('IDENTITY_NOT_FOUND', 'No account found for this email.', 404);
        }
        (user as any).reset_code = otp;
        (user as any).reset_expiry = expiryAt.toISOString();
      } else {
        const [rows] = await db.execute('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
        const user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
        if (!user) {
          return jsonError('IDENTITY_NOT_FOUND', 'No account found for this email.', 404);
        }
        await db.execute(
          'UPDATE users SET reset_code = ?, reset_expiry = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [otp, expiryAt, user.id],
        );
      }

      try {
        await sendMail({
          to: email,
          subject: 'SPLARO Password Reset Code',
          text: `Your SPLARO verification code is ${otp}. This code expires in 10 minutes.`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#f5e7bc;padding:24px;border:1px solid #3f3522;border-radius:16px">
              <h2 style="margin:0 0 12px 0;color:#f5e7bc">Reset Your Password</h2>
              <p style="margin:0 0 14px 0;color:#d6be84">Use this code to reset your SPLARO account password.</p>
              <div style="font-size:28px;font-weight:700;letter-spacing:0.2em;color:#e8c670">${otp}</div>
              <p style="margin:14px 0 0 0;color:#d6be84">This code expires in 10 minutes.</p>
            </div>
          `,
        });
      } catch {
        return jsonError('MAIL_DELIVERY_FAILED', 'Could not deliver reset code email right now.', 500);
      }

      await writeSystemLog({
        eventType: 'AUTH_RESET_CODE_SENT',
        description: `Password reset code sent: ${email}`,
        ipAddress: ip,
      });

      return jsonSuccess({
        message: 'RESET_CODE_SENT',
        channel: 'email',
        expires_in_seconds: 600,
      });
    },
    {
      rateLimitScope: 'auth_forgot_password',
      rateLimitLimit: 8,
      rateLimitWindowMs: 60_000,
    },
  );
}
