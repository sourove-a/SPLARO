import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest) {
  const k = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ','');
  return k === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams: sp } = new URL(req.url);
  const status = sp.get('status');
  const type = sp.get('type');
  const page = Math.max(1, Number(sp.get('page') || 1));

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const [requests, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      skip: (page - 1) * 20,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, orderNumber: true, total: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.returnRequest.count({ where }),
  ]);

  return NextResponse.json({ requests, total, page });
}
