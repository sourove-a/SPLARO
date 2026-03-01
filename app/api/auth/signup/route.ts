import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeSystemLog } from '../../../../lib/log';
import { hashPassword } from '../../../../lib/password';
import { authSignupSchema } from '../../../../lib/validators';
import { fireIntegrationEvent } from '../../../../lib/integrationDispatch';

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => null);
    const parsed = authSignupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid signup payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();
    const id = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = payload.password ? hashPassword(payload.password) : null;

    if (!db) {
      const mem = fallbackStore();
      const exists = mem.users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase());
      if (exists) return jsonError('EMAIL_EXISTS', 'Email already registered.', 409);

      mem.users.unshift({
        id,
        name: payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        district: payload.district,
        thana: payload.thana,
        address: payload.address,
        password_hash: passwordHash,
        role: 'user',
        is_blocked: false,
        created_at: now,
        updated_at: now,
      });

      await writeSystemLog({
        eventType: 'AUTH_SIGNUP_FALLBACK',
        description: `User signup stored in fallback: ${payload.email}`,
        userId: id,
        ipAddress: ip,
      });

      fireIntegrationEvent('USER_SIGNUP', {
        user_id: id,
        created_at: now,
        name: payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        district: payload.district,
        thana: payload.thana,
        address: payload.address,
        source: 'web',
        verified: false,
      });

      return jsonSuccess({
        storage: 'fallback',
        user: {
          id,
          name: payload.name,
          email: payload.email.toLowerCase(),
          phone: payload.phone,
          role: 'user',
          created_at: now,
        },
      }, 201);
    }

    const [existingRows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [payload.email.toLowerCase()]);
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return jsonError('EMAIL_EXISTS', 'Email already registered.', 409);
    }

    await db.execute(
      `INSERT INTO users (id, name, email, phone, district, thana, address, password_hash, role, is_blocked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 0)`,
      [id, payload.name, payload.email.toLowerCase(), payload.phone, payload.district, payload.thana, payload.address, passwordHash],
    );

    await writeSystemLog({
      eventType: 'AUTH_SIGNUP',
      description: `User signup: ${payload.email}`,
      userId: id,
      ipAddress: ip,
    });

    fireIntegrationEvent('USER_SIGNUP', {
      user_id: id,
      created_at: now,
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone,
      district: payload.district,
      thana: payload.thana,
      address: payload.address,
      source: 'web',
      verified: false,
    });

    return jsonSuccess({
      storage: 'mysql',
      user: {
        id,
        name: payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        role: 'user',
        created_at: now,
      },
    }, 201);
  }, {
    rateLimitScope: 'auth_signup',
    rateLimitLimit: 30,
    rateLimitWindowMs: 60_000,
  });
}
