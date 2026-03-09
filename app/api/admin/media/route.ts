import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

function adminOk(req: NextRequest) {
  const k = req.headers.get('x-admin-key') || req.headers.get('authorization')?.replace('Bearer ','');
  return k === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams: sp } = new URL(req.url);
  const page = Math.max(1, Number(sp.get('page') || 1));
  const limit = 40;

  const [files, total] = await Promise.all([
    prisma.mediaFile.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.mediaFile.count(),
  ]);

  return NextResponse.json({ files, total, page });
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/${filename}`;
    const record = await prisma.mediaFile.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url,
        altText: (formData.get('altText') as string) || null,
        uploadedBy: (formData.get('uploadedBy') as string) || 'admin'
      }
    });

    return NextResponse.json({ file: record }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
