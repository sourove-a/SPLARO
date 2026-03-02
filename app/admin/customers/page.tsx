import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';
import {
  addCustomerNoteAction,
  updateCustomerBlockAction,
  updateCustomerRoleAction,
} from '@/app/admin/module-actions';

type CustomerListRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_blocked: boolean;
  created_at: string;
  order_count: number;
  total_spend: number;
  last_order_at: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
};

type CustomerOrderRow = {
  id: string;
  order_no: string;
  status: string;
  total: number;
  created_at: string;
};

type PurchasedRow = {
  product_name: string;
  total_qty: number;
  total_spent: number;
  last_purchased_at: string | null;
};

type CustomerNote = {
  id: string;
  userId: string;
  note: string;
  createdAt: string;
  createdBy: string;
};

type CustomerActivityRow = {
  id: string;
  source: 'AUDIT' | 'LOGIN';
  action: string;
  created_at: string;
};

const currency = (value: number): string =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const pick = (value: string | string[] | undefined, fallback = ''): string => {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
};

function segmentMatches(segment: string, row: CustomerListRow): boolean {
  const now = Date.now();
  const created = row.created_at ? new Date(row.created_at).getTime() : 0;
  const lastOrder = row.last_order_at ? new Date(row.last_order_at).getTime() : 0;
  if (segment === 'new') return created >= now - 7 * 24 * 60 * 60 * 1000;
  if (segment === 'vip') return row.order_count >= 3 || row.total_spend >= 30000;
  if (segment === 'inactive') return !lastOrder || lastOrder < now - 30 * 24 * 60 * 60 * 1000;
  return true;
}

async function listCustomers(params: { q: string; segment: string; page: number; pageSize: number }) {
  const db = await getDbPool();
  const q = params.q.trim().toLowerCase();

  if (!db) {
    const mem = fallbackStore();
    let rows: CustomerListRow[] = mem.users.map((user) => {
      const orders = mem.orders.filter((order) => order.user_id === user.id || order.email === user.email);
      const sorted = [...orders].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_blocked: Boolean(user.is_blocked),
        created_at: user.created_at,
        order_count: orders.length,
        total_spend: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        last_order_at: sorted[0]?.created_at || null,
      };
    });

    if (q) {
      rows = rows.filter((row) =>
        row.name.toLowerCase().includes(q)
        || row.email.toLowerCase().includes(q)
        || row.phone.toLowerCase().includes(q),
      );
    }
    if (params.segment) rows = rows.filter((row) => segmentMatches(params.segment, row));
    rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
    const safePage = Math.min(params.page, totalPages);
    const start = (safePage - 1) * params.pageSize;
    return {
      items: rows.slice(start, start + params.pageSize),
      total,
      page: safePage,
      pageSize: params.pageSize,
      totalPages,
      storage: 'fallback' as const,
    };
  }

  const where: string[] = [];
  const values: unknown[] = [];
  if (q) {
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    values.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.execute(
    `SELECT
      u.id, u.name, u.email, u.phone, u.role, u.is_blocked, u.created_at,
      COALESCE(u.email_verified, 0) AS email_verified,
      COALESCE(u.phone_verified, 0) AS phone_verified,
      (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.user_id = u.id OR o.email = u.email
      ) AS order_count,
      (
        SELECT COALESCE(SUM(o.total), 0)
        FROM orders o
        WHERE o.user_id = u.id OR o.email = u.email
      ) AS total_spend,
      (
        SELECT MAX(o.created_at)
        FROM orders o
        WHERE o.user_id = u.id OR o.email = u.email
      ) AS last_order_at
     FROM users u
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT 800`,
    values,
  );

  let items = (Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: String(row.id || ''),
    name: String(row.name || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    role: String(row.role || 'user'),
    is_blocked: Boolean(Number(row.is_blocked) || row.is_blocked),
    created_at: String(row.created_at || ''),
    order_count: Number(row.order_count || 0),
    total_spend: Number(row.total_spend || 0),
    last_order_at: row.last_order_at ? String(row.last_order_at) : null,
    email_verified: Boolean(Number(row.email_verified) || row.email_verified),
    phone_verified: Boolean(Number(row.phone_verified) || row.phone_verified),
  })) as CustomerListRow[];

  if (params.segment) items = items.filter((row) => segmentMatches(params.segment, row));

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const safePage = Math.min(params.page, totalPages);
  const start = (safePage - 1) * params.pageSize;

  return {
    items: items.slice(start, start + params.pageSize),
    total,
    page: safePage,
    pageSize: params.pageSize,
    totalPages,
    storage: 'mysql' as const,
  };
}

async function getCustomerDetail(userId: string) {
  if (!userId) return null;
  const db = await getDbPool();

  if (!db) {
    const mem = fallbackStore();
    const user = mem.users.find((item) => item.id === userId);
    if (!user) return null;

    const orders = mem.orders
      .filter((order) => order.user_id === user.id || order.email === user.email)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 80)
      .map((order) => ({
        id: order.id,
        order_no: order.order_no,
        status: order.status,
        total: Number(order.total || 0),
        created_at: order.created_at,
      })) as CustomerOrderRow[];

    const purchasedMap = new Map<string, PurchasedRow>();
    for (const order of mem.orders) {
      if (order.user_id !== user.id && order.email !== user.email) continue;
      const items = mem.orderItems.filter((item) => item.order_id === order.id);
      for (const item of items) {
        const key = item.product_name || 'Unknown Product';
        const existing = purchasedMap.get(key);
        const next: PurchasedRow = {
          product_name: key,
          total_qty: (existing?.total_qty || 0) + Number(item.quantity || 0),
          total_spent: (existing?.total_spent || 0) + Number(item.line_total || 0),
          last_purchased_at: order.created_at,
        };
        purchasedMap.set(key, next);
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        district: user.district || '',
        thana: user.thana || '',
        address: user.address || '',
        role: user.role,
        is_blocked: user.is_blocked,
        created_at: user.created_at,
      },
      orders,
      purchased: [...purchasedMap.values()].sort((a, b) => b.total_qty - a.total_qty).slice(0, 40),
      activity: [],
      storage: 'fallback' as const,
    };
  }

  const [userRows] = await db.execute(
    `SELECT id, name, email, phone, district, thana, address, role, is_blocked, created_at, updated_at,
            COALESCE(email_verified, 0) AS email_verified,
            COALESCE(phone_verified, 0) AS phone_verified
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );
  const user = Array.isArray(userRows) && userRows[0] ? (userRows[0] as any) : null;
  if (!user) return null;

  const [orderRows] = await db.execute(
    `SELECT id, order_no, status, total, created_at
     FROM orders
     WHERE user_id = ? OR email = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId, user.email],
  );

  const [purchasedRows] = await db.execute(
    `SELECT
      oi.product_name,
      COALESCE(SUM(oi.quantity), 0) AS total_qty,
      COALESCE(SUM(oi.line_total), 0) AS total_spent,
      MAX(o.created_at) AS last_purchased_at
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE o.user_id = ? OR o.email = ?
     GROUP BY oi.product_name
     ORDER BY total_qty DESC
     LIMIT 50`,
    [userId, user.email],
  );

  const [auditRows] = await db.execute(
    `SELECT
      CONCAT('audit-', id) AS id,
      'AUDIT' AS source,
      action,
      created_at
     FROM audit_logs
     WHERE entity_type = 'user' AND entity_id = ?
     ORDER BY created_at DESC
     LIMIT 40`,
    [userId],
  );
  const [loginRows] = await db.execute(
    `SELECT
      CONCAT('login-', id) AS id,
      'LOGIN' AS source,
      CONCAT('Login from ', COALESCE(ip_address, 'unknown IP')) AS action,
      created_at
     FROM login_history
     WHERE email = ?
     ORDER BY created_at DESC
     LIMIT 40`,
    [user.email],
  );

  const activity = [
    ...(Array.isArray(auditRows) ? (auditRows as CustomerActivityRow[]) : []),
    ...(Array.isArray(loginRows) ? (loginRows as CustomerActivityRow[]) : []),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  return {
    user: {
      ...user,
      is_blocked: Boolean(Number(user.is_blocked) || user.is_blocked),
      email_verified: Boolean(Number(user.email_verified) || user.email_verified),
      phone_verified: Boolean(Number(user.phone_verified) || user.phone_verified),
    },
    orders: Array.isArray(orderRows) ? (orderRows as CustomerOrderRow[]) : [],
    purchased: Array.isArray(purchasedRows) ? (purchasedRows as PurchasedRow[]) : [],
    activity: activity.slice(0, 80),
    storage: 'mysql' as const,
  };
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = pick(params.q);
  const segment = pick(params.segment);
  const page = Math.max(1, Number(pick(params.page, '1')) || 1);
  const customerId = pick(params.customer);

  const list = await listCustomers({
    q,
    segment,
    page,
    pageSize: 20,
  });

  const selectedCustomerId = customerId || (list.items[0]?.id || '');
  const detail = selectedCustomerId ? await getCustomerDetail(selectedCustomerId) : null;
  const notes = await readAdminSetting<CustomerNote[]>('customer_notes', []);
  const customerNotes = notes
    .filter((note) => note.userId === selectedCustomerId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const vipCount = list.items.filter((item) => segmentMatches('vip', item)).length;
  const inactiveCount = list.items.filter((item) => segmentMatches('inactive', item)).length;
  const newCount = list.items.filter((item) => segmentMatches('new', item)).length;

  const prevPage = Math.max(1, list.page - 1);
  const nextPage = Math.min(list.totalPages, list.page + 1);

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="admin-kicker">Customers CRM</p>
            <h2 className="admin-heading mt-2 text-[#f5e7c5]">Customer Intelligence</h2>
            <p className="mt-3 max-w-3xl text-sm text-[#9f937d]">
              Complete customer profile with order history, lifetime value, moderation flags and account controls.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-[#3a2f1b] bg-[#100d08] px-3 py-2">
              <p className="text-[#8f846f] uppercase tracking-[0.12em]">VIP</p>
              <p className="mt-1 text-[#f2e3bf] font-semibold">{vipCount}</p>
            </div>
            <div className="rounded-xl border border-[#3a2f1b] bg-[#100d08] px-3 py-2">
              <p className="text-[#8f846f] uppercase tracking-[0.12em]">New 7d</p>
              <p className="mt-1 text-[#f2e3bf] font-semibold">{newCount}</p>
            </div>
            <div className="rounded-xl border border-[#3a2f1b] bg-[#100d08] px-3 py-2">
              <p className="text-[#8f846f] uppercase tracking-[0.12em]">Inactive</p>
              <p className="mt-1 text-[#f2e3bf] font-semibold">{inactiveCount}</p>
            </div>
          </div>
        </div>

        <form method="GET" className="mt-6 grid gap-3 md:grid-cols-5">
          <input className="admin-input md:col-span-2" name="q" defaultValue={q} placeholder="Search name / email / phone" />
          <select className="admin-select" name="segment" defaultValue={segment}>
            <option value="">All Segments</option>
            <option value="vip">VIP</option>
            <option value="new">New (7 days)</option>
            <option value="inactive">Inactive (30+ days)</option>
          </select>
          <input type="hidden" name="customer" value={selectedCustomerId} />
          <button type="submit" className="admin-button admin-button-secondary md:col-span-2 justify-center">Apply Filter</button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <article className="admin-panel-card p-5 md:p-6">
          <div className="overflow-auto rounded-xl border border-[#352b19]">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[#110f0c] text-[#9a8d73] text-[10px] uppercase tracking-[0.22em]">
                <tr>
                  <th className="px-3 py-3 text-left">Customer</th>
                  <th className="px-3 py-3 text-left">Orders</th>
                  <th className="px-3 py-3 text-left">Lifetime Value</th>
                  <th className="px-3 py-3 text-left">Role</th>
                  <th className="px-3 py-3 text-left">Block</th>
                  <th className="px-3 py-3 text-left">View</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id} className="border-t border-[#2a2317] align-top">
                    <td className="px-3 py-3 text-[#eadcbc]">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-[#8f8269]">{item.email}</p>
                      <p className="text-xs text-[#8f8269]">{item.phone || '-'}</p>
                    </td>
                    <td className="px-3 py-3 text-[#dac8a1]">
                      <p className="font-semibold">{item.order_count}</p>
                      <p className="text-xs text-[#8f8269]">
                        Last: {item.last_order_at ? new Date(item.last_order_at).toLocaleDateString() : 'No orders'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[#e8c670] font-semibold">{currency(item.total_spend)}</td>
                    <td className="px-3 py-3">
                      <form action={updateCustomerRoleAction} className="space-y-2">
                        <input type="hidden" name="userId" value={item.id} />
                        <select className="admin-select" name="role" defaultValue={item.role}>
                          <option value="user">User</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button type="submit" className="admin-button admin-button-secondary w-full justify-center">Save Role</button>
                      </form>
                    </td>
                    <td className="px-3 py-3">
                      <form action={updateCustomerBlockAction} className="space-y-2">
                        <input type="hidden" name="userId" value={item.id} />
                        <input type="hidden" name="blocked" value={item.is_blocked ? '0' : '1'} />
                        <button type="submit" className={item.is_blocked ? 'admin-button admin-button-primary w-full justify-center' : 'admin-button admin-button-secondary w-full justify-center'}>
                          {item.is_blocked ? 'Unblock' : 'Block'}
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3">
                      <a
                        href={`?q=${encodeURIComponent(q)}&segment=${encodeURIComponent(segment)}&page=${list.page}&customer=${encodeURIComponent(item.id)}`}
                        className={`admin-button w-full justify-center ${selectedCustomerId === item.id ? 'admin-button-primary' : 'admin-button-secondary'}`}
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
                {list.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[#8f836f]">No customer records matched your filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-[#998d76]">
            <p>
              Page {list.page} / {list.totalPages} • {list.total} customers • storage: {list.storage}
            </p>
            <div className="flex items-center gap-2">
              <a className="admin-button admin-button-secondary" href={`?q=${encodeURIComponent(q)}&segment=${encodeURIComponent(segment)}&page=${prevPage}&customer=${encodeURIComponent(selectedCustomerId)}`}>Previous</a>
              <a className="admin-button admin-button-secondary" href={`?q=${encodeURIComponent(q)}&segment=${encodeURIComponent(segment)}&page=${nextPage}&customer=${encodeURIComponent(selectedCustomerId)}`}>Next</a>
            </div>
          </div>
        </article>

        <aside className="space-y-6">
          <article className="admin-panel-card p-5 md:p-6">
            <p className="admin-kicker">Customer Profile</p>
            <h3 className="admin-heading mt-2 text-[#f6e9ce] text-xl">
              {detail?.user?.name || 'Select a customer'}
            </h3>
            {detail?.user ? (
              <div className="mt-4 space-y-2 text-sm text-[#d5c4a1]">
                <p>{detail.user.email}</p>
                <p>{detail.user.phone || '-'}</p>
                <p>{detail.user.address || 'No address set'}</p>
                <p className="text-xs text-[#8f826c]">
                  Verified: email {detail.user.email_verified ? 'YES' : 'NO'} • phone {detail.user.phone_verified ? 'YES' : 'NO'}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#918470]">Pick a customer from the list to inspect full profile and order intelligence.</p>
            )}
          </article>

          <article className="admin-panel-card p-5 md:p-6">
            <p className="admin-kicker">Purchased Products</p>
            <div className="mt-3 space-y-2 max-h-72 overflow-auto">
              {(detail?.purchased || []).map((row) => (
                <div key={`${row.product_name}-${row.last_purchased_at}`} className="rounded-lg border border-[#3a2f1b] bg-[#110e09] px-3 py-2">
                  <p className="text-sm font-semibold text-[#f0e4c7]">{row.product_name}</p>
                  <p className="text-xs text-[#998c73]">
                    Qty {row.total_qty} • {currency(row.total_spent)} • Last {row.last_purchased_at ? new Date(row.last_purchased_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              ))}
              {(detail?.purchased || []).length === 0 ? (
                <p className="text-sm text-[#918470]">No purchase history found for this customer.</p>
              ) : null}
            </div>
          </article>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="admin-panel-card p-5 md:p-6">
          <p className="admin-kicker">Order Timeline</p>
          <div className="mt-4 space-y-2 max-h-72 overflow-auto">
            {(detail?.orders || []).map((order) => (
              <div key={order.id} className="rounded-lg border border-[#382d19] bg-[#0f0d08] px-3 py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#f0e4c7]">#{order.order_no}</p>
                  <p className="text-xs text-[#8f8269]">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#e8c670] font-semibold">{currency(order.total)}</p>
                  <p className="text-xs text-[#a3967d] uppercase tracking-[0.12em]">{order.status}</p>
                </div>
              </div>
            ))}
            {(detail?.orders || []).length === 0 ? (
              <p className="text-sm text-[#918470]">No orders for selected customer.</p>
            ) : null}
          </div>
        </article>

        <article className="admin-panel-card p-5 md:p-6">
          <p className="admin-kicker">Notes & Activity</p>
          <form action={addCustomerNoteAction} className="mt-4 space-y-3">
            <input type="hidden" name="userId" value={selectedCustomerId} />
            <textarea
              name="note"
              className="admin-textarea min-h-24"
              placeholder={selectedCustomerId ? 'Add internal note for this customer' : 'Select a customer first'}
              disabled={!selectedCustomerId}
            />
            <button type="submit" className="admin-button admin-button-primary w-full justify-center" disabled={!selectedCustomerId}>
              Save Note
            </button>
          </form>

          <div className="mt-4 space-y-2 max-h-60 overflow-auto">
            {customerNotes.map((note) => (
              <div key={note.id} className="rounded-lg border border-[#382d19] bg-[#0f0d08] px-3 py-2">
                <p className="text-sm text-[#eadfc6]">{note.note}</p>
                <p className="mt-1 text-xs text-[#8f8269]">{new Date(note.createdAt).toLocaleString()} • {note.createdBy}</p>
              </div>
            ))}
            {customerNotes.length === 0 ? (
              <p className="text-sm text-[#918470]">No notes available for this customer.</p>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 max-h-52 overflow-auto">
            {(detail?.activity || []).map((event) => (
              <div key={event.id} className="rounded-lg border border-[#2d2619] bg-[#0d0c08] px-3 py-2">
                <p className="text-xs uppercase tracking-[0.14em] text-[#9f9070]">{event.source}</p>
                <p className="text-sm text-[#e9ddc4]">{event.action}</p>
                <p className="text-xs text-[#867a64]">{new Date(event.created_at).toLocaleString()}</p>
              </div>
            ))}
            {(detail?.activity || []).length === 0 ? (
              <p className="text-sm text-[#918470]">No customer activity logs found.</p>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
