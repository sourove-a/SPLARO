import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest) {
  const k = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ','');
  return k === process.env.ADMIN_KEY;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  ['title', 'subtitle', 'body', 'imageUrl', 'linkUrl', 'linkText'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });

  if (body.isPublished !== undefined) data.isPublished = Boolean(body.isPublished);
  if (body.displayOrder !== undefined) data.displayOrder = Number(body.displayOrder);
  if (body.metadata !== undefined) data.metadata = JSON.stringify(body.metadata);

  const block = await prisma.contentBlock.update({
    where: { id: Number(id) },
    data
  });

  return NextResponse.json({ block });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.contentBlock.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
