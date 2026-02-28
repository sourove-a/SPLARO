import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { toCsv } from '../../../../lib/csv';

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const type = String(req.nextUrl.searchParams.get('type') || 'sales').trim().toLowerCase();
    const format = String(req.nextUrl.searchParams.get('format') || '').trim().toLowerCase();
    if (!['sales', 'users', 'products'].includes(type)) {
      return jsonError('INVALID_REPORT_TYPE', 'type must be sales|users|products', 400);
    }

    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      let rows: any[] = [];

      if (type === 'sales') {
        rows = mem.orders.map((o) => ({
          order_no: o.order_no,
          name: o.name,
          email: o.email,
          district: o.district,
          status: o.status,
          total: o.total,
          created_at: o.created_at,
        }));
      }

      if (type === 'users') {
        rows = mem.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          is_blocked: u.is_blocked ? 1 : 0,
          created_at: u.created_at,
        }));
      }

      if (type === 'products') {
        rows = mem.products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          category_id: p.category_id,
          product_type: p.product_type,
          price: p.price,
          stock_quantity: p.stock_quantity || 0,
          active: p.active ? 1 : 0,
          created_at: p.created_at,
        }));
      }

      if (format === 'csv') {
        const csv = toCsv(rows);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="splaro-${type}-report.csv"`,
          },
        });
      }

      const analytics =
        type === 'sales'
          ? {
              total_revenue: rows.reduce((sum, row) => sum + Number((row as any).total || 0), 0),
              orders: rows.length,
            }
          : type === 'users'
            ? { total_users: rows.length }
            : {
                active_products: rows.filter((row) => Number((row as any).active || 0) === 1).length,
                low_stock: rows.filter((row) => Number((row as any).stock_quantity || 0) <= 5).length,
              };

      return jsonSuccess({ storage: 'fallback', type, rows, analytics });
    }

    let rows: any[] = [];

    if (type === 'sales') {
      const [result] = await db.query(`
        SELECT order_no, name, email, district, status, total, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 5000
      `);
      rows = Array.isArray(result) ? result : [];
    }

    if (type === 'users') {
      const [result] = await db.query(`
        SELECT id, name, email, phone, role, is_blocked, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 5000
      `);
      rows = Array.isArray(result) ? result : [];
    }

    if (type === 'products') {
      const [result] = await db.query(`
        SELECT id, name, slug, category_id, product_type, price, stock_quantity, active, created_at
        FROM products
        ORDER BY created_at DESC
        LIMIT 5000
      `);
      rows = Array.isArray(result) ? result : [];
    }

    if (format === 'csv') {
      const csv = toCsv(rows as any[]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="splaro-${type}-report.csv"`,
        },
      });
    }

    let analytics: Record<string, unknown> = {};
    if (type === 'sales') {
      const [districtRows] = await db.query(`
        SELECT district, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
        FROM orders
        GROUP BY district
        ORDER BY revenue DESC
        LIMIT 50
      `);
      const [conversionRows] = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM orders) AS orders_count,
          (SELECT COUNT(*) FROM users) AS users_count
      `);
      const conv = Array.isArray(conversionRows) && conversionRows[0] ? (conversionRows[0] as any) : { orders_count: 0, users_count: 0 };
      const usersCount = Number(conv.users_count || 0);
      const ordersCount = Number(conv.orders_count || 0);
      analytics = {
        total_revenue: rows.reduce((sum, row) => sum + Number((row as any).total || 0), 0),
        orders: rows.length,
        revenue_by_district: Array.isArray(districtRows) ? districtRows : [],
        conversion_rate: usersCount > 0 ? Number(((ordersCount / usersCount) * 100).toFixed(2)) : 0,
      };
    } else if (type === 'users') {
      const [growthRows] = await db.query(`
        SELECT DATE(created_at) AS date, COUNT(*) AS users
        FROM users
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `);
      analytics = {
        total_users: rows.length,
        growth_30d: Array.isArray(growthRows) ? growthRows : [],
      };
    } else {
      const [performanceRows] = await db.query(`
        SELECT p.id, p.name, p.slug, p.stock_quantity, p.price,
               COALESCE(SUM(oi.quantity),0) AS sold_units,
               COALESCE(SUM(oi.line_total),0) AS revenue
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        GROUP BY p.id, p.name, p.slug, p.stock_quantity, p.price
        ORDER BY sold_units DESC
        LIMIT 100
      `);
      analytics = {
        active_products: rows.filter((row) => Number((row as any).active || 0) === 1).length,
        low_stock: rows.filter((row) => Number((row as any).stock_quantity || 0) <= 5).length,
        product_performance: Array.isArray(performanceRows) ? performanceRows : [],
      };
    }

    return jsonSuccess({ storage: 'mysql', type, rows, analytics });
  });
}
