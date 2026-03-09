import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest) {
  const k = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ','');
  return k === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const r = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: { order: true, user: true }
  });

  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ request: r });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  if (body.status) data.status = body.status;
  if (body.refundStatus) data.refundStatus = body.refundStatus;
  if (body.refundAmount !== undefined) data.refundAmount = Number(body.refundAmount);
  if (body.adminNote !== undefined) data.adminNote = body.adminNote;

  const r = await prisma.returnRequest.update({
    where: { id: Number(id) },
    data
  });

  return NextResponse.json({ request: r });
}
