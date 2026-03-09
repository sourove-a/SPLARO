import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function adminOk(req: NextRequest) {
  const k = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ','');
  return k === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const zones = await prisma.shippingZone.findMany({
    orderBy: { shippingFee: 'asc' }
  });

  return NextResponse.json({ zones });
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.name || body.shippingFee === undefined) {
    return NextResponse.json({ error: 'name and shippingFee required' }, { status: 400 });
  }

  const zone = await prisma.shippingZone.create({
    data: {
      name: body.name,
      description: body.description || null,
      shippingFee: Number(body.shippingFee),
      estimatedDays: body.estimatedDays || null,
      freeShippingAbove: body.freeShippingAbove ? Number(body.freeShippingAbove) : null,
      isCodAvailable: body.isCodAvailable !== false,
      isActive: body.isActive !== false
    }
  });

  return NextResponse.json({ zone }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const zone = await prisma.shippingZone.update({
    where: { id: Number(id) },
    data
  });

  return NextResponse.json({ zone });
}
