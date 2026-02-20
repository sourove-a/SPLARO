import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from './rateLimit';
import { jsonError, requestIp } from './env';
import { trackRequestTiming } from './log';

export type RouteContext = {
  request: NextRequest;
  ip: string;
};

export async function withApiHandler(
  request: NextRequest,
  handler: (ctx: RouteContext) => Promise<NextResponse>,
  options?: {
    rateLimitScope?: string;
    rateLimitLimit?: number;
    rateLimitWindowMs?: number;
  },
): Promise<NextResponse> {
  const started = Date.now();
  const ip = requestIp(request.headers);
  let status = 200;

  try {
    if (options?.rateLimitScope) {
      const rate = applyRateLimit({
        headers: request.headers,
        scope: options.rateLimitScope,
        limit: options.rateLimitLimit,
        windowMs: options.rateLimitWindowMs,
      });
      if (!rate.ok) {
        const response = jsonError('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
        response.headers.set('x-ratelimit-remaining', String(rate.remaining));
        response.headers.set('x-ratelimit-reset', String(rate.resetAt));
        status = response.status;
        return response;
      }
    }

    const response = await handler({ request, ip });
    status = response.status;
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const response = jsonError('INTERNAL_ERROR', process.env.NODE_ENV === 'production' ? 'Something went wrong.' : message, 500);
    status = response.status;
    return response;
  } finally {
    const durationMs = Date.now() - started;
    await trackRequestTiming({
      path: request.nextUrl.pathname,
      method: request.method,
      durationMs,
      status,
      ipAddress: ip,
    });
  }
}
