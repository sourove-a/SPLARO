import { updateOrderStatusAction } from '../actions';
import { listAdminOrders } from '../_lib/data';

const money = (value: number): string =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(value || 0);

const pick = (value: string | string[] | undefined, fallback = ''): string => {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
};

const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = pick(params.q);
  const status = pick(params.status);
  const page = Number(pick(params.page, '1')) || 1;

  const result = await listAdminOrders({
    q,
    status,
    page,
    pageSize: 14,
  });

  const prevPage = Math.max(1, result.page - 1);
  const nextPage = Math.min(result.totalPages, result.page + 1);

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="admin-kicker">Order Operations</p>
            <h2 className="admin-heading mt-2 text-[#f5e8cb]">Orders</h2>
            <p className="mt-3 text-sm text-[#9c917c] max-w-3xl">
              Manage statuses, refunds, and notes with a streamlined fulfillment command table.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/reports?type=sales" className="admin-button admin-button-secondary">Export Sales Report</a>
            <a href="/api/admin/orders" className="admin-button admin-button-secondary">Raw JSON API</a>
          </div>
        </div>

        <form className="mt-6 grid gap-3 md:grid-cols-4" method="GET">
          <input name="q" defaultValue={q} placeholder="Order / customer / phone" className="admin-input md:col-span-2" />
          <select name="status" defaultValue={status} className="admin-select">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button type="submit" className="admin-button admin-button-secondary justify-center">Apply Filters</button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Order</th>
                <th className="px-3 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Amount</th>
                <th className="px-3 py-3 text-left">Status Update</th>
                <th className="px-3 py-3 text-left">Flags</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((order) => (
                <tr key={order.id} className="border-t border-[#2a2317] align-top">
                  <td className="px-3 py-3 text-[#efdfbf]">
                    <p className="font-semibold">#{order.order_no}</p>
                    <p className="text-xs text-[#8d8069] mt-1">{new Date(order.created_at).toLocaleString()}</p>
                  </td>
                  <td className="px-3 py-3 text-[#dcc9a3]">
                    <p className="font-medium">{order.name}</p>
                    <p className="text-xs text-[#8d8069]">{order.email}</p>
                    <p className="text-xs text-[#8d8069]">{order.phone}</p>
                  </td>
                  <td className="px-3 py-3 text-[#e4d3b1]">
                    <p className="font-semibold">{money(order.total)}</p>
                    <p className="text-xs text-[#93866f]">Subtotal: {money(order.subtotal)}</p>
                    <p className="text-xs text-[#93866f]">Shipping: {money(order.shipping)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <form action={updateOrderStatusAction} className="space-y-2">
                      <input type="hidden" name="order_no" value={order.order_no} />
                      <select name="status" defaultValue={order.status} className="admin-select">
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <button type="submit" className="admin-button admin-button-primary w-full justify-center">Update Status</button>
                    </form>
                  </td>
                  <td className="px-3 py-3">
                    <form action={updateOrderStatusAction} className="space-y-2">
                      <input type="hidden" name="order_no" value={order.order_no} />
                      <input type="hidden" name="status" value={order.status} />
                      <label className="flex items-center gap-2 rounded-lg border border-[#3e311d] bg-[#0e0c09] px-3 py-2 text-xs text-[#c8b48e]">
                        <input type="checkbox" name="refund_requested" defaultChecked={Boolean(order.is_refund_requested)} className="h-4 w-4" /> Refund Requested
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-[#3e311d] bg-[#0e0c09] px-3 py-2 text-xs text-[#c8b48e]">
                        <input type="checkbox" name="refunded" defaultChecked={Boolean(order.is_refunded)} className="h-4 w-4" /> Refunded
                      </label>
                      <button type="submit" className="admin-button admin-button-secondary w-full justify-center">Save Flags</button>
                    </form>
                  </td>
                </tr>
              ))}
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#8d816d]">No orders matched your filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-[#9b8f79]">
          <p>
            Showing page {result.page} of {result.totalPages} • {result.total} orders • storage: {result.storage}
          </p>
          <div className="flex items-center gap-2">
            <a
              className="admin-button admin-button-secondary"
              href={`?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${prevPage}`}
            >
              Previous
            </a>
            <a
              className="admin-button admin-button-secondary"
              href={`?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${nextPage}`}
            >
              Next
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
