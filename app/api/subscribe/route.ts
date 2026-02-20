import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appendRow, findRow } from '@/lib/sheets';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { subscriptionCreateSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({ key: `subscribe:${ip}`, limit: 20, windowMs: 60_000 });

  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscriptionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid payload',
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if ((parsed.data.website || '').trim()) {
    return NextResponse.json({ success: false, message: 'Spam blocked' }, { status: 400 });
  }

  try {
    const existing = await findRow('SUBSCRIPTIONS', { email: parsed.data.email });
    if (existing?.sub_id) {
      return NextResponse.json({
        success: true,
        sub_id: existing.sub_id,
        message: 'Already subscribed',
      });
    }

    const subId = `SUB-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    await appendRow('SUBSCRIPTIONS', [
      subId,
      new Date().toISOString(),
      parsed.data.email,
      parsed.data.consent ? 'true' : 'false',
      parsed.data.source,
    ]);

    return NextResponse.json({ success: true, sub_id: subId });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save subscription',
      },
      { status: 500 },
    );
  }
}
