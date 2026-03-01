import { NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdmin } from '@/lib/env';
import { fallbackStore } from '@/lib/fallbackStore';

export const dynamic = 'force-dynamic';

async function snapshot() {
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    return {
      ts: new Date().toISOString(),
      storage: 'fallback',
      summary: {
        orders: mem.orders.length,
        products: mem.products.length,
        revenue: mem.orders.reduce((sum, row) => sum + Number(row.total || 0), 0),
      },
    };
  }

  const [rows] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM products WHERE active = 1) AS products,
      (SELECT COALESCE(SUM(total), 0) FROM orders) AS revenue
  `);
  const row = Array.isArray(rows) && rows[0] ? (rows[0] as any) : { orders: 0, products: 0, revenue: 0 };

  return {
    ts: new Date().toISOString(),
    storage: 'mysql',
    summary: {
      orders: Number(row.orders || 0),
      products: Number(row.products || 0),
      revenue: Number(row.revenue || 0),
    },
  };
}

export async function GET(request: NextRequest) {
  const admin = requireAdmin(request.headers);
  if (admin.ok === false) return admin.response;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const data = await snapshot();
        controller.enqueue(encoder.encode(`event: metrics\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      await send();
      const timer = setInterval(() => {
        send().catch(() => {
          clearInterval(timer);
          controller.close();
        });
      }, 15000);

      // Keep alive comment for proxies.
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 8000);

      request.signal.addEventListener('abort', () => {
        clearInterval(timer);
        clearInterval(keepAlive);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
