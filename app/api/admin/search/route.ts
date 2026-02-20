import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAccess } from '../../../../lib/adminAuth';
import { listCampaigns } from '../../../../lib/adminPersistence';
import { getDbPool } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const q = String(request.nextUrl.searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ success: true, q: '', results: { users: [], orders: [], campaigns: [] } });
  }

  const pool = await getDbPool();
  const term = `%${q}%`;

  let users: any[] = [];
  let orders: any[] = [];
  if (pool) {
    const [userRows] = await pool.query(
      `SELECT id, name, email, phone, created_at
       FROM users
       WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [term, term, term],
    );
    const [orderRows] = await pool.query(
      `SELECT id, customer_name, customer_email, phone, created_at
       FROM orders
       WHERE id LIKE ? OR customer_email LIKE ? OR phone LIKE ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [term, term, term],
    );
    users = Array.isArray(userRows) ? userRows : [];
    orders = Array.isArray(orderRows) ? orderRows : [];
  }

  const campaignRows = await listCampaigns();
  const campaigns = campaignRows.items
    .filter((item) =>
      item.name.toLowerCase().includes(q.toLowerCase()) ||
      item.status.toLowerCase().includes(q.toLowerCase()) ||
      item.audienceSegment.toLowerCase().includes(q.toLowerCase()),
    )
    .slice(0, 25);

  const results = {
    users,
    orders,
    campaigns,
  };

  return NextResponse.json({
    success: true,
    storage: pool ? 'mysql' : 'fallback',
    q,
    results,
    quickLinks: {
      users: '/admin_dashboard?tab=users',
      orders: '/admin_dashboard?tab=orders',
      campaigns: '/admin/campaigns',
    },
  });
}
