import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAdminAccess } from '../../../../lib/adminAuth';
import { getSettings, saveSettings } from '../../../../lib/adminPersistence';

const settingsSchema = z.record(z.any());

export async function GET(request: NextRequest) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const result = await getSettings();
  return NextResponse.json({ success: true, storage: result.storage, settings: result.settings });
}

export async function POST(request: NextRequest) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
  }

  const saved = await saveSettings(parsed.data);
  return NextResponse.json({ success: true, storage: saved.storage, settings: saved.settings });
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
