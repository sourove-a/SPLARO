import { NextResponse } from 'next/server';

export function getAdminKeyFromRequest(headers: Headers): string {
  const direct = headers.get('x-admin-key');
  if (direct) return direct;

  const auth = headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }

  return '';
}

export function assertAdminAccess(headers: Headers): { ok: boolean; response: NextResponse | null } {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: 'ADMIN_KEY is not configured' },
        { status: 500 },
      ),
    };
  }

  const actual = getAdminKeyFromRequest(headers);
  if (!actual || actual !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true, response: null };
}
