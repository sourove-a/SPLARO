'use client'

import Link from 'next/link'
import { Globe, CreditCard, Store, Users } from 'lucide-react'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useSaaS } from '@/lib/api/hooks'

const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--admin-table-row-border)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid var(--admin-table-row-border)' }

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="settings-card admin-panel-glass-subtle admin-module-kpi">
      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function ErrorBanner() {
  return <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>SaaS API offline — start pnpm dev:api</div>
}

export function SaaSModulePanel({ moduleHref }: ModuleContextProps) {
  const { data, isError, isLoading } = useSaaS()

  if (isError) return <ErrorBanner />

  const store = data?.store
  const sub = data?.subscription

  if (moduleHref === '/dashboard/stores') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <KpiCard label="Stores" value={isLoading ? '…' : data?.stats.stores ?? 0} />
          <KpiCard label="Staff" value={isLoading ? '…' : data?.stats.staff ?? 0} />
          <KpiCard label="Plan" value={sub?.plan ?? '—'} />
          <KpiCard label="Status" value={store?.isActive ? 'Live' : 'Inactive'} />
        </div>
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div className="admin-module-icon-ring">
              <Store style={{ width: 15, height: 15 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Primary store</p>
          </div>
          <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--admin-text-primary)', margin: '0 0 4px' }}>{store?.name ?? '—'}</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '0 0 4px' }}>{store?.domain} · {store?.isActive ? 'Live' : 'Inactive'}</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>Owner: {store?.owner.firstName} {store?.owner.lastName} ({store?.owner.email})</p>
          <Link href="/dashboard/settings" className="admin-catalog-action inline-flex">
            Manage store
          </Link>
        </div>
      </div>
    )
  }

  if (moduleHref === '/dashboard/domains') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className="admin-module-icon-ring">
              <Globe style={{ width: 15, height: 15 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Connected domains</p>
          </div>
          <div className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)', marginBottom: 10 }}>
            {store?.domain ?? '—'} · SSL valid · Primary
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>Timezone: {store?.timezone} · Currency: {store?.currency}</p>
        </div>
      </div>
    )
  }

  if (moduleHref === '/dashboard/saas-subscriptions' || moduleHref === '/dashboard/billing') {
    return (
      <div className="settings-section-enter" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <div className="admin-module-icon-ring" style={{ marginBottom: 12 }}>
            <CreditCard style={{ width: 15, height: 15 }} />
          </div>
          <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current plan</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--admin-text-primary)', margin: '0 0 6px' }}>{sub?.plan ?? '—'}</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>MRR {sub?.mrr ?? '৳0'} · Status {sub?.status ?? '—'}</p>
          {sub?.periodEnd ? <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>Period ends: {new Date(sub.periodEnd).toLocaleDateString()}</p> : null}
        </div>
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', marginBottom: 10 }}>Billing history</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0, lineHeight: 1.6 }}>
            {moduleHref === '/dashboard/billing'
              ? 'Enterprise license — no external invoices for self-hosted SPLARO stack.'
              : 'Subscription managed internally for SPLARO Commerce OS.'}
          </p>
        </div>
      </div>
    )
  }

  if (moduleHref === '/dashboard/tenants') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <KpiCard label="Tenants" value={isLoading ? '…' : data?.tenants.length ?? 0} />
          <KpiCard label="Active" value={isLoading ? '…' : data?.tenants.filter((t) => t.status === 'active').length ?? 0} />
          <KpiCard label="Enterprise" value={isLoading ? '…' : data?.tenants.filter((t) => t.plan === 'Enterprise').length ?? 0} />
          <KpiCard label="Total users" value={isLoading ? '…' : data?.tenants.reduce((s, t) => s + t.users, 0) ?? 0} />
        </div>
        <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Tenant', 'Domain', 'Plan', 'Users', 'Status'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {(data?.tenants ?? []).map((t) => (
                  <tr key={t.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{t.name}</td>
                    <td style={TD}>{t.domain}</td>
                    <td style={TD}>{t.plan}</td>
                    <td style={TD}>{t.users}</td>
                    <td style={TD}>
                      <span style={{ background: t.status === 'active' ? 'rgba(22,163,74,0.10)' : 'rgba(245,158,11,0.10)', border: `1px solid ${t.status === 'active' ? 'rgba(22,163,74,0.30)' : 'rgba(245,158,11,0.30)'}`, color: t.status === 'active' ? '#15803D' : '#B45309', borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-card admin-panel-glass" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="admin-module-icon-ring" style={{ width: 42, height: 42, borderRadius: 12 }}>
        <Users style={{ width: 18, height: 18 }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>SaaS</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>Multi-tenant control for SPLARO Commerce OS.</p>
    </div>
  )
}
