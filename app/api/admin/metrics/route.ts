import { NextResponse } from 'next/server';
import { assertAdminAccess } from '@/lib/adminAuth';
import { getAdminMetrics } from '@/lib/adminService';
import { buildRequestContext, extractRequestId, logError } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = extractRequestId(request.headers);
  const ctx = buildRequestContext('/api/admin/metrics', requestId);

  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) {
    ctx.finish({ cache_hit: false, snapshot_age_seconds: null });
    return auth.response ?? NextResponse.json({ success: false, requestId, message: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `admin_metrics:${ip}`,
    limit: 180,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    ctx.finish({ cache_hit: false, snapshot_age_seconds: null });
    return NextResponse.json(
      {
        success: false,
        requestId,
        message: 'Rate limit exceeded',
      },
      { status: 429 },
    );
  }

  try {
    const result = await getAdminMetrics();

    ctx.finish({
      cache_hit: result.cacheHit,
      snapshot_age_seconds: result.snapshotAgeSeconds,
    });

    return NextResponse.json({
      success: true,
      requestId,
      endpoint: '/api/admin/metrics',
      data: {
        counts: result.counts,
        recentOrders: result.recentOrders,
      },
      meta: {
        cacheHit: result.cacheHit,
        snapshotAgeSeconds: result.snapshotAgeSeconds,
        lastSyncTime: result.lastSyncTime,
      },
    });
  } catch (error) {
    logError('admin_metrics_failed', {
      requestId,
      endpoint: '/api/admin/metrics',
      error: error instanceof Error ? error.message : String(error),
    });

    ctx.finish({ cache_hit: false, snapshot_age_seconds: null });

    return NextResponse.json(
      {
        success: false,
        requestId,
        message: 'Failed to load metrics',
      },
      { status: 500 },
    );
  }
}
