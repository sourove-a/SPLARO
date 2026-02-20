import { NextResponse } from 'next/server';
import { assertAdminAccess } from '@/lib/adminAuth';
import { getOrdersList } from '@/lib/adminService';
import { buildRequestContext, extractRequestId, logError } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { adminListQuerySchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = extractRequestId(request.headers);
  const ctx = buildRequestContext('/api/admin/orders', requestId);

  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) {
    ctx.finish({ cache_hit: false, snapshot_age_seconds: null });
    return auth.response ?? NextResponse.json({ success: false, requestId, message: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `admin_orders:${ip}`,
    limit: 90,
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
    const url = new URL(request.url);
    const parsed = adminListQuerySchema.safeParse({
      page: url.searchParams.get('page') ?? '1',
      pageSize: url.searchParams.get('pageSize') ?? '20',
      q: url.searchParams.get('q') ?? '',
      status: url.searchParams.get('status') ?? '',
    });

    if (!parsed.success) {
      ctx.finish({ cache_hit: false, snapshot_age_seconds: null });
      return NextResponse.json(
        {
          success: false,
          requestId,
          message: 'Invalid query params',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await getOrdersList(parsed.data);

    ctx.finish({
      cache_hit: result.cacheHit,
      snapshot_age_seconds: result.snapshotAgeSeconds,
    });

    return NextResponse.json({
      success: true,
      requestId,
      endpoint: '/api/admin/orders',
      data: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      meta: {
        cacheHit: result.cacheHit,
        snapshotAgeSeconds: result.snapshotAgeSeconds,
        lastSyncTime: result.lastSyncTime,
      },
    });
  } catch (error) {
    logError('admin_orders_failed', {
      requestId,
      endpoint: '/api/admin/orders',
      error: error instanceof Error ? error.message : String(error),
    });

    ctx.finish({ cache_hit: false, snapshot_age_seconds: null });

    return NextResponse.json(
      {
        success: false,
        requestId,
        message: 'Failed to load orders',
      },
      { status: 500 },
    );
  }
}
