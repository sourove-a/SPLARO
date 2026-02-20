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

export function applyRateLimit(opts: {
  headers: Headers;
  scope: string;
  limit?: number;
  windowMs?: number;
}): { ok: true } | { ok: false; remaining: number; resetAt: number } {
  const ip = getClientIp(opts.headers);
  const limit = Number(process.env.RATE_LIMIT_MAX || opts.limit || 120);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || opts.windowMs || 60_000);
  const rate = checkRateLimit({
    key: `${opts.scope}:${ip}`,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 120,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
  });

  if (!rate.allowed) {
    return { ok: false, remaining: rate.remaining, resetAt: rate.resetAt };
  }

  return { ok: true };
}
