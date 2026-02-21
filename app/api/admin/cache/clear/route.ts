import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { clearCacheKeys, resetCacheStore } from '../../../../../lib/cache';
import { jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { writeSystemLog } from '../../../../../lib/log';

const KNOWN_KEYS = [
  'admin:metrics:v2',
];

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    await clearCacheKeys(KNOWN_KEYS);
    await resetCacheStore();

    await writeSystemLog({
      eventType: 'CACHE_CLEARED',
      description: 'Admin cache clear executed',
      ipAddress: ip,
    });

    return jsonSuccess({
      storage: 'cache',
      cleared: true,
      keys: KNOWN_KEYS,
    });
  }, {
    rateLimitScope: 'admin_cache_clear',
    rateLimitLimit: 10,
    rateLimitWindowMs: 60_000,
  });
}
