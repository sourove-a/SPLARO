import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../lib/env';
import { processMysqlQueue } from '../../../../lib/queue';
import { processIntegrationPayload } from '../../../../lib/integrationDispatch';

function canRunCron(request: NextRequest): boolean {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const supplied = String(request.headers.get('x-cron-token') || '').trim();
  if (cronSecret && supplied && cronSecret === supplied) return true;
  const admin = requireAdmin(request.headers);
  return admin.ok === true;
}

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    if (!canRunCron(req)) {
      return jsonError('UNAUTHORIZED', 'Cron token or admin key required.', 401);
    }

    const payload = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(200, Number((payload as any).limit || process.env.QUEUE_BATCH_LIMIT || 25)));

    const result = await processMysqlQueue(
      {
        ORDER_EVENT: async (jobPayload) => {
          const eventType = String((jobPayload as any)?.eventType || 'ORDER_CREATED') as any;
          const payload = ((jobPayload as any)?.payload || {}) as any;
          await processIntegrationPayload(eventType, payload);
        },
        TELEGRAM: async (jobPayload) => {
          const eventType = String((jobPayload as any)?.eventType || 'USER_SIGNUP') as any;
          const payload = ((jobPayload as any)?.payload || {}) as any;
          await processIntegrationPayload(eventType, payload);
        },
        SHEETS: async (jobPayload) => {
          const eventType = String((jobPayload as any)?.eventType || 'SUBSCRIBED') as any;
          const payload = ((jobPayload as any)?.payload || {}) as any;
          await processIntegrationPayload(eventType, payload);
        },
      },
      limit,
    );

    return jsonSuccess({
      processed: result.processed,
      failed: result.failed,
      dead: result.dead,
      limit,
    });
  }, {
    rateLimitScope: 'cron_queue_process',
    rateLimitLimit: 30,
    rateLimitWindowMs: 60_000,
    requestTimeoutMs: 30_000,
  });
}
