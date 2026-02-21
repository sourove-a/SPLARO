import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../../lib/env';
import { fallbackStore } from '../../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../../lib/log';
import { campaignSendSchema } from '../../../../../../lib/validators';

function sampleDeliveryLogs(targetCount: number, mode: 'test' | 'now') {
  const count = Math.min(targetCount || 20, 20);
  return Array.from({ length: count }, (_, idx) => ({
    recipient: `user${idx + 1}@example.com`,
    status: 'SENT',
    mode,
    delivered_at: new Date().toISOString(),
  }));
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const id = String(context.params.id || '').trim();
    if (!id) return jsonError('INVALID_ID', 'Invalid campaign id.', 400);

    const body = await req.json().catch(() => ({}));
    const parsed = campaignSendSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid send payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const campaign = mem.campaigns.find((item) => item.id === id && !item.deleted_at);
      if (!campaign) return jsonError('NOT_FOUND', 'Campaign not found.', 404);

      const targetCount = Number(campaign.target_count || 0);
      const logs = sampleDeliveryLogs(targetCount, payload.mode);
      campaign.status = payload.mode === 'now' ? 'Active' : campaign.status;
      campaign.updated_at = new Date().toISOString();

      await writeSystemLog({
        eventType: payload.mode === 'test' ? 'CAMPAIGN_TEST_SENT_FALLBACK' : 'CAMPAIGN_SENT_FALLBACK',
        description: `Campaign ${id} send mode=${payload.mode} targets=${targetCount}`,
        userId: payload.actor_id || null,
        ipAddress: ip,
      });

      return jsonSuccess({
        storage: 'fallback',
        campaign,
        job: {
          id: `job_${Date.now()}`,
          status: 'SENT',
          mode: payload.mode,
          target_count: targetCount,
          sent_count: logs.length,
        },
        logs,
      });
    }

    const [campaignRows] = await db.execute('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
    const campaign = Array.isArray(campaignRows) && campaignRows[0] ? (campaignRows[0] as any) : null;
    if (!campaign) return jsonError('NOT_FOUND', 'Campaign not found.', 404);

    const segment = String(campaign.audience_segment || 'ALL_USERS');
    let recipients: any[] = [];

    if (segment === 'ALL_USERS') {
      const [rows] = await db.execute('SELECT id, email, name FROM users WHERE is_blocked = 0 ORDER BY created_at DESC LIMIT 1000');
      recipients = Array.isArray(rows) ? rows as any[] : [];
    } else if (segment === 'NEW_SIGNUPS_7D') {
      const [rows] = await db.execute(
        'SELECT id, email, name FROM users WHERE is_blocked = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY created_at DESC LIMIT 1000',
      );
      recipients = Array.isArray(rows) ? rows as any[] : [];
    } else {
      const [rows] = await db.execute(
        `SELECT u.id, u.email, u.name
         FROM users u
         LEFT JOIN (
           SELECT email, MAX(created_at) AS last_order_at
           FROM orders
           GROUP BY email
         ) o ON o.email = u.email
         WHERE u.is_blocked = 0 AND (o.last_order_at IS NULL OR o.last_order_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
         ORDER BY u.created_at DESC
         LIMIT 1000`,
      );
      recipients = Array.isArray(rows) ? rows as any[] : [];
    }

    const targetCount = recipients.length;
    const deliveryLogs = recipients.slice(0, 20).map((recipient) => ({
      recipient: recipient.email,
      status: 'SENT',
      mode: payload.mode,
      delivered_at: new Date().toISOString(),
    }));

    if (payload.mode === 'now') {
      await db.execute(
        'UPDATE campaigns SET status = ?, target_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['Active', targetCount, id],
      );
    } else {
      await db.execute('UPDATE campaigns SET target_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targetCount, id]);
    }

    await writeAuditLog({
      actorId: payload.actor_id || null,
      action: payload.mode === 'test' ? 'CAMPAIGN_SEND_TEST' : 'CAMPAIGN_SEND_NOW',
      entityType: 'campaign',
      entityId: id,
      after: { mode: payload.mode, targetCount, sentCount: deliveryLogs.length },
      ipAddress: ip,
    });

    await writeSystemLog({
      eventType: payload.mode === 'test' ? 'CAMPAIGN_TEST_SENT' : 'CAMPAIGN_SENT',
      description: `Campaign ${id} send mode=${payload.mode} targets=${targetCount}`,
      userId: payload.actor_id || null,
      ipAddress: ip,
    });

    const [updatedRows] = await db.execute('SELECT * FROM campaigns WHERE id = ? LIMIT 1', [id]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? (updatedRows[0] as any) : campaign;

    return jsonSuccess({
      storage: 'mysql',
      campaign: updated,
      job: {
        id: `job_${Date.now()}`,
        status: 'SENT',
        mode: payload.mode,
        target_count: targetCount,
        sent_count: deliveryLogs.length,
      },
      logs: deliveryLogs,
    });
  }, {
    rateLimitScope: 'admin_campaign_send',
    rateLimitLimit: 20,
    rateLimitWindowMs: 60_000,
  });
}
