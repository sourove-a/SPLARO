import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAdminAccess } from '../../../../lib/adminAuth';
import { listCampaigns, saveCampaign } from '../../../../lib/adminPersistence';

const segmentSchema = z.object({
  type: z.enum(['ALL_USERS', 'NEW_SIGNUPS_7D', 'INACTIVE_30D', 'VIP_USERS']),
  district: z.string().optional(),
  thana: z.string().optional(),
  vipMinOrders: z.number().int().min(0).optional(),
  vipMinSpend: z.number().min(0).optional(),
});

const createSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['Draft', 'Active', 'Paused', 'Completed']).optional(),
  segment: segmentSchema.optional(),
  audienceSegment: z.string().optional(),
  targetCount: z.number().min(0).optional(),
  pulsePercent: z.number().min(0).max(100).optional(),
  scheduleTime: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
  const pageSize = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('pageSize') || 20)));
  const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  const status = String(request.nextUrl.searchParams.get('status') || '').trim();

  const result = await listCampaigns();
  let rows = result.items;
  if (status) rows = rows.filter((item) => item.status === status);
  if (q) {
    rows = rows.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.audienceSegment.toLowerCase().includes(q),
    );
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return NextResponse.json({
    success: true,
    storage: result.storage,
    items: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  });
}

export async function POST(request: NextRequest) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid payload', errors: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const saved = await saveCampaign({
    id: payload.id,
    name: payload.name,
    description: payload.description || '',
    status: payload.status || 'Draft',
    audienceSegment: payload.audienceSegment || payload.segment?.type || 'all_users',
    targetCount: payload.targetCount || 0,
    pulsePercent: payload.pulsePercent || 0,
    scheduleTime: payload.scheduleTime || new Date().toISOString(),
  });

  return NextResponse.json({ success: true, storage: saved.storage, campaign: saved.item }, { status: 201 });
}
