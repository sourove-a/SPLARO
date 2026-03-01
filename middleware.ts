import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://cdn.tailwindcss.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "frame-src 'self' https://accounts.google.com",
  "upgrade-insecure-requests",
].join('; ');

function parseAllowedOrigins(): Set<string> {
  const raw = String(process.env.CORS_ALLOWED_ORIGINS || process.env.APP_ORIGIN || '').trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function securityHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('permissions-policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  response.headers.set('x-dns-prefetch-control', 'off');
  response.headers.set('cross-origin-opener-policy', 'same-origin');
  response.headers.set('cross-origin-resource-policy', 'same-origin');
  response.headers.set('content-security-policy', process.env.CONTENT_SECURITY_POLICY || DEFAULT_CSP);
  response.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  return response;
}

function applyCorsIfApi(request: NextRequest, response: NextResponse): NextResponse {
  if (!request.nextUrl.pathname.startsWith('/api/')) return response;

  const origin = String(request.headers.get('origin') || '').trim();
  const allowlist = parseAllowedOrigins();
  if (origin && allowlist.has(origin)) {
    response.headers.set('access-control-allow-origin', origin);
    response.headers.set('vary', 'origin');
    response.headers.set('access-control-allow-credentials', 'true');
    response.headers.set('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    response.headers.set('access-control-allow-headers', 'Content-Type, Authorization, X-Admin-Key, X-CSRF-Token, X-Request-Id');
  }
  return response;
}

function hasSuspiciousPattern(value: unknown): boolean {
  const normalized = String(value || '');
  if (!normalized) return false;
  return /(union\s+select|sleep\(|benchmark\(|<script|javascript:|onerror=|onload=|\.\.\/|%00|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set)/i.test(normalized);
}

export function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  if (request.method === 'OPTIONS' && request.nextUrl.pathname.startsWith('/api/')) {
    const preflight = new NextResponse(null, { status: 204 });
    return securityHeaders(applyCorsIfApi(request, preflight), requestId);
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const suspicious = hasSuspiciousPattern(request.nextUrl.search)
      || hasSuspiciousPattern(request.nextUrl.pathname)
      || hasSuspiciousPattern(request.headers.get('user-agent') || '');
    if (suspicious) {
      const blocked = NextResponse.json(
        { success: false, error: { code: 'BLOCKED_REQUEST', message: 'Request blocked by security policy.' } },
        { status: 403 },
      );
      return securityHeaders(applyCorsIfApi(request, blocked), requestId);
    }
  }

  if (!request.nextUrl.pathname.startsWith('/api/admin/')) {
    const response = NextResponse.next();
    return securityHeaders(applyCorsIfApi(request, response), requestId);
  }

  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    const response = NextResponse.json(
      { success: false, message: 'ADMIN_KEY is not configured' },
      { status: 500 },
    );
    return securityHeaders(applyCorsIfApi(request, response), requestId);
  }

  const direct = request.headers.get('x-admin-key');
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const supplied = direct || bearer;

  if (!supplied || supplied !== expected) {
    const response = NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    return securityHeaders(applyCorsIfApi(request, response), requestId);
  }

  const response = NextResponse.next();
  return securityHeaders(applyCorsIfApi(request, response), requestId);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|site.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map)$).*)',
  ],
};
