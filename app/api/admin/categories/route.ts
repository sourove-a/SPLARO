import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest): boolean {
  const key = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  return key === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true } },
        children: { select: { id: true, name: true, slug: true, isActive: true } },
      },
    });
    return NextResponse.json({ categories });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { name, slug, description, imageUrl, parentId, isActive, displayOrder } = body;
    if (!name || !slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 });
    const cat = await prisma.category.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description || null,
        imageUrl: imageUrl || null,
        parentId: parentId ? Number(parentId) : null,
        isActive: isActive !== false,
        displayOrder: Number(displayOrder) || 0,
      },
    });
    return NextResponse.json({ category: cat }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}
