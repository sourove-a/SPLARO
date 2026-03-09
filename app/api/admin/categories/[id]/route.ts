import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest): boolean {
  const key = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  return key === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const cat = await prisma.category.findUnique({ 
    where: { id: Number(id) }, 
    include: { products: { take: 5 }, children: true } 
  });
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ category: cat });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    const cat = await prisma.category.update({
      where: { id: Number(id) },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.slug && { slug: body.slug.trim().toLowerCase() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.parentId !== undefined && { parentId: body.parentId ? Number(body.parentId) : null }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
        ...(body.displayOrder !== undefined && { displayOrder: Number(body.displayOrder) }),
      },
    });
    return NextResponse.json({ category: cat });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    await prisma.category.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
