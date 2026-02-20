import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { validateSignupPayload } from '@/lib/apiValidators';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { sendMail } from '@/lib/mailer';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';

function fallbackNameFromEmail(email: string): string {
  const local = email.split('@')[0] || '';
  const cleaned = local.replace(/[0-9]/g, ' ').replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'SPLARO Customer';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({ key: `api_signup:${ip}`, limit: 15, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (body?.website) {
    return NextResponse.json({ success: false, message: 'Spam blocked' }, { status: 400 });
  }

  const parsed = validateSignupPayload(body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ success: false, message: parsed.message ?? 'Invalid request' }, { status: 400 });
  }

  const { email, phone, district, thana, address, provider } = parsed.data;
  const name = parsed.data.name?.trim() || fallbackNameFromEmail(email);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      user_id: existing.id,
      message: 'Already registered',
    });
  }

  const passwordHash =
    provider === 'LOCAL' && parsed.data.password ? hashPassword(parsed.data.password) : null;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      district: district || null,
      thana: thana || null,
      address: address || null,
      provider: provider ?? 'LOCAL',
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  try {
    await sendMail({
      to: email,
      subject: 'Welcome to SPLARO',
      html: `<h2>Welcome, ${name}</h2><p>Your SPLARO account is now active.</p>`,
      text: `Welcome, ${name}. Your SPLARO account is now active.`,
    });
  } catch (error) {
    console.error('mail_welcome_failed', {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  await sendTelegramMessage(
    [
      '<b>✅ New Signup</b>',
      `User ID: <b>${user.id}</b>`,
      `Name: ${user.name}`,
      `Email: ${user.email}`,
      `Phone: ${phone || 'N/A'}`,
    ].join('\n'),
  );

  return NextResponse.json({
    success: true,
    user_id: user.id,
    request_id: randomUUID(),
  });
}
