import type { NextResponse } from 'next/server';

export function setPublicCacheHeaders(
  response: NextResponse,
  options: {
    sMaxAge: number;
    staleWhileRevalidate?: number;
    maxAge?: number;
  },
): NextResponse {
  const sMaxAge = Math.max(0, Math.floor(options.sMaxAge));
  const stale = Math.max(0, Math.floor(options.staleWhileRevalidate ?? sMaxAge));
  const maxAge = Math.max(0, Math.floor(options.maxAge ?? 0));
  response.headers.set(
    'Cache-Control',
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${stale}`,
  );
  return response;
}

export function setNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}
