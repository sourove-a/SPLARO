import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appendRow } from '@/lib/sheets';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { orderCreateSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({ key: `order:${ip}`, limit: 20, windowMs: 60_000 });

  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = orderCreateSchema.safeParse(body);
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

  const orderId = `SPL-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const createdAt = new Date().toISOString();

  try {
    await appendRow('ORDERS', [
      orderId,
      createdAt,
      parsed.data.name,
      parsed.data.email,
      parsed.data.phone,
      parsed.data.address,
      parsed.data.district,
      parsed.data.thana,
      parsed.data.product_name,
      parsed.data.product_url || '',
      parsed.data.image_url || '',
      parsed.data.quantity,
      parsed.data.notes || '',
      'PENDING',
    ]);

    return NextResponse.json({
      success: true,
      order_id: orderId,
      message: 'Order received',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save order',
      },
      { status: 500 },
    );
  }
}
