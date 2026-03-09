import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest): boolean {
  const key = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  return key === process.env.ADMIN_KEY;
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\u0980-\u09FF\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-');
}

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Number(searchParams.get('limit') || 20));
  const search = searchParams.get('q') || '';
  const categoryId = searchParams.get('categoryId');
  const status = searchParams.get('status');
  const stock = searchParams.get('stock');
  const skip = (page - 1) * limit;

  const where: any = { isArchived: false };
  if (search) where.OR = [
    { name: { contains: search } },
    { sku: { contains: search } },
    { tags: { contains: search } },
  ];
  if (categoryId) where.categoryId = Number(categoryId);
  if (status === 'draft') where.isDraft = true;
  else if (status === 'published') { where.isPublished = true; where.isDraft = false; }
  else if (status === 'archived') { (where as any).isArchived = true; }
  if (stock === 'out') where.stockQty = 0;
  else if (stock === 'low') where.AND = [{ stockQty: { gt: 0 } }, { stockQty: { lte: 5 } }];

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({ products, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { name, categoryId, regularPrice, stockQty } = body;
    if (!name || regularPrice === undefined) return NextResponse.json({ error: 'name and regularPrice required' }, { status: 400 });

    const slug = body.slug ? body.slug.trim() : slugify(name) + '-' + Date.now();
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        slug,
        shortDescription: body.shortDescription || null,
        description: body.description || null,
        sku: body.sku || null,
        categoryId: categoryId ? Number(categoryId) : null,
        brand: body.brand || null,
        fabric: body.fabric || null,
        color: body.color || null,
        sizeInfo: body.sizeInfo || null,
        blousePiece: Boolean(body.blousePiece),
        regularPrice: Number(regularPrice),
        salePrice: body.salePrice ? Number(body.salePrice) : null,
        costPrice: body.costPrice ? Number(body.costPrice) : null,
        stockQty: Number(stockQty) || 0,
        lowStockThreshold: Number(body.lowStockThreshold) || 5,
        imageUrl: body.imageUrl || null,
        imageUrls: body.imageUrls ? JSON.stringify(body.imageUrls) : null,
        isFeatured: Boolean(body.isFeatured),
        isNewArrival: Boolean(body.isNewArrival),
        isBestseller: Boolean(body.isBestseller),
        isPublished: body.isPublished !== false,
        isDraft: Boolean(body.isDraft),
        seoTitle: body.seoTitle || null,
        metaDescription: body.metaDescription || null,
        tags: body.tags || null,
        careInstructions: body.careInstructions || null,
        displayOrder: Number(body.displayOrder) || 0,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'SKU or slug already exists' }, { status: 409 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
