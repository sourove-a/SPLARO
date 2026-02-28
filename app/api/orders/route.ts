import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../lib/apiRoute';
import { getDbPool, nextOrderNumber } from '../../../lib/db';
import { jsonError, jsonSuccess } from '../../../lib/env';
import { fallbackStore, nextFallbackItemId, nextFallbackOrderNo } from '../../../lib/fallbackStore';
import { writeSystemLog } from '../../../lib/log';
import { orderCreatePayloadSchema } from '../../../lib/validators';

function computeTotals(payload: {
  items?: Array<{ quantity?: number; unit_price?: number }>;
  shipping?: number;
  discount?: number;
}) {
  const subtotal = (payload.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    return sum + quantity * unitPrice;
  }, 0);
  const shipping = Number(payload.shipping || 0);
  const discount = Number(payload.discount || 0);
  const total = Math.max(0, subtotal + shipping - discount);
  return { subtotal, shipping, discount, total };
}

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const body = await req.json().catch(() => null);
    const parsed = orderCreatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid order payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const totals = computeTotals(payload);
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const id = randomUUID();
      const orderNo = nextFallbackOrderNo();
      const now = new Date().toISOString();

      mem.orders.unshift({
        id,
        order_no: orderNo,
        user_id: payload.user_id || null,
        name: payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        address: payload.address,
        district: payload.district,
        thana: payload.thana,
        status: payload.status,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        discount: totals.discount,
        total: totals.total,
        created_at: now,
        updated_at: now,
      });

      payload.items.forEach((item) => {
        mem.orderItems.push({
          id: nextFallbackItemId(),
          order_id: id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_url: item.product_url,
          image_url: item.image_url,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
        });
      });

      await writeSystemLog({
        eventType: 'ORDER_CREATED_FALLBACK',
        description: `Order created in fallback: ${orderNo}`,
        ipAddress: ip,
      });

      return jsonSuccess({
        storage: 'fallback',
        order: {
          id,
          order_no: orderNo,
          status: payload.status,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          discount: totals.discount,
          total: totals.total,
        },
      }, 201);
    }

    const orderNo = await nextOrderNumber();
    if (!orderNo) return jsonError('ORDER_NO_FAILED', 'Could not generate order number.', 500);

    const orderId = randomUUID();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `INSERT INTO orders
         (id, order_no, user_id, name, email, phone, address, district, thana, status, subtotal, shipping, discount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          orderNo,
          payload.user_id || null,
          payload.name,
          payload.email.toLowerCase(),
          payload.phone,
          payload.address,
          payload.district,
          payload.thana,
          payload.status,
          totals.subtotal,
          totals.shipping,
          totals.discount,
          totals.total,
        ],
      );

      for (const item of payload.items) {
        await conn.execute(
          `INSERT INTO order_items (order_id, product_id, product_name, product_url, image_url, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product_id || null,
            item.product_name,
            item.product_url || null,
            item.image_url || null,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price,
          ],
        );
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    await writeSystemLog({
      eventType: 'ORDER_CREATED',
      description: `Order created: ${orderNo}`,
      userId: payload.user_id || null,
      ipAddress: ip,
    });

    return jsonSuccess({
      storage: 'mysql',
      order: {
        id: orderId,
        order_no: orderNo,
        status: payload.status,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        discount: totals.discount,
        total: totals.total,
      },
    }, 201);
  }, {
    rateLimitScope: 'orders_create',
    rateLimitLimit: 40,
    rateLimitWindowMs: 60_000,
  });
}

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const email = String(req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
    const phone = String(req.nextUrl.searchParams.get('phone') || '').trim();
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize') || 20)));

    if (!email && !phone) {
      return jsonError('MISSING_FILTER', 'Provide email or phone to list orders.', 400);
    }

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      let rows = mem.orders;
      if (email) rows = rows.filter((row) => row.email.toLowerCase() === email);
      if (phone) rows = rows.filter((row) => row.phone === phone);

      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      return jsonSuccess({
        storage: 'fallback',
        items: rows.slice(offset, offset + pageSize),
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
    }

    const where: string[] = [];
    const params: unknown[] = [];
    if (email) {
      where.push('email = ?');
      params.push(email);
    }
    if (phone) {
      where.push('phone = ?');
      params.push(phone);
    }

    const whereSql = where.length ? `WHERE ${where.join(' OR ')}` : '';

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM orders ${whereSql}`, params);
    const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const safeOffset = (safePage - 1) * pageSize;
    const [rows] = await db.execute(
      `SELECT id, order_no, user_id, name, email, phone, address, district, thana, status, subtotal, shipping, discount, total, created_at, updated_at
       FROM orders ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, safeOffset],
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
