import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAdminAccess } from '../../../../../lib/adminAuth';
import {
  listCampaigns,
  removeCampaign,
  saveCampaign,
} from '../../../../../lib/adminPersistence';

const segmentSchema = z.object({
  type: z.enum(['ALL_USERS', 'NEW_SIGNUPS_7D', 'INACTIVE_30D', 'VIP_USERS']),
  district: z.string().optional(),
  thana: z.string().optional(),
  vipMinOrders: z.number().int().min(0).optional(),
  vipMinSpend: z.number().min(0).optional(),
});

const patchSchema = z.object({
  action: z.enum(['activate', 'pause', 'duplicate', 'delete']).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['Draft', 'Active', 'Paused', 'Completed']).optional(),
  segment: segmentSchema.optional(),
  audienceSegment: z.string().optional(),
  targetCount: z.number().min(0).optional(),
  pulsePercent: z.number().min(0).max(100).optional(),
  scheduleTime: z.string().optional(),
});

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const { id } = context.params;
  const listed = await listCampaigns();
  const campaign = listed.items.find((item) => item.id === id);
  if (!campaign) {
    return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    storage: listed.storage,
    campaign,
    jobs: [],
    logs: [],
  });
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const { id } = context.params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'Invalid payload', errors: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  if (payload.action === 'duplicate') {
    const listed = await listCampaigns();
    const source = listed.items.find((item) => item.id === id);
    if (!source) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }
    const duplicated = await saveCampaign({
      ...source,
      id: undefined,
      name: `${source.name} copy`,
      status: 'Draft',
    });
    return NextResponse.json({ success: true, storage: duplicated.storage, campaign: duplicated.item });
  }

  if (payload.action === 'delete') {
    const deleted = await removeCampaign(id);
    if (!deleted.ok) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, storage: deleted.storage });
  }

  const listed = await listCampaigns();
  const source = listed.items.find((item) => item.id === id);
  if (!source) {
    return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
  }

  const statusFromAction = payload.action === 'activate'
    ? 'Active'
    : payload.action === 'pause'
      ? 'Paused'
      : undefined;

  const updated = await saveCampaign({
    ...source,
    id,
    name: payload.name ?? source.name,
    description: payload.description ?? source.description,
    status: (payload.status || statusFromAction || source.status),
    audienceSegment: payload.audienceSegment || payload.segment?.type || source.audienceSegment,
    targetCount: payload.targetCount ?? source.targetCount,
    pulsePercent: payload.pulsePercent ?? source.pulsePercent,
    scheduleTime: payload.scheduleTime ?? source.scheduleTime,
  });

  return NextResponse.json({ success: true, storage: updated.storage, campaign: updated.item });
}
