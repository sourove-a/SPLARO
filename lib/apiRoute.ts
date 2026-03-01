import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from './rateLimit';
import { jsonError, requestIp } from './env';
import { trackRequestTiming } from './log';
import { AppError, getRequestId, logUnhandledError, safePublicErrorMessage, toAppError, withOperationTimeout } from './error-handler';

export type RouteContext = {
  request: NextRequest;
  ip: string;
  requestId: string;
};

export async function withApiHandler(
  request: NextRequest,
  handler: (ctx: RouteContext) => Promise<NextResponse>,
  options?: {
    rateLimitScope?: string;
    rateLimitLimit?: number;
    rateLimitWindowMs?: number;
    requestTimeoutMs?: number;
  },
): Promise<NextResponse> {
  const started = Date.now();
  const ip = requestIp(request.headers);
  const requestId = getRequestId(request.headers);
  let status = 200;
  let cacheHit: boolean | null = null;

  try {
    if (options?.rateLimitScope) {
      const rate = await applyRateLimit({
        headers: request.headers,
        scope: options.rateLimitScope,
        limit: options.rateLimitLimit,
        windowMs: options.rateLimitWindowMs,
      });
      if (rate.ok === false) {
        const response = jsonError('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
        response.headers.set('x-ratelimit-remaining', String(rate.remaining));
        response.headers.set('x-ratelimit-reset', String(rate.resetAt));
        response.headers.set('x-request-id', requestId);
        status = response.status;
        return response;
      }
    }

    const configuredTimeoutMs = options?.requestTimeoutMs
      ?? (Number(process.env.API_MAX_EXECUTION_SECONDS || 25) * 1000);

    const response = await withOperationTimeout(
      () => handler({ request, ip, requestId }),
      configuredTimeoutMs,
      'REQUEST_TIMEOUT',
      'Request timed out.',
    );
    cacheHit = response.headers.get('x-cache-hit') === '1';
    response.headers.set('x-request-id', requestId);
    response.headers.set('x-content-type-options', 'nosniff');
    status = response.status;
    return response;
  } catch (error) {
    const appError = toAppError(error);
    await logUnhandledError(
      {
        requestId,
        ip,
        method: request.method,
        path: request.nextUrl.pathname,
      },
      error,
    );

    const response = jsonError(
      appError.code || 'INTERNAL_ERROR',
      process.env.NODE_ENV === 'production' ? safePublicErrorMessage(appError) : appError.message,
      appError.status || 500,
      process.env.NODE_ENV === 'production'
        ? { requestId }
        : {
          requestId,
          retryable: appError.retryable,
          details: appError instanceof AppError ? appError.details || null : null,
        },
    );
    response.headers.set('x-request-id', requestId);
    response.headers.set('cache-control', 'no-store');
    status = response.status;
    return response;
  } finally {
    const durationMs = Date.now() - started;
    await trackRequestTiming({
      path: request.nextUrl.pathname,
      method: request.method,
      durationMs,
      status,
      requestId,
      cacheHit,
      ipAddress: ip,
    });
  }
}
