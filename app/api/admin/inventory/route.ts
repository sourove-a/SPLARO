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
  const productId = sp.get('productId');
  const type = sp.get('type') as string | undefined;
  const page = Math.max(1, Number(sp.get('page') || 1));
  const limit = 50;

  const where: any = {};
  if (productId) where.productId = Number(productId);
  if (type) where.type = type;

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { id: true, name: true, sku: true } } }
    }),
    prisma.inventoryLog.count({ where }),
  ]);

  // Low stock products
  const lowStock = await prisma.product.findMany({
    where: { isArchived: false, isPublished: true, stockQty: { gt: 0, lte: 5 } },
    select: { id: true, name: true, sku: true, stockQty: true, lowStockThreshold: true },
    orderBy: { stockQty: 'asc' },
    take: 20,
  });

  const outOfStock = await prisma.product.count({
    where: { isArchived: false, stockQty: 0 }
  });

  return NextResponse.json({ logs, total, page, lowStock, outOfStock });
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { productId, type, qty, reason, reference, performedBy } = body;

  if (!productId || !type || qty === undefined) {
    return NextResponse.json({ error: 'productId, type, qty required' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const qtyBefore = product.stockQty;
  let qtyAfter = qtyBefore;

  if (['STOCK_IN', 'RETURN'].includes(type)) {
    qtyAfter = qtyBefore + Number(qty);
  } else if (['STOCK_OUT', 'SALE', 'DAMAGE'].includes(type)) {
    qtyAfter = Math.max(0, qtyBefore - Number(qty));
  } else if (type === 'ADJUSTMENT') {
    qtyAfter = Number(qty);
  }

  const [log] = await prisma.$transaction([
    prisma.inventoryLog.create({
      data: {
        productId: Number(productId),
        type,
        qty: Number(qty),
        qtyBefore,
        qtyAfter,
        reason: reason || null,
        reference: reference || null,
        performedBy: performedBy || 'admin'
      }
    }),
    prisma.product.update({
      where: { id: Number(productId) },
      data: { stockQty: qtyAfter }
    }),
  ]);

  return NextResponse.json({ log, newQty: qtyAfter }, { status: 201 });
}
