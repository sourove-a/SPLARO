import { NextResponse } from 'next/server';
import { consumeOAuthState, exchangeAuthorizationCode } from '@/lib/googleAuth';
import { createSpreadsheetIfMissing, ensureTabsAndHeaders } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ ok: false, message: 'Missing code/state' }, { status: 400 });
  }

  const stateValid = await consumeOAuthState(state);
  if (!stateValid) {
    return NextResponse.json({ ok: false, message: 'Invalid setup state' }, { status: 403 });
  }

  await exchangeAuthorizationCode(code);
  const { spreadsheetId } = await createSpreadsheetIfMissing();
  await ensureTabsAndHeaders(spreadsheetId);

  return NextResponse.json({
    ok: true,
    message: 'Google setup completed',
    spreadsheetId,
  });
}
