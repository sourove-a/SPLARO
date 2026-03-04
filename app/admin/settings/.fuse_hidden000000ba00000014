import { savePlatformSettingsAction } from '@/app/admin/module-actions';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';
import { getAdminRole } from '@/app/admin/_lib/auth';
import { getDbPool, getStorageInfo } from '@/lib/db';
import { getCacheStore } from '@/lib/cache';
import { getQueueStats } from '@/lib/queue';

type AdminSettings = {
  store_name: string;
  support_email: string;
  support_phone: string;
  shipping_fee: number;
  tax_rate: number;
  currency: string;
  maintenance_mode: boolean;
  appearance?: {
    primary?: string;
    accent?: string;
    surface?: string;
    radius?: string;
  };
};

type ProbeStatus = 'OK' | 'WARNING' | 'DOWN';
type HealthProbe = {
  key: string;
  label: string;
  status: ProbeStatus;
  detail: string;
  nextAction: string;
  latencyMs: number | null;
};

type HealthSnapshot = {
  checkedAt: string;
  mode: 'NORMAL' | 'DEGRADED';
  probes: HealthProbe[];
};

function probeClasses(status: ProbeStatus): string {
  if (status === 'OK') return 'admin-status-ok';
  if (status === 'WARNING') return 'admin-status-warn';
  return 'admin-status-down';
}

async function buildHealthSnapshot(): Promise<HealthSnapshot> {
  const checkedAt = new Date().toISOString();
  const probes: HealthProbe[] = [];
  let degraded = false;

  const storage = await getStorageInfo();
  const db = await getDbPool();
  if (!db) {
    probes.push({
      key: 'db',
      label: 'DB',
      status: 'DOWN',
      detail: storage.error || 'Database connection unavailable.',
      nextAction: 'Check DB credentials/Hostinger DB user permissions.',
      latencyMs: null,
    });
    degraded = true;
  } else {
    const started = Date.now();
    try {
      await db.query('SELECT 1 AS ok');
      probes.push({
        key: 'db',
        label: 'DB',
        status: 'OK',
        detail: `Storage: ${storage.storage.toUpperCase()} (${storage.dbHost})`,
        nextAction: '',
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      probes.push({
        key: 'db',
        label: 'DB',
        status: 'DOWN',
        detail: error instanceof Error ? error.message : 'Database probe failed.',
        nextAction: 'Inspect slow query load and DB availability.',
        latencyMs: Date.now() - started,
      });
      degraded = true;
    }
  }

  try {
    const started = Date.now();
    const cache = await getCacheStore();
    const key = `admin-health-${Date.now()}`;
    await cache.set(key, { ok: true }, 12);
    const value = await cache.get<{ ok?: boolean }>(key);
    await cache.del(key);
    probes.push({
      key: 'cache',
      label: 'Cache',
      status: value?.ok ? 'OK' : 'WARNING',
      detail: value?.ok ? 'Read/write cache operations working.' : 'Cache readback mismatch.',
      nextAction: value?.ok ? '' : 'Check cache configuration.',
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    probes.push({
      key: 'cache',
      label: 'Cache',
      status: 'WARNING',
      detail: error instanceof Error ? error.message : 'Cache probe failed.',
      nextAction: 'Memory fallback is active; inspect cache backend if configured.',
      latencyMs: null,
    });
  }

  try {
    const started = Date.now();
    const stats = await getQueueStats();
    const dead = Number(stats.totals.DEAD || 0);
    const retry = Number(stats.totals.RETRY || 0);
    let status: ProbeStatus = 'OK';
    let detail = `Mode: ${stats.mode.toUpperCase()} • Pending: ${stats.totals.PENDING || 0}`;
    let nextAction = '';
    if (dead > 0) {
      status = 'DOWN';
      detail = `Dead jobs: ${dead} • Retry: ${retry}`;
      nextAction = 'Repair queue and inspect integration errors.';
      degraded = true;
    } else if (retry > 10) {
      status = 'WARNING';
      detail = `Retry backlog: ${retry}`;
      nextAction = 'Watch queue retry trend and failure logs.';
    }
    probes.push({
      key: 'queue',
      label: 'Queue',
      status,
      detail,
      nextAction,
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    probes.push({
      key: 'queue',
      label: 'Queue',
      status: 'WARNING',
      detail: error instanceof Error ? error.message : 'Queue probe failed.',
      nextAction: 'Inspect queue table and worker execution.',
      latencyMs: null,
    });
  }

  if (db) {
    try {
      const started = Date.now();
      await db.query('SELECT COUNT(*) AS total FROM orders');
      probes.push({
        key: 'orders_api',
        label: 'Orders API',
        status: 'OK',
        detail: 'Orders dataset reachable.',
        nextAction: '',
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      probes.push({
        key: 'orders_api',
        label: 'Orders API',
        status: 'WARNING',
        detail: error instanceof Error ? error.message : 'Orders probe failed.',
        nextAction: 'Check orders table schema and API query path.',
        latencyMs: null,
      });
    }

    try {
      const started = Date.now();
      await db.query('SELECT COUNT(*) AS total FROM users');
      probes.push({
        key: 'auth_api',
        label: 'Auth API',
        status: 'OK',
        detail: 'Users/auth dataset reachable.',
        nextAction: '',
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      probes.push({
        key: 'auth_api',
        label: 'Auth API',
        status: 'WARNING',
        detail: error instanceof Error ? error.message : 'Auth probe failed.',
        nextAction: 'Check users table and auth route integration.',
        latencyMs: null,
      });
    }
  } else {
    probes.push({
      key: 'orders_api',
      label: 'Orders API',
      status: 'WARNING',
      detail: 'Skipped because DB is unavailable.',
      nextAction: 'Restore DB first.',
      latencyMs: null,
    });
    probes.push({
      key: 'auth_api',
      label: 'Auth API',
      status: 'WARNING',
      detail: 'Skipped because DB is unavailable.',
      nextAction: 'Restore DB first.',
      latencyMs: null,
    });
  }

  const envServices: Array<{
    key: string;
    label: string;
    configured: boolean;
    hint: string;
  }> = [
    {
      key: 'telegram',
      label: 'Telegram',
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      hint: 'Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.',
    },
    {
      key: 'sheets',
      label: 'Sheets',
      configured: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.GOOGLE_OAUTH_CLIENT_ID),
      hint: 'Set GOOGLE_SHEETS_WEBHOOK_URL or OAuth credentials.',
    },
    {
      key: 'push',
      label: 'Push',
      configured: Boolean(process.env.PUSH_VAPID_PUBLIC_KEY && process.env.PUSH_VAPID_PRIVATE_KEY),
      hint: 'Set PUSH_VAPID_PUBLIC_KEY + PUSH_VAPID_PRIVATE_KEY.',
    },
    {
      key: 'sslcommerz',
      label: 'SSLCommerz',
      configured: Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD),
      hint: 'Set SSLCOMMERZ_STORE_ID + SSLCOMMERZ_STORE_PASSWORD.',
    },
    {
      key: 'steadfast',
      label: 'Steadfast',
      configured: Boolean(process.env.STEADFAST_API_KEY || process.env.STEADFAST_TOKEN),
      hint: 'Set STEADFAST_API_KEY or STEADFAST_TOKEN.',
    },
  ];

  for (const item of envServices) {
    probes.push({
      key: item.key,
      label: item.label,
      status: item.configured ? 'OK' : 'WARNING',
      detail: item.configured ? 'Credentials configured.' : 'Not configured.',
      nextAction: item.configured ? '' : item.hint,
      latencyMs: null,
    });
  }

  return {
    checkedAt,
    mode: degraded ? 'DEGRADED' : 'NORMAL',
    probes,
  };
}

export default async function AdminSettingsPage() {
  const [role, settings, health] = await Promise.all([
    getAdminRole(),
    readAdminSetting<AdminSettings>('admin_settings', {
      store_name: 'SPLARO',
      support_email: 'info@splaro.co',
      support_phone: '+8801905010205',
      shipping_fee: 120,
      tax_rate: 0,
      currency: 'BDT',
      maintenance_mode: false,
      appearance: {
        primary: '#e8c670',
        accent: '#9bd7b2',
        surface: '#0c0c0c',
        radius: '18',
      },
    }),
    buildHealthSnapshot(),
  ]);

  const canEdit = role === 'SUPER_ADMIN';
  const appearance = settings.appearance || {};

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <p className="admin-kicker">Settings</p>
        <h2 className="admin-heading mt-2 text-[#f6e8ca]">Platform Configuration</h2>
        <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
          Configure global commerce defaults, contact info and visual tokens for storefront and admin surfaces.
        </p>
        <div className="mt-4 inline-flex rounded-full border border-[#3c311d] bg-[#120f09] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#c9b07a]">
          Role: {role.replace('_', ' ')}
        </div>
      </section>

      <section className="admin-panel-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-kicker">Service Health</p>
            <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">API + Integration Matrix</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#3a2f1b] bg-[#0f0d08] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#ceb684]">
            Mode: {health.mode}
          </div>
        </div>

        <p className="mt-2 text-xs text-[#968a74]">Last checked: {new Date(health.checkedAt).toLocaleString()}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {health.probes.map((probe) => (
            <article key={probe.key} className="rounded-xl border border-[#3a2f1b] bg-[#0f0d08] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#f2e4c5]">{probe.label}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${probeClasses(probe.status)}`}>
                  {probe.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#baaa86]">{probe.detail || 'No issues detected.'}</p>
              <p className="mt-1 text-[11px] text-[#8f826a]">
                Latency: {probe.latencyMs !== null ? `${probe.latencyMs}ms` : 'N/A'}
              </p>
              {probe.nextAction ? <p className="mt-1 text-[11px] text-[#d2b678]">Next: {probe.nextAction}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">General</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Store + Commerce Defaults</h3>
        <form action={savePlatformSettingsAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="admin-input" name="store_name" defaultValue={settings.store_name || ''} placeholder="Store name" disabled={!canEdit} />
          <input className="admin-input" name="support_email" defaultValue={settings.support_email || ''} placeholder="Support email" disabled={!canEdit} />
          <input className="admin-input" name="support_phone" defaultValue={settings.support_phone || ''} placeholder="Support phone" disabled={!canEdit} />
          <input className="admin-input" name="currency" defaultValue={settings.currency || 'BDT'} placeholder="Currency" disabled={!canEdit} />

          <input
            className="admin-input"
            name="shipping_fee"
            type="number"
            min={0}
            step="1"
            defaultValue={settings.shipping_fee ?? 120}
            placeholder="Shipping fee"
            disabled={!canEdit}
          />
          <input
            className="admin-input"
            name="tax_rate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={settings.tax_rate ?? 0}
            placeholder="Tax rate (%)"
            disabled={!canEdit}
          />

          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
            <input type="checkbox" name="maintenance_mode" defaultChecked={Boolean(settings.maintenance_mode)} className="h-4 w-4" disabled={!canEdit} />
            Maintenance mode
          </label>

          <div className="rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 py-2 text-xs text-[#bda97f]">
            SMTP, Telegram and payment gateway credentials are managed under Integrations.
          </div>

          <input className="admin-input" name="appearance_primary" defaultValue={appearance.primary || '#e8c670'} placeholder="Primary color" disabled={!canEdit} />
          <input className="admin-input" name="appearance_accent" defaultValue={appearance.accent || '#9bd7b2'} placeholder="Accent color" disabled={!canEdit} />
          <input className="admin-input" name="appearance_surface" defaultValue={appearance.surface || '#0c0c0c'} placeholder="Surface color" disabled={!canEdit} />
          <input className="admin-input" name="appearance_radius" defaultValue={appearance.radius || '18'} placeholder="Radius scale" disabled={!canEdit} />

          <button
            type="submit"
            className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4 disabled:opacity-45 disabled:cursor-not-allowed"
            disabled={!canEdit}
          >
            Save Platform Settings
          </button>
        </form>
        {!canEdit ? (
          <p className="mt-3 text-xs text-[#c5a36a]">Only Super Admin can modify platform settings.</p>
        ) : null}
      </section>
    </div>
  );
}
