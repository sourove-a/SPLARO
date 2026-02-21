import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess, parsePagination, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../lib/log';
import { campaignCreateSchema } from '../../../../lib/validators';

async function computeTargetCount(db: any, segment: 'ALL_USERS' | 'NEW_SIGNUPS_7D' | 'INACTIVE_30D'): Promise<number> {
  if (!db) return 0;
  if (segment === 'ALL_USERS') {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM users WHERE is_blocked = 0');
    return Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
  }
  if (segment === 'NEW_SIGNUPS_7D') {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM users WHERE is_blocked = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    return Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
  }
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM users u
     LEFT JOIN (
       SELECT email, MAX(created_at) AS last_order_at
       FROM orders
       GROUP BY email
     ) o ON o.email = u.email
     WHERE u.is_blocked = 0 AND (o.last_order_at IS NULL OR o.last_order_at < DATE_SUB(NOW(), INTERVAL 30 DAY))`,
  );
  return Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
}

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const { page, pageSize } = parsePagination(req.nextUrl.searchParams);
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const status = String(req.nextUrl.searchParams.get('status') || '').trim();

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      let rows = mem.campaigns.filter((item) => !item.deleted_at);
      if (status) rows = rows.filter((item) => item.status === status);
      if (q) {
        const term = q.toLowerCase();
        rows = rows.filter((item) => item.name.toLowerCase().includes(term) || String(item.content || '').toLowerCase().includes(term));
      }

      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;
      return jsonSuccess({ storage: 'fallback', items: rows.slice(offset, offset + pageSize), total, page: safePage, pageSize, totalPages });
    }

    const where: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (q) {
      where.push('(name LIKE ? OR content LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM campaigns ${whereSql}`, params);
    const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const [rows] = await db.execute(
      `SELECT id, name, status, audience_segment, target_count, pulse_percent, schedule_time, content, created_at, updated_at
       FROM campaigns
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    return jsonSuccess({
      storage: 'mysql',
      items: Array.isArray(rows) ? rows : [],
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (!admin.ok) return admin.response;

    const body = await req.json().catch(() => null);
    const normalizedBody = body && typeof body === 'object'
      ? {
          ...body,
          audience_segment: (body as any).audience_segment || (body as any).audienceSegment || (body as any).segment?.type,
          target_count: (body as any).target_count ?? (body as any).targetCount,
          pulse_percent: (body as any).pulse_percent ?? (body as any).pulsePercent,
          schedule_time: (body as any).schedule_time || (body as any).scheduleTime,
          content: (body as any).content || (body as any).description || '',
        }
      : body;
    const parsed = campaignCreateSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid campaign payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const db = await getDbPool();
    const computedTarget = db ? await computeTargetCount(db, payload.audience_segment) : payload.target_count;

    if (!db) {
      const mem = fallbackStore();
      const now = new Date().toISOString();
      const item = {
        id: randomUUID(),
        name: payload.name,
        status: payload.status,
        audience_segment: payload.audience_segment,
        target_count: computedTarget,
        pulse_percent: payload.pulse_percent,
        schedule_time: payload.schedule_time || now,
        content: payload.content || '',
        created_at: now,
        updated_at: now,
      } as any;
      mem.campaigns.unshift(item);

      await writeSystemLog({ eventType: 'CAMPAIGN_CREATED_FALLBACK', description: `Campaign created: ${item.id}`, ipAddress: ip });
      return jsonSuccess({ storage: 'fallback', item }, 201);
    }

    const id = randomUUID();
    await db.execute(
      `INSERT INTO campaigns
       (id, name, status, audience_segment, target_count, pulse_percent, schedule_time, content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        payload.name,
        payload.status,
        payload.audience_segment,
        computedTarget,
        payload.pulse_percent,
        payload.schedule_time || null,
        payload.content || null,
      ],
    );

    const [rows] = await db.execute('SELECT * FROM campaigns WHERE id = ? LIMIT 1', [id]);
    const item = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;

    await writeAuditLog({ action: 'CAMPAIGN_CREATED', entityType: 'campaign', entityId: id, after: item, ipAddress: ip });
    await writeSystemLog({ eventType: 'CAMPAIGN_CREATED', description: `Campaign created: ${id}`, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', item }, 201);
  }, {
    rateLimitScope: 'admin_campaigns_write',
    rateLimitLimit: 40,
    rateLimitWindowMs: 60_000,
  });
}
