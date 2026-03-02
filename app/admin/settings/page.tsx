import { savePlatformSettingsAction } from '@/app/admin/module-actions';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';
import { getAdminRole } from '@/app/admin/_lib/auth';

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

export default async function AdminSettingsPage() {
  const [role, settings] = await Promise.all([
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
