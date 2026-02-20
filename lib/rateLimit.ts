type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

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
