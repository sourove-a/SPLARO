import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest) {
  const k = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ','');
  return k === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const unreadOnly = new URL(req.url).searchParams.get('unread') === 'true';

  const notifications = await prisma.adminNotification.findMany({
    where: unreadOnly ? { isRead: false } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const unreadCount = await prisma.adminNotification.count({
    where: { isRead: false }
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  if (body.markAllRead) {
    await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
  } else if (body.id) {
    await prisma.adminNotification.update({
      where: { id: Number(body.id) },
      data: { isRead: true }
    });
  }

  return NextResponse.json({ ok: true });
}
