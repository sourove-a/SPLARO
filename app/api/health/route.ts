import { NextResponse } from 'next/server';
import { hasStoredTokens } from '@/lib/googleAuth';
import { getSpreadsheetId } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET() {
  const oauthConfigured = await hasStoredTokens();
  const spreadsheetId = await getSpreadsheetId();

  return NextResponse.json({
    ok: true,
    service: 'SPLARO_NEXT_API',
    time: new Date().toISOString(),
    oauthConfigured,
    spreadsheetReady: Boolean(spreadsheetId),
  });
}
