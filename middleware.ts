import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return NextResponse.json(
      { success: false, message: 'ADMIN_KEY is not configured' },
      { status: 500 },
    );
  }

  const direct = request.headers.get('x-admin-key');
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const supplied = direct || bearer;

  if (!supplied || supplied !== expected) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
