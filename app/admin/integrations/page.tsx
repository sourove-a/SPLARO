import { Activity, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import { getIntegrationsSnapshot } from '../_lib/data';

const statusMeta: Record<string, { className: string; label: string; icon: any }> = {
  CONNECTED: { className: 'admin-status-ok', label: 'Connected', icon: CheckCircle2 },
  DEGRADED: { className: 'admin-status-warn', label: 'Degraded', icon: AlertTriangle },
  DISCONNECTED: { className: 'admin-status-down', label: 'Disconnected', icon: Activity },
};

export default async function AdminIntegrationsPage() {
  const integrations = await getIntegrationsSnapshot();

  const groups = Array.from(new Set(integrations.map((item) => item.category)));

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <p className="admin-kicker">Integrations Matrix</p>
        <h2 className="admin-heading mt-2 text-[#f5e8cb]">All Integrations</h2>
        <p className="mt-3 text-sm text-[#9c917c] max-w-3xl">
          Live health and configuration visibility for messaging, payments, logistics, analytics and infrastructure.
        </p>
        <div className="mt-4 rounded-xl border border-[#3a311f] bg-[#0f0d0a] p-4 text-xs text-[#9d9078]">
          <p>Use queue metrics (`pending/retry/dead`) to detect delivery bottlenecks before customer experience is impacted.</p>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group} className="space-y-3">
          <div className="flex items-center gap-2 text-[#dec89a]">
            <Link2 className="h-4 w-4" />
            <h3 className="text-sm uppercase tracking-[0.24em] font-semibold">{group}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {integrations
              .filter((item) => item.category === group)
              .map((integration) => {
                const meta = statusMeta[integration.status] || statusMeta.DISCONNECTED;
                const Icon = meta.icon;
                return (
                  <article key={integration.key} className="admin-panel-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#998c74]">{integration.key}</p>
                        <h4 className="mt-1 text-base font-semibold text-[#f3e5c2]">{integration.name}</h4>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${meta.className}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-[#9b8e78] leading-relaxed">{integration.hint}</p>

                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg border border-[#322916] bg-[#100d08] py-2">
                        <dt className="text-[#8e826d]">Pending</dt>
                        <dd className="mt-1 text-[#f3e1bb] font-semibold">{integration.pending}</dd>
                      </div>
                      <div className="rounded-lg border border-[#322916] bg-[#100d08] py-2">
                        <dt className="text-[#8e826d]">Retry</dt>
                        <dd className="mt-1 text-[#f3e1bb] font-semibold">{integration.retry}</dd>
                      </div>
                      <div className="rounded-lg border border-[#322916] bg-[#100d08] py-2">
                        <dt className="text-[#8e826d]">Dead</dt>
                        <dd className="mt-1 text-[#f3e1bb] font-semibold">{integration.dead}</dd>
                      </div>
                    </dl>

                    <p className="mt-4 text-[11px] text-[#7f7564]">
                      {integration.enabled ? 'Enabled' : 'Disabled'} • Last update: {new Date(integration.lastUpdatedAt).toLocaleString()}
                    </p>
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
