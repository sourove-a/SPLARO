import { NextResponse } from 'next/server';
import { buildGoogleConsentUrl, createOAuthState, isSetupKeyAuthorized } from '@/lib/googleAuth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isSetupKeyAuthorized(request)) {
    return NextResponse.json({ ok: false, message: 'Unauthorized setup request' }, { status: 401 });
  }

  const state = await createOAuthState();
  const consentUrl = buildGoogleConsentUrl(state);
  return NextResponse.redirect(consentUrl);
}
