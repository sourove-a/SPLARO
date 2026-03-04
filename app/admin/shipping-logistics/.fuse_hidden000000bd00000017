import { listIntegrationsForPage } from '@/app/actions/integrations';
import { saveShippingLogisticsSettingsAction } from '@/app/admin/module-actions';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';
import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';

type LogisticsSettings = {
  defaultProvider: string;
  autoDispatchAfterPaid: boolean;
  pickupName: string;
  pickupPhone: string;
  pickupAddress: string;
  zones: Array<{ zone: string; fee: number; eta: string }>;
};

type ShipmentRow = {
  id: string;
  order_no: string;
  provider: string;
  status: string;
  external_status: string;
  consignment_id: string;
  tracking_url: string;
  last_synced_at: string | null;
  created_at: string;
  last_error: string | null;
};

async function loadShippingPageData() {
  const settings = await readAdminSetting<LogisticsSettings>('shipping_logistics_settings', {
    defaultProvider: 'steadfast',
    autoDispatchAfterPaid: false,
    pickupName: 'SPLARO HQ',
    pickupPhone: '+8801905010205',
    pickupAddress: 'Sector 13, Road 16, Uttara, Dhaka 1230',
    zones: [],
  });
  const integrations = (await listIntegrationsForPage()).filter((row) => row.category === 'COURIER & LOGISTICS');
  const db = await getDbPool();

  if (!db) {
    const mem = fallbackStore();
    const shipments: ShipmentRow[] = mem.orders.slice(0, 40).map((order) => ({
      id: order.id,
      order_no: order.order_no,
      provider: settings.defaultProvider || 'steadfast',
      status: order.status || 'PENDING',
      external_status: order.status || 'PENDING',
      consignment_id: '',
      tracking_url: '',
      last_synced_at: null,
      created_at: order.created_at,
      last_error: null,
    }));
    return { settings, integrations, shipments, storage: 'fallback' as const };
  }

  let shipments: ShipmentRow[] = [];
  try {
    const [rows] = await db.execute(
      `SELECT
        s.id,
        COALESCE(o.order_no, s.order_id) AS order_no,
        COALESCE(s.provider, '') AS provider,
        COALESCE(s.status, 'PENDING') AS status,
        COALESCE(s.external_status, '') AS external_status,
        COALESCE(s.consignment_id, '') AS consignment_id,
        COALESCE(s.tracking_url, '') AS tracking_url,
        s.last_synced_at,
        s.created_at,
        s.last_error
      FROM shipments s
      LEFT JOIN orders o ON o.id = s.order_id
      ORDER BY s.created_at DESC
      LIMIT 80`,
    );

    shipments = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: String(row.id || ''),
      order_no: String(row.order_no || ''),
      provider: String(row.provider || ''),
      status: String(row.status || 'PENDING'),
      external_status: String(row.external_status || ''),
      consignment_id: String(row.consignment_id || ''),
      tracking_url: String(row.tracking_url || ''),
      last_synced_at: row.last_synced_at ? String(row.last_synced_at) : null,
      created_at: String(row.created_at || ''),
      last_error: row.last_error ? String(row.last_error) : null,
    }));
  } catch {
    shipments = [];
  }

  return { settings, integrations, shipments, storage: 'mysql' as const };
}

export default async function AdminShippingLogisticsPage() {
  const { settings, integrations, shipments, storage } = await loadShippingPageData();

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="admin-kicker">Shipping & Logistics</p>
            <h2 className="admin-heading mt-2 text-[#f6e8ca]">Fulfillment Operations</h2>
            <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
              Control courier providers, zone fees and dispatch behavior without breaking order flow.
            </p>
          </div>
          <a href="/admin/integrations" className="admin-button admin-button-secondary">
            Provider Credentials
          </a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {integrations.map((integration) => (
            <article key={integration.provider} className="rounded-2xl border border-[#3a2f1b] bg-[#0f0d08] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a8b6f]">{integration.name}</p>
              <p className="mt-2 text-sm text-[#baa77c]">{integration.lastTestMessage || integration.description}</p>
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
        <p className="admin-kicker">Routing Rules</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Pickup, Dispatch & Zone Matrix</h3>
        <form action={saveShippingLogisticsSettingsAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select className="admin-select" name="defaultProvider" defaultValue={settings.defaultProvider || 'steadfast'}>
            <option value="steadfast">Steadfast</option>
            <option value="pathao">Pathao</option>
          </select>
          <input className="admin-input" name="pickupName" defaultValue={settings.pickupName || ''} placeholder="Pickup name" />
          <input className="admin-input" name="pickupPhone" defaultValue={settings.pickupPhone || ''} placeholder="Pickup phone" />
          <input className="admin-input" name="pickupAddress" defaultValue={settings.pickupAddress || ''} placeholder="Pickup address" />
          <textarea
            className="admin-textarea md:col-span-2 xl:col-span-4 min-h-[120px]"
            name="zonesJson"
            defaultValue={JSON.stringify(settings.zones || [], null, 2)}
            placeholder='[{"zone":"Dhaka","fee":80,"eta":"1-2 days"}]'
          />
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989] md:col-span-2">
            <input
              type="checkbox"
              name="autoDispatchAfterPaid"
              defaultChecked={Boolean(settings.autoDispatchAfterPaid)}
              className="h-4 w-4"
            />
            Auto-dispatch after payment status PAID
          </label>

          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Save Logistics Settings
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="admin-kicker">Shipment Timeline</p>
            <h3 className="text-lg font-semibold text-[#f3e5c2]">Recent Courier Records</h3>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/admin/shipments/steadfast/sync" className="admin-button admin-button-secondary">
              Sync Tracking
            </a>
            <span className="rounded-full border border-[#3b311f] bg-[#120f0a] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#bca879]">
              Storage: {storage}
            </span>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Order</th>
                <th className="px-3 py-3 text-left">Provider</th>
                <th className="px-3 py-3 text-left">Consignment</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Tracking</th>
                <th className="px-3 py-3 text-left">Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="border-t border-[#2a2317]">
                  <td className="px-3 py-3 text-[#e7d8b8] font-medium">{shipment.order_no || '-'}</td>
                  <td className="px-3 py-3 text-[#d6c29b] uppercase">{shipment.provider || '-'}</td>
                  <td className="px-3 py-3 text-[#c5b08a]">{shipment.consignment_id || 'Pending'}</td>
                  <td className="px-3 py-3">
                    <span className="admin-status-warn rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                      {shipment.external_status || shipment.status || 'PENDING'}
                    </span>
                    {shipment.last_error ? (
                      <p className="mt-2 text-xs text-[#d99595]">{shipment.last_error.slice(0, 90)}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {shipment.tracking_url ? (
                      <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="admin-button admin-button-secondary">
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-[#8f826a]">Not available</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[#9d917c]">
                    {(shipment.last_synced_at || shipment.created_at) ? new Date(shipment.last_synced_at || shipment.created_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#8c8069]">
                    No shipment records yet.
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
