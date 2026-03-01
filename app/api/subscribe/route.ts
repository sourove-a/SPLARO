import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../lib/apiRoute';
import { getDbPool } from '../../../lib/db';
import { jsonError, jsonSuccess } from '../../../lib/env';
import { fallbackStore } from '../../../lib/fallbackStore';
import { writeSystemLog } from '../../../lib/log';
import { subscriptionCreateSchema } from '../../../lib/validators';
import { fireIntegrationEvent } from '../../../lib/integrationDispatch';

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => null);
    const parsed = subscriptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid subscription payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const email = payload.email.toLowerCase();
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const exists = mem.subscriptions.some((item) => item.email.toLowerCase() === email);
      if (exists) return jsonError('ALREADY_SUBSCRIBED', 'Email already subscribed.', 409);

      const id = randomUUID();
      const created = new Date().toISOString();
      mem.subscriptions.unshift({
        id,
        email,
        consent: payload.consent,
        source: payload.source,
        created_at: created,
      });

      await writeSystemLog({
        eventType: 'SUBSCRIBE_FALLBACK',
        description: `Subscription fallback: ${email}`,
        ipAddress: ip,
      });

      fireIntegrationEvent('SUBSCRIBED', {
        sub_id: id,
        created_at: created,
        email,
        consent: Boolean(payload.consent),
        source: payload.source,
      });

      return jsonSuccess({ storage: 'fallback', subscription: { id, email, source: payload.source, created_at: created } }, 201);
    }

    const [rows] = await db.execute('SELECT id FROM subscriptions WHERE email = ? LIMIT 1', [email]);
    if (Array.isArray(rows) && rows.length > 0) {
      return jsonError('ALREADY_SUBSCRIBED', 'Email already subscribed.', 409);
    }

    const id = randomUUID();
    await db.execute(
      'INSERT INTO subscriptions (id, email, consent, source) VALUES (?, ?, ?, ?)',
      [id, email, payload.consent ? 1 : 0, payload.source],
    );

    await writeSystemLog({
      eventType: 'SUBSCRIBE',
      description: `Newsletter subscription: ${email}`,
      ipAddress: ip,
    });

    fireIntegrationEvent('SUBSCRIBED', {
      sub_id: id,
      created_at: new Date().toISOString(),
      email,
      consent: Boolean(payload.consent),
      source: payload.source,
    });

    return jsonSuccess({
      storage: 'mysql',
      subscription: {
        id,
        email,
        source: payload.source,
      },
    }, 201);
  }, {
    rateLimitScope: 'subscribe',
    rateLimitLimit: 40,
    rateLimitWindowMs: 60_000,
  });
}
