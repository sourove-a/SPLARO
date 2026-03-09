import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest) {
  const k = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ','');
  return k === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = new URL(req.url).searchParams.get('type');
  const where: any = {};
  if (type) where.type = type;

  const blocks = await prisma.contentBlock.findMany({
    where,
    orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }]
  });

  return NextResponse.json({ blocks });
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.key || !body.type) {
    return NextResponse.json({ error: 'key and type required' }, { status: 400 });
  }

  const block = await prisma.contentBlock.create({
    data: {
      key: body.key,
      type: body.type,
      title: body.title || null,
      subtitle: body.subtitle || null,
      body: body.body || null,
      imageUrl: body.imageUrl || null,
      linkUrl: body.linkUrl || null,
      linkText: body.linkText || null,
      isPublished: body.isPublished !== false,
      displayOrder: Number(body.displayOrder) || 0,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null
    }
  });

  return NextResponse.json({ block }, { status: 201 });
}
