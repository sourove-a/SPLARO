import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';
import { createCouponAction, updateCouponAction } from '@/app/admin/module-actions';

type CouponRow = {
  id: string;
  code: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  expiry_at: string | null;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const currency = (value: number): string =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(value || 0);

const pick = (value: string | string[] | undefined, fallback = ''): string => {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
};

async function listCoupons(params: { q: string; active: string; page: number; pageSize: number }) {
  const db = await getDbPool();
  const q = params.q.toLowerCase().trim();

  if (!db) {
    const mem = fallbackStore();
    let rows = mem.coupons.map((item) => ({ ...item })) as CouponRow[];
    if (q) rows = rows.filter((item) => item.code.toLowerCase().includes(q));
    if (params.active === 'true') rows = rows.filter((item) => item.is_active);
    if (params.active === 'false') rows = rows.filter((item) => !item.is_active);
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
    where.push('code LIKE ?');
    values.push(`%${q}%`);
  }
  if (params.active === 'true') where.push('is_active = 1');
  if (params.active === 'false') where.push('is_active = 0');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM coupons ${whereSql}`, values);
  const total = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as any).total || 0) : 0;
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const safePage = Math.min(params.page, totalPages);
  const offset = (safePage - 1) * params.pageSize;

  const [rows] = await db.execute(
    `SELECT id, code, discount_type, discount_value, expiry_at, usage_limit, used_count, is_active, created_at, updated_at
     FROM coupons
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset],
  );

  return {
    items: Array.isArray(rows)
      ? (rows as any[]).map((row) => ({
          ...row,
          is_active: Boolean(Number((row as any).is_active) || (row as any).is_active),
        }))
      : [],
    total,
    page: safePage,
    pageSize: params.pageSize,
    totalPages,
    storage: 'mysql' as const,
  };
}

export default async function AdminCouponsDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = pick(params.q);
  const active = pick(params.active);
  const page = Math.max(1, Number(pick(params.page, '1')) || 1);
  const result = await listCoupons({ q, active, page, pageSize: 20 });
  const prevPage = Math.max(1, result.page - 1);
  const nextPage = Math.min(result.totalPages, result.page + 1);

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="admin-kicker">Coupons & Discounts</p>
            <h2 className="admin-heading mt-2 text-[#f6e8ca]">Promotion Engine</h2>
            <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
              Create percentage and fixed promotions with expiry windows, usage caps and instant activation control.
            </p>
          </div>
          <a href="/api/admin/coupons" className="admin-button admin-button-secondary">Coupons JSON API</a>
        </div>

        <form action={createCouponAction} className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input className="admin-input" name="code" placeholder="Coupon code" required />
          <select className="admin-select" name="discountType" defaultValue="PERCENT">
            <option value="PERCENT">Percent (%)</option>
            <option value="FIXED">Fixed (BDT)</option>
          </select>
          <input className="admin-input" name="discountValue" type="number" min="0" step="0.01" placeholder="Value" required />
          <input className="admin-input" name="usageLimit" type="number" min="0" step="1" placeholder="Usage limit" />
          <input className="admin-input" name="expiryAt" type="datetime-local" />
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
            Active
          </label>
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-6">
            Create Coupon
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <form method="GET" className="grid gap-3 md:grid-cols-4">
          <input className="admin-input md:col-span-2" name="q" defaultValue={q} placeholder="Search code" />
          <select className="admin-select" name="active" defaultValue={active}>
            <option value="">All states</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button className="admin-button admin-button-secondary justify-center" type="submit">Apply Filter</button>
        </form>

        <div className="mt-5 overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-[#110f0c] text-[#98886a] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Discount</th>
                <th className="px-3 py-3 text-left">Usage</th>
                <th className="px-3 py-3 text-left">Expiry</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Update</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((coupon) => (
                <tr key={coupon.id} className="border-t border-[#2a2317] align-top">
                  <td className="px-3 py-3 text-[#efe2c6]">
                    <p className="font-semibold">{coupon.code}</p>
                    <p className="text-xs text-[#90836c]">Created {new Date(coupon.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="px-3 py-3 text-[#dcc89e]">
                    {coupon.discount_type === 'PERCENT' ? `${coupon.discount_value}%` : currency(Number(coupon.discount_value || 0))}
                  </td>
                  <td className="px-3 py-3 text-[#d6c39a]">
                    <p>{coupon.used_count} used</p>
                    <p className="text-xs text-[#8f826a]">Limit {coupon.usage_limit || '∞'}</p>
                  </td>
                  <td className="px-3 py-3 text-[#cab78f]">
                    {coupon.expiry_at ? new Date(coupon.expiry_at).toLocaleString() : 'No expiry'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={coupon.is_active ? 'admin-status-ok rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]' : 'admin-status-down rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'}>
                      {coupon.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <form action={updateCouponAction} className="grid gap-2 md:grid-cols-2">
                      <input type="hidden" name="id" value={coupon.id} />
                      <input className="admin-input" name="discountValue" type="number" min="0" step="0.01" defaultValue={coupon.discount_value} />
                      <input className="admin-input" name="usageLimit" type="number" min="0" step="1" defaultValue={coupon.usage_limit} />
                      <input
                        className="admin-input md:col-span-2"
                        name="expiryAt"
                        type="datetime-local"
                        defaultValue={coupon.expiry_at ? new Date(coupon.expiry_at).toISOString().slice(0, 16) : ''}
                      />
                      <label className="flex items-center gap-2 rounded-lg border border-[#3a2f1b] bg-[#0e0c09] px-3 py-2 text-xs text-[#ccb889] md:col-span-2">
                        <input type="checkbox" name="isActive" defaultChecked={coupon.is_active} className="h-4 w-4" />
                        Keep active
                      </label>
                      <button type="submit" className="admin-button admin-button-secondary md:col-span-2 justify-center">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#8c8069]">No coupons found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-[#998d76]">
          <p>Page {result.page} / {result.totalPages} • {result.total} coupons • storage: {result.storage}</p>
          <div className="flex items-center gap-2">
            <a className="admin-button admin-button-secondary" href={`?q=${encodeURIComponent(q)}&active=${encodeURIComponent(active)}&page=${prevPage}`}>Previous</a>
            <a className="admin-button admin-button-secondary" href={`?q=${encodeURIComponent(q)}&active=${encodeURIComponent(active)}&page=${nextPage}`}>Next</a>
          </div>
        </div>
      </section>
    </div>
  );
}
