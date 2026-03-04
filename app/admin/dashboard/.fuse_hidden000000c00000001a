import { DollarSign, Package, ShoppingBag, Users } from 'lucide-react';
import { getDashboardSnapshot } from '../_lib/data';

const currency = (value: number): string =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(value || 0);

export default async function AdminDashboardPage() {
  const dashboard = await getDashboardSnapshot();

  const cards = [
    {
      label: 'Total Revenue',
      value: currency(dashboard.summary.totalRevenue),
      icon: DollarSign,
      tone: 'from-[#2a1e0b] to-[#1a1308] border-[#4b3a1a] text-[#e8c670]',
    },
    {
      label: 'Today Sales',
      value: currency(dashboard.summary.salesToday),
      icon: ShoppingBag,
      tone: 'from-[#143122] to-[#0d1f17] border-[#2f6b4b] text-[#9fe2bf]',
    },
    {
      label: 'Orders',
      value: String(dashboard.summary.ordersCount),
      icon: Package,
      tone: 'from-[#181818] to-[#101010] border-[#3f3220] text-[#d5c4a0]',
    },
    {
      label: 'Customers',
      value: String(dashboard.summary.customersCount),
      icon: Users,
      tone: 'from-[#1b1711] to-[#100e0a] border-[#4a3a1f] text-[#d9c79f]',
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className={`admin-panel-card bg-gradient-to-br ${card.tone} p-5 md:p-6`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#8f846e]">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight">{card.value}</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#4d3c21] bg-[#120f0b]">
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr,1fr]">
        <article className="admin-panel-card p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="admin-kicker">Operations</p>
              <h2 className="admin-heading mt-2 text-[#f5e7c5]">Recent Orders</h2>
            </div>
            <a href="/admin/orders" className="admin-button admin-button-secondary">Open Orders</a>
          </div>

          <div className="mt-5 overflow-auto rounded-xl border border-[#322915]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#110f0c] text-[#9d8d6d] text-[10px] uppercase tracking-[0.22em]">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-[#2a2317] text-[#e2d5bb]">
                    <td className="px-4 py-3 font-semibold">#{order.order_no}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.name}</p>
                      <p className="text-xs text-[#918570]">{order.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-[#4b3b20] bg-[#1a140a] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#e8c670]">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{currency(order.total)}</td>
                  </tr>
                ))}
                {dashboard.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[#8d816d]">No orders yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <div className="space-y-6">
          <article className="admin-panel-card p-5 md:p-6">
            <p className="admin-kicker">Catalog Performance</p>
            <h2 className="admin-heading mt-2 text-[#f5e7c5]">Top Products</h2>
            <div className="mt-4 space-y-3">
              {dashboard.topProducts.map((product) => (
                <div
                  key={product.product_id}
                  className="rounded-xl border border-[#302615] bg-[#100d08] px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[#eddcb8]">{product.product_name || 'Untitled Product'}</p>
                    <p className="text-xs text-[#978a75]">{product.units} sold</p>
                  </div>
                  <p className="text-sm font-semibold text-[#e8c670]">{currency(product.revenue)}</p>
                </div>
              ))}
              {dashboard.topProducts.length === 0 ? (
                <p className="text-sm text-[#8e826e]">Top product data appears once order_items records are available.</p>
              ) : null}
            </div>
          </article>

          <article className="admin-panel-card p-5 md:p-6">
            <p className="admin-kicker">System</p>
            <h2 className="admin-heading mt-2 text-[#f5e7c5]">Runtime Snapshot</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-[#2f2616] bg-[#0e0c09] px-3 py-2">
                <dt className="text-[#8e826e]">Storage</dt>
                <dd className="text-[#f2e6cd] uppercase tracking-[0.15em] text-xs">{dashboard.storage}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#2f2616] bg-[#0e0c09] px-3 py-2">
                <dt className="text-[#8e826e]">Mode</dt>
                <dd className="text-[#f2e6cd] uppercase tracking-[0.15em] text-xs">{dashboard.mode}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#2f2616] bg-[#0e0c09] px-3 py-2">
                <dt className="text-[#8e826e]">AOV</dt>
                <dd className="text-[#f2e6cd] font-semibold">{currency(dashboard.summary.avgOrderValue)}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>
    </div>
  );
}
