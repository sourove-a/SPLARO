import { listIntegrationsForPage } from '@/app/actions/integrations';
import { savePaymentsQuickSettingsAction } from '@/app/admin/module-actions';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';
import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';

type PaymentEventRow = {
  id: string;
  order_no: string;
  provider: string;
  status: string;
  event_type: string;
  amount: number;
  currency: string;
  created_at: string;
};

type PaymentSettings = {
  defaultGateway: string;
  codEnabled: boolean;
  autoCapture: boolean;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
};

const currency = (value: number, code = 'BDT'): string =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: code || 'BDT',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

async function loadPaymentsPageData() {
  const settings = await readAdminSetting<PaymentSettings>('payments_quick_settings', {
    defaultGateway: 'SSLCommerz',
    codEnabled: true,
    autoCapture: false,
    successUrl: 'https://splaro.co/payment/success',
    failUrl: 'https://splaro.co/payment/fail',
    cancelUrl: 'https://splaro.co/payment/cancel',
    ipnUrl: 'https://splaro.co/api/payment/sslcommerz/ipn',
  });

  const integrations = (await listIntegrationsForPage()).filter((item) => item.category === 'PAYMENT GATEWAYS');
  const db = await getDbPool();

  if (!db) {
    const mem = fallbackStore();
    const events: PaymentEventRow[] = mem.orders.slice(0, 30).map((order) => ({
      id: order.id,
      order_no: order.order_no,
      provider: settings.defaultGateway || 'COD',
      status: String((order as any).payment_status || 'PENDING'),
      event_type: 'ORDER_PAYMENT_STATE',
      amount: Number(order.total || 0),
      currency: 'BDT',
      created_at: order.created_at,
    }));
    return { settings, integrations, events, storage: 'fallback' as const };
  }

  let events: PaymentEventRow[] = [];
  try {
    const [rows] = await db.execute(
      `SELECT
        pe.id,
        COALESCE(o.order_no, pe.order_id) AS order_no,
        pe.provider,
        pe.status,
        pe.event_type,
        COALESCE(pe.amount, 0) AS amount,
        COALESCE(pe.currency, 'BDT') AS currency,
        pe.created_at
      FROM payment_events pe
      LEFT JOIN orders o ON o.id = pe.order_id
      ORDER BY pe.created_at DESC
      LIMIT 80`,
    );

    events = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: String(row.id || ''),
      order_no: String(row.order_no || ''),
      provider: String(row.provider || ''),
      status: String(row.status || ''),
      event_type: String(row.event_type || ''),
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'BDT'),
      created_at: String(row.created_at || ''),
    }));
  } catch {
    events = [];
  }

  return { settings, integrations, events, storage: 'mysql' as const };
}

export default async function AdminPaymentsPage() {
  const { settings, integrations, events, storage } = await loadPaymentsPageData();

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="admin-kicker">Payments</p>
            <h2 className="admin-heading mt-2 text-[#f6e8ca]">Payment Gateways Control</h2>
            <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
              Control SSLCommerz, bKash, Nagad and COD behavior with safe callbacks and reconciliation-ready settings.
            </p>
          </div>
          <a href="/admin/integrations" className="admin-button admin-button-secondary">
            Manage Credentials
          </a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {integrations.map((integration) => (
            <article key={integration.provider} className="rounded-2xl border border-[#3b2f1a] bg-[#0d0b08] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#96876a]">{integration.name}</p>
              <p className="mt-2 text-sm text-[#bda97c]">{integration.lastTestMessage || integration.description}</p>
              <span
                className={
                  integration.isConnected
                    ? 'mt-3 inline-flex rounded-full border border-[#2f6649] bg-[#102618] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#8ad4ac]'
                    : 'mt-3 inline-flex rounded-full border border-[#5f4a27] bg-[#1a1309] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#e8c670]'
                }
              >
                {integration.isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Quick Settings</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Checkout Flow Rules</h3>
        <form action={savePaymentsQuickSettingsAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select className="admin-select" name="defaultGateway" defaultValue={settings.defaultGateway || 'SSLCommerz'}>
            <option value="SSLCommerz">SSLCommerz</option>
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Rocket">Rocket</option>
            <option value="COD">Cash on Delivery</option>
          </select>
          <input className="admin-input" name="successUrl" defaultValue={settings.successUrl || ''} placeholder="Success URL" />
          <input className="admin-input" name="failUrl" defaultValue={settings.failUrl || ''} placeholder="Fail URL" />
          <input className="admin-input" name="cancelUrl" defaultValue={settings.cancelUrl || ''} placeholder="Cancel URL" />
          <input className="admin-input md:col-span-2 xl:col-span-2" name="ipnUrl" defaultValue={settings.ipnUrl || ''} placeholder="IPN URL" />

          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
            <input type="checkbox" name="codEnabled" defaultChecked={Boolean(settings.codEnabled)} className="h-4 w-4" />
            Enable COD
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
            <input type="checkbox" name="autoCapture" defaultChecked={Boolean(settings.autoCapture)} className="h-4 w-4" />
            Auto-capture valid payments
          </label>

          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Save Payment Settings
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="admin-kicker">Events Ledger</p>
            <h3 className="text-lg font-semibold text-[#f3e5c2]">Recent Payment Events</h3>
          </div>
          <span className="rounded-full border border-[#3b311f] bg-[#120f0a] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#bca879]">
            Storage: {storage}
          </span>
        </div>

        <div className="overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Order</th>
                <th className="px-3 py-3 text-left">Provider</th>
                <th className="px-3 py-3 text-left">Event</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Amount</th>
                <th className="px-3 py-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-[#2a2317]">
                  <td className="px-3 py-3 text-[#e7d8b8] font-medium">{event.order_no || '-'}</td>
                  <td className="px-3 py-3 text-[#d6c29b] uppercase">{event.provider || '-'}</td>
                  <td className="px-3 py-3 text-[#c5b08a]">{event.event_type || '-'}</td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        String(event.status).toUpperCase() === 'PAID' || String(event.status).toUpperCase() === 'DONE'
                          ? 'admin-status-ok rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'
                          : String(event.status).toUpperCase() === 'FAILED' || String(event.status).toUpperCase() === 'DEAD'
                            ? 'admin-status-down rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'
                            : 'admin-status-warn rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'
                      }
                    >
                      {event.status || 'PENDING'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#dfcda9]">{currency(event.amount, event.currency || 'BDT')}</td>
                  <td className="px-3 py-3 text-[#9d917c]">{event.created_at ? new Date(event.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#8c8069]">
                    No payment events found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
