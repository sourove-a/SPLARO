import { listIntegrationsForPage } from '@/app/actions/integrations';
import {
  createCampaignAction,
  saveMarketingSettingsAction,
  updateCampaignStatusAction,
} from '@/app/admin/module-actions';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';
import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  audience_segment: string;
  target_count: number;
  pulse_percent: number;
  schedule_time: string | null;
  content: string | null;
  updated_at: string;
  created_at: string;
};

type MarketingSettings = {
  metaPixelId: string;
  ga4Id: string;
  seoTitleTemplate: string;
  seoDescriptionTemplate: string;
  announcementBar: string;
  emailCampaignEnabled: boolean;
};

async function listCampaigns() {
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    return mem.campaigns
      .filter((row) => !row.deleted_at)
      .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
      .slice(0, 100) as CampaignRow[];
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, name, status, audience_segment, target_count, pulse_percent, schedule_time, content, updated_at, created_at
      FROM campaigns
      WHERE deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 120`,
    );
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      status: String(row.status || 'Draft'),
      audience_segment: String(row.audience_segment || 'ALL_USERS'),
      target_count: Number(row.target_count || 0),
      pulse_percent: Number(row.pulse_percent || 0),
      schedule_time: row.schedule_time ? String(row.schedule_time) : null,
      content: row.content ? String(row.content) : null,
      updated_at: String(row.updated_at || ''),
      created_at: String(row.created_at || ''),
    })) as CampaignRow[];
  } catch {
    return [];
  }
}

export default async function AdminMarketingPage() {
  const [campaigns, integrations, settings] = await Promise.all([
    listCampaigns(),
    listIntegrationsForPage(),
    readAdminSetting<MarketingSettings>('marketing_settings', {
      metaPixelId: '',
      ga4Id: '',
      seoTitleTemplate: '%product% | SPLARO',
      seoDescriptionTemplate: 'Premium imported footwear & bags by SPLARO.',
      announcementBar: '',
      emailCampaignEnabled: false,
    }),
  ]);

  const marketingIntegrations = integrations.filter((row) => row.category === 'MARKETING & ANALYTICS');

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="admin-kicker">Marketing</p>
            <h2 className="admin-heading mt-2 text-[#f6e8ca]">Campaigns & Growth</h2>
            <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
              Build lifecycle campaigns, control storefront SEO copy and keep attribution channels connected.
            </p>
          </div>
          <a href="/admin/integrations" className="admin-button admin-button-secondary">
            Manage Integrations
          </a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {marketingIntegrations.map((integration) => (
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
        <p className="admin-kicker">Campaign Builder</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Create Campaign</h3>
        <form action={createCampaignAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="admin-input" name="name" placeholder="Campaign name" required />
          <select className="admin-select" name="audience_segment" defaultValue="ALL_USERS">
            <option value="ALL_USERS">All users</option>
            <option value="NEW_SIGNUPS_7D">New users (7d)</option>
            <option value="INACTIVE_30D">Inactive users (30d)</option>
          </select>
          <input className="admin-input" name="schedule_time" type="datetime-local" />
          <input className="admin-input" name="content" placeholder="Campaign message" />
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Create Campaign
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">SEO & Tracking</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Marketing Settings</h3>
        <form action={saveMarketingSettingsAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="admin-input" name="metaPixelId" defaultValue={settings.metaPixelId || ''} placeholder="Meta Pixel ID" />
          <input className="admin-input" name="ga4Id" defaultValue={settings.ga4Id || ''} placeholder="GA4 Measurement ID" />
          <input
            className="admin-input md:col-span-2"
            name="seoTitleTemplate"
            defaultValue={settings.seoTitleTemplate || ''}
            placeholder="SEO title template"
          />
          <input
            className="admin-input md:col-span-2"
            name="seoDescriptionTemplate"
            defaultValue={settings.seoDescriptionTemplate || ''}
            placeholder="SEO description template"
          />
          <input
            className="admin-input md:col-span-2 xl:col-span-3"
            name="announcementBar"
            defaultValue={settings.announcementBar || ''}
            placeholder="Announcement bar text"
          />
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
            <input
              type="checkbox"
              name="emailCampaignEnabled"
              defaultChecked={Boolean(settings.emailCampaignEnabled)}
              className="h-4 w-4"
            />
            Email campaigns enabled
          </label>
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Save Marketing Settings
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="mb-4">
          <p className="admin-kicker">Campaign Registry</p>
          <h3 className="text-lg font-semibold text-[#f3e5c2]">Active + Draft Campaigns</h3>
        </div>

        <div className="overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[940px] text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Campaign</th>
                <th className="px-3 py-3 text-left">Audience</th>
                <th className="px-3 py-3 text-left">Target / Pulse</th>
                <th className="px-3 py-3 text-left">Schedule</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-[#2a2317]">
                  <td className="px-3 py-3 text-[#e7d8b8]">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-[#8f826a]">{campaign.content || 'No content yet'}</p>
                  </td>
                  <td className="px-3 py-3 text-[#d6c29b]">{campaign.audience_segment}</td>
                  <td className="px-3 py-3 text-[#c5b08a]">
                    {campaign.target_count} users
                    <p className="text-xs text-[#8f826a]">Pulse: {campaign.pulse_percent}%</p>
                  </td>
                  <td className="px-3 py-3 text-[#bba679]">
                    {campaign.schedule_time ? new Date(campaign.schedule_time).toLocaleString() : 'Not scheduled'}
                  </td>
                  <td className="px-3 py-3">
                    <span className="admin-status-warn rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <form action={updateCampaignStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={campaign.id} />
                      <select className="admin-select min-w-[140px]" name="status" defaultValue={campaign.status}>
                        <option value="Draft">Draft</option>
                        <option value="Active">Active</option>
                        <option value="Paused">Paused</option>
                        <option value="Completed">Completed</option>
                      </select>
                      <button type="submit" className="admin-button admin-button-secondary">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#8c8069]">
                    No campaigns available.
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
