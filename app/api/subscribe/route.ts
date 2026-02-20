import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { validateSubscribePayload } from '@/lib/apiValidators';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({ key: `api_subscribe:${ip}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (body?.website) {
    return NextResponse.json({ success: false, message: 'Spam blocked' }, { status: 400 });
  }

  const parsed = validateSubscribePayload(body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ success: false, message: parsed.message ?? 'Invalid request' }, { status: 400 });
  }

  const { email, consent, source } = parsed.data;

  const existing = await prisma.subscription.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      sub_id: existing.id,
      message: 'Already subscribed',
      request_id: randomUUID(),
    });
  }

  const created = await prisma.subscription.create({
    data: {
      email,
      consent: Boolean(consent),
      source: source || 'footer',
    },
    select: { id: true },
  });

  await sendTelegramMessage(
    [
      '<b>📩 New Subscriber</b>',
      `Sub ID: <b>${created.id}</b>`,
      `Email: ${email}`,
      `Consent: ${Boolean(consent)}`,
      `Source: ${source || 'footer'}`,
    ].join('\n'),
  );

  return NextResponse.json({
    success: true,
    sub_id: created.id,
    request_id: randomUUID(),
  });
}
