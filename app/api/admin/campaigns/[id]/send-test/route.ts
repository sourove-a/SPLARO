import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAccess } from '../../../../../../lib/adminAuth';
import { sendCampaign } from '../../../../../../lib/adminStore';

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const { id } = context.params;
  const result = sendCampaign(id, 'TEST');
  if (!result) {
    return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...result });
}
