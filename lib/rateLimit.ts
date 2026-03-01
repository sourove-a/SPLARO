import { getCacheStore } from './cache';

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();
const bucketCleanupLastRun = { at: 0 };

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return headers.get('x-real-ip') || 'unknown';
}

export function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; resetAt: number } {
  if (Date.now() - bucketCleanupLastRun.at > 60_000) {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.windowStart > 10 * 60_000) {
        buckets.delete(key);
      }
    }
    bucketCleanupLastRun.at = now;
  }

  const now = Date.now();
  const bucket = buckets.get(opts.key);

  if (!bucket || now - bucket.windowStart >= opts.windowMs) {
    buckets.set(opts.key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: Math.max(0, opts.limit - 1),
      resetAt: now + opts.windowMs,
    };
  }

  bucket.count += 1;
  buckets.set(opts.key, bucket);

  const allowed = bucket.count <= opts.limit;
  return {
    allowed,
    remaining: Math.max(0, opts.limit - bucket.count),
    resetAt: bucket.windowStart + opts.windowMs,
  };
}

function resolveRuntimeLimits(opts: {
  limit?: number;
  authenticated: boolean;
}): number {
  const raw = opts.authenticated
    ? Number(process.env.AUTH_RATE_LIMIT_MAX || 200)
    : Number(process.env.RATE_LIMIT_MAX || opts.limit || 80);
  if (!Number.isFinite(raw) || raw <= 0) {
    return opts.authenticated ? 200 : 80;
  }
  return Math.floor(raw);
}

function resolveRuntimeWindowMs(opts?: { windowMs?: number }): number {
  const raw = Number(process.env.RATE_LIMIT_WINDOW_MS || opts?.windowMs || 60_000);
  if (!Number.isFinite(raw) || raw <= 0) return 60_000;
  return Math.floor(raw);
}

async function applyDistributedRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const cache = await getCacheStore();
  const ttlSeconds = Math.max(1, Math.ceil(opts.windowMs / 1000));
  const key = `rl:${opts.key}`;

  const count = await cache.incr(key, ttlSeconds);
  const allowed = count <= opts.limit;
  return {
    allowed,
    remaining: Math.max(0, opts.limit - count),
    resetAt: Date.now() + opts.windowMs,
  };
}

export async function applyRateLimit(opts: {
  headers: Headers;
  scope: string;
  userKey?: string | null;
  limit?: number;
  windowMs?: number;
}): Promise<{ ok: true } | { ok: false; remaining: number; resetAt: number }> {
  const ip = getClientIp(opts.headers);
  const explicitUserKey = String(opts.userKey || '').trim();
  const headerUserKey = String(
    opts.headers.get('x-auth-user-id')
    || opts.headers.get('x-user-id')
    || opts.headers.get('x-auth-email')
    || '',
  ).trim();
  const bearer = String(opts.headers.get('authorization') || '').trim();
  const hasAuth = explicitUserKey !== '' || headerUserKey !== '' || bearer.startsWith('Bearer ');
  const scopeKey = explicitUserKey || headerUserKey || ip;
  const limit = resolveRuntimeLimits({
    limit: opts.limit,
    authenticated: hasAuth,
  });
  const windowMs = resolveRuntimeWindowMs({ windowMs: opts.windowMs });
  const key = `${opts.scope}:${scopeKey}`;

  let rate: { allowed: boolean; remaining: number; resetAt: number };
  try {
    rate = await applyDistributedRateLimit({
      key,
      limit,
      windowMs,
    });
  } catch {
    rate = checkRateLimit({
      key,
      limit,
      windowMs,
    });
  }

  if (!rate.allowed) {
    return { ok: false, remaining: rate.remaining, resetAt: rate.resetAt };
  }

  return { ok: true };
}
