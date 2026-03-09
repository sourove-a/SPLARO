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
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: {
      category: true,
      mediaFiles: { orderBy: { sortOrder: 'asc' } },
      reviews: { where: { status: 'APPROVED' }, take: 5, orderBy: { createdAt: 'desc' } },
      inventory: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    const updateData: any = {};
    const fields = ['name','slug','shortDescription','description','sku','brand','fabric','color','sizeInfo','imageUrl','seoTitle','metaDescription','tags','careInstructions'];
    fields.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f] || null; });
    const bools = ['blousePiece','isFeatured','isNewArrival','isBestseller','isPublished','isDraft','isArchived'];
    bools.forEach(f => { if (body[f] !== undefined) updateData[f] = Boolean(body[f]); });
    const nums = ['categoryId','regularPrice','salePrice','costPrice','stockQty','lowStockThreshold','displayOrder'];
    nums.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f] ? Number(body[f]) : null; });
    if (body.imageUrls !== undefined) updateData.imageUrls = Array.isArray(body.imageUrls) ? JSON.stringify(body.imageUrls) : body.imageUrls;

    const updatedProduct = await prisma.product.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ product: updatedProduct });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    await prisma.product.update({ where: { id: Number(id) }, data: { isArchived: true, isPublished: false } });
    return NextResponse.json({ ok: true, message: 'Product archived' });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
