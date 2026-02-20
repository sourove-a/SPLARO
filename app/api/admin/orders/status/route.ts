import { NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/auditLog';
import { assertAdminAccess } from '@/lib/adminAuth';
import { invalidateOrderCaches } from '@/lib/adminService';
import { buildRequestContext, extractRequestId, logError } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { updateOrderStatusInSheet } from '@/lib/sheets';
import { getSnapshot, updateOrderStatusInSnapshot } from '@/lib/snapshotStore';
import { orderStatusPatchSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  const requestId = extractRequestId(request.headers);
  const ctx = buildRequestContext('/api/admin/orders/status', requestId);

  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) {
    ctx.finish({ cache_hit: false, snapshot_age_seconds: null });
    return auth.response ?? NextResponse.json({ success: false, requestId, message: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `admin_order_status:${ip}`,
    limit: 30,
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
    const json = await request.json();
    const parsed = orderStatusPatchSchema.safeParse(json);

    if (!parsed.success) {
      ctx.finish({ cache_hit: false, snapshot_age_seconds: null });
      return NextResponse.json(
        {
          success: false,
          requestId,
          message: 'Invalid payload',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { orderId, status, actor } = parsed.data;

    const snapshotBefore = await getSnapshot();
    const beforeIndex = snapshotBefore.indexes.ordersById[orderId];
    const before = beforeIndex !== undefined ? snapshotBefore.rows.orders[beforeIndex] : null;

    const updatedInSheet = await updateOrderStatusInSheet(orderId, status);
    if (!updatedInSheet) {
      ctx.finish({ cache_hit: false, snapshot_age_seconds: null });
      return NextResponse.json(
        {
          success: false,
          requestId,
          message: 'Order not found in Google Sheets',
        },
        { status: 404 },
      );
    }

    await updateOrderStatusInSnapshot(orderId, status);
    await invalidateOrderCaches();

    await appendAuditLog({
      action: 'order.status.patch',
      actor: actor || 'admin_api',
      requestId,
      ip,
      targetId: orderId,
      before,
      after: { status },
    });

    ctx.finish({ cache_hit: false, snapshot_age_seconds: 0 });

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Order status updated',
      data: {
        orderId,
        status,
      },
    });
  } catch (error) {
    logError('admin_order_status_failed', {
      requestId,
      endpoint: '/api/admin/orders/status',
      error: error instanceof Error ? error.message : String(error),
    });

    ctx.finish({ cache_hit: false, snapshot_age_seconds: null });

    return NextResponse.json(
      {
        success: false,
        requestId,
        message: 'Failed to update order status',
      },
      { status: 500 },
    );
  }
}
