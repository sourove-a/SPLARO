import { NextResponse } from 'next/server';
import { getDbPool, getStorageInfo } from '../../../lib/db';
import { getQueueStats } from '../../../lib/queue';

function line(metric: string, value: number | string, labels: Record<string, string> = {}): string {
  const entries = Object.entries(labels);
  if (!entries.length) return `${metric} ${value}`;
  const labelPart = entries
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join(',');
  return `${metric}{${labelPart}} ${value}`;
}

export async function GET() {
  const started = Date.now();
  const db = await getDbPool();
  const storage = await getStorageInfo();
  const queue = await getQueueStats().catch(() => null);

  const metrics: string[] = [
    '# HELP splaro_up Splaro service availability.',
    '# TYPE splaro_up gauge',
    line('splaro_up', 1),
    '# HELP splaro_storage_mode Current storage mode (1=mysql, 0=fallback).',
    '# TYPE splaro_storage_mode gauge',
    line('splaro_storage_mode', storage.storage === 'mysql' ? 1 : 0),
    '# HELP splaro_api_latency_ms Health endpoint generation latency in ms.',
    '# TYPE splaro_api_latency_ms gauge',
    line('splaro_api_latency_ms', Date.now() - started),
  ];

  if (db) {
    const [rows] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users_count,
        (SELECT COUNT(*) FROM products WHERE active = 1) AS products_count,
        (SELECT COUNT(*) FROM orders) AS orders_count,
        (SELECT COUNT(*) FROM subscriptions) AS subscriptions_count`,
    );
    const row = Array.isArray(rows) && rows[0] ? (rows[0] as any) : {};
    metrics.push(
      '# TYPE splaro_users_total gauge',
      line('splaro_users_total', Number(row.users_count || 0)),
      '# TYPE splaro_products_total gauge',
      line('splaro_products_total', Number(row.products_count || 0)),
      '# TYPE splaro_orders_total gauge',
      line('splaro_orders_total', Number(row.orders_count || 0)),
      '# TYPE splaro_subscriptions_total gauge',
      line('splaro_subscriptions_total', Number(row.subscriptions_count || 0)),
    );
  }

  if (queue) {
    metrics.push('# TYPE splaro_queue_jobs gauge');
    for (const [status, total] of Object.entries(queue.totals)) {
      metrics.push(line('splaro_queue_jobs', Number(total || 0), { status }));
    }
  }

  return new NextResponse(`${metrics.join('\n')}\n`, {
    status: 200,
    headers: {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
