import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appendRow, findRow } from '@/lib/sheets';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { signupCreateSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({ key: `signup:${ip}`, limit: 15, windowMs: 60_000 });

  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signupCreateSchema.safeParse(body);
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
    const existing = await findRow('USERS', { email: parsed.data.email });
    if (existing?.user_id) {
      return NextResponse.json({
        success: true,
        user_id: existing.user_id,
        message: 'Already registered',
      });
    }

    const userId = `USR-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    await appendRow('USERS', [
      userId,
      new Date().toISOString(),
      parsed.data.name,
      parsed.data.email,
      parsed.data.phone,
      parsed.data.district,
      parsed.data.thana,
      parsed.data.address,
      'web',
      'false',
    ]);

    return NextResponse.json({ success: true, user_id: userId });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save signup',
      },
      { status: 500 },
    );
  }
}
