'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Crown, Gift, PieChart, RefreshCw, Search, Share2, Sparkles, Users } from 'lucide-react'
import { ApiOfflineHint } from '@/components/modules/PlatformUi'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useCustomers, useLoyaltySummary, useReferralStats, useReferrals } from '@/lib/api/hooks'
import type { ApiCustomer } from '@/lib/api/customers'
import { formatBDT } from '@/lib/utils/currency'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GOLD = '#c8a97e'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


// ─── Tier config ───────────────────────────────────────────────────────────────
const TIER_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  BRONZE:   { bg: 'rgba(205,127,50,0.10)',  text: '#9A5A1A', border: 'rgba(205,127,50,0.30)' },
  SILVER:   { bg: 'rgba(154,154,154,0.10)', text: '#5A5A5A', border: 'rgba(154,154,154,0.30)' },
  GOLD:     { bg: 'rgba(200,169,126,0.12)', text: '#8B6914', border: 'rgba(200,169,126,0.36)' },
  PLATINUM: { bg: 'rgba(123,143,161,0.10)', text: '#3D5A73', border: 'rgba(123,143,161,0.30)' },
  DIAMOND:  { bg: 'rgba(91,164,207,0.10)',  text: '#1A6A9A', border: 'rgba(91,164,207,0.30)' },
}

function spent(c: ApiCustomer) {
  return Number(c.totalSpent) || 0
}

// ─── Shared components ─────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const fallback = { bg: 'rgba(205,127,50,0.10)', text: '#9A5A1A', border: 'rgba(205,127,50,0.30)' }
  const t = TIER_COLOR[tier] ?? fallback
  return (
    <span style={{
      background: t.bg,
      border: `1px solid ${t.border}`,
      color: t.text,
      borderRadius: 8,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.04em',
    }}>
      {tier}
    </span>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const accentColor = accent === 'gold' ? GOLD : accent === 'success' ? '#16A34A' : accent === 'warning' ? '#D97706' : '#6366F1'
  const accentBg = accent === 'gold' ? GOLD_LIGHT : accent === 'success' ? 'rgba(22,163,74,0.08)' : accent === 'warning' ? 'rgba(217,119,6,0.08)' : 'rgba(99,102,241,0.08)'
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`,
      }} />
      <div style={{ width: 32, height: 32, borderRadius: 9, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: accentColor }} />
      </div>
      <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--admin-text-primary)', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  )
}

function KpiStrip({ items }: { items: [string, string | number, string?][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12 }}>
      {items.map(([label, value, accent]) => (
        <KpiCard key={label} label={label} value={value} {...(accent !== undefined ? { accent } : {})} />
      ))}
    </div>
  )
}

function PanelHeader({ icon: Icon, title, onRefresh }: { icon: React.ElementType; title: string; onRefresh?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 18, height: 18, color: GOLD }} strokeWidth={2} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</h3>
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--admin-text-muted)' }}>
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  )
}

function GlassSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', maxWidth: 380 }}>
      <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--admin-text-muted)', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        style={{
          width: '100%',
          paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.80)',
          borderRadius: 12,
          fontSize: 13, fontWeight: 600,
          color: 'var(--admin-text-primary)',
          outline: 'none',
          backdropFilter: 'blur(8px)',
        }}
      />
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint, action }: { icon: React.ElementType; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 24, height: 24, color: GOLD }} strokeWidth={1.6} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)', maxWidth: 360, lineHeight: 1.5, margin: 0 }}>{hint}</p>
      {action}
    </div>
  )
}

function CustomerRow({ c }: { c: ApiCustomer }) {
  const initials = `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() || 'C'
  const isRisk = c.codRiskScore >= 60
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderLeft: `3px solid ${isRisk ? '#EF4444' : GOLD}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: isRisk ? 'rgba(239,68,68,0.10)' : GOLD_LIGHT,
          border: `1px solid ${isRisk ? 'rgba(239,68,68,0.25)' : GOLD_BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900, color: isRisk ? '#B91C1C' : '#8B6914',
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>
            {c.firstName} {c.lastName}
          </p>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>
            {c.totalOrders} orders · {formatBDT(spent(c))} · {c.phone}
          </p>
        </div>
      </div>
      <TierBadge tier={c.loyaltyTier} />
    </div>
  )
}

// ─── VIP Members ───────────────────────────────────────────────────────────────
function VipMembersView({ customers }: { customers: ApiCustomer[] }) {
  const vip = useMemo(
    () => customers.filter((c) => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM' || c.loyaltyTier === 'DIAMOND'),
    [customers],
  )
  const [query, setQuery] = useState('')
  const filtered = vip.filter((c) =>
    `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={Crown} title="VIP Members" />
        <KpiStrip items={[
          ['VIP members', vip.length, 'gold'],
          ['Diamond', vip.filter((c) => c.loyaltyTier === 'DIAMOND').length, 'default'],
          ['Platinum', vip.filter((c) => c.loyaltyTier === 'PLATINUM').length, 'default'],
          ['VIP revenue', formatBDT(vip.reduce((s, c) => s + spent(c), 0)), 'success'],
        ]} />
      </div>

      <GlassSearch value={query} onChange={setQuery} placeholder="Search VIP members…" />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Crown}
          title="No VIP members yet"
          hint="Customers reach Gold, Platinum, or Diamond tiers from repeat orders. Tiers update automatically from live order data."
          action={
            <Link href="/dashboard/customers" style={{
              background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914',
              borderRadius: 10, padding: '8px 20px', fontSize: 12, fontWeight: 800,
              textDecoration: 'none', display: 'inline-block',
            }}>
              View all customers
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((c) => <CustomerRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}

// ─── Loyalty Program ──────────────────────────────────────────────────────────
function LoyaltyProgramView({ customers }: { customers: ApiCustomer[] }) {
  const { data: loyalty, isError: loyaltyOffline, isLoading: loyaltyLoading } = useLoyaltySummary()

  const tiers = useMemo(() => {
    if (loyalty?.tierBreakdown?.length) {
      return loyalty.tierBreakdown
        .map((row) => [row.tier, { count: row.count, revenue: 0 }] as const)
        .sort((a, b) => b[1].count - a[1].count)
    }
    const map = new Map<string, { count: number; revenue: number }>()
    for (const c of customers) {
      const row = map.get(c.loyaltyTier) ?? { count: 0, revenue: 0 }
      row.count += 1
      row.revenue += spent(c)
      map.set(c.loyaltyTier, row)
    }
    return [...map.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
  }, [customers, loyalty])

  const enrolled = loyalty?.totalCustomers ?? customers.length
  const totalPoints = loyalty?.totalPointsIssued ?? customers.reduce((s, c) => s + (c.loyaltyPoints ?? 0), 0)
  const avgOrders = customers.length > 0
    ? (customers.reduce((s, c) => s + c.totalOrders, 0) / customers.length).toFixed(1)
    : '0'
  const totalClv = customers.reduce((s, c) => s + spent(c), 0)

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {loyaltyOffline ? (
        <ApiOfflineHint message="Loyalty API offline — tier counts may be incomplete until pnpm dev:api runs." />
      ) : null}
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={Gift} title="Loyalty Program" />
        <KpiStrip items={[
          ['Enrolled', loyaltyLoading ? '…' : enrolled, 'default'],
          ['Points issued', loyaltyLoading ? '…' : totalPoints.toLocaleString(), 'default'],
          ['Avg orders', avgOrders, 'default'],
          ['Repeat buyers', customers.filter((c) => c.totalOrders >= 2).length, 'success'],
          ['Total CLV', formatBDT(totalClv), 'gold'],
        ]} />
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gift style={{ width: 14, height: 14, color: GOLD }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Tier breakdown (live)</p>
        </div>
        {tiers.length === 0 ? (
          <p style={{ padding: '24px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No loyalty data yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
                {['Tier', 'Members', 'Revenue'].map((h) => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers.map(([tier, stats]) => (
                <tr key={tier} style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                  <td style={{ padding: '12px 24px' }}><TierBadge tier={tier} /></td>
                  <td style={{ padding: '12px 24px', fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)' }}>{stats.count}</td>
                  <td style={{ padding: '12px 24px', fontSize: 14, fontWeight: 800, color: GOLD }}>
                    {'revenue' in stats && stats.revenue > 0 ? formatBDT(stats.revenue) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Referrals ────────────────────────────────────────────────────────────────
function ReferralsView() {
  const { data: stats, isError: statsOffline, isLoading: statsLoading } = useReferralStats()
  const { data: list, isError: listOffline, isLoading: listLoading } = useReferrals({ limit: 50 })
  const referrals = list?.items ?? []
  const isOffline = statsOffline || listOffline
  const isLoading = statsLoading || listLoading

  if (isOffline && !isLoading) return (
    <div className="settings-card admin-panel-glass" style={{ padding: 24, borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>
      Referral API offline — start pnpm dev:api
    </div>
  )

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {isOffline ? (
        <ApiOfflineHint message="Referral API partially offline — counts may be stale." />
      ) : null}
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={Share2} title="Customer Referrals" />
        <KpiStrip items={[
          ['Total referrals', isLoading ? '…' : (stats?.total ?? referrals.length), 'default'],
          ['Converted', isLoading ? '…' : (stats?.converted ?? 0), 'success'],
          ['Conversion rate', isLoading ? '…' : `${stats?.conversionRate ?? 0}%`, 'default'],
          ['Reward points', isLoading ? '…' : (stats?.totalRewardPoints ?? 0).toLocaleString(), 'gold'],
        ]} />
      </div>

      {referrals.length === 0 && !isLoading ? (
        <EmptyState
          icon={Share2}
          title="No referrals yet"
          hint="Customer referral links will appear here once shoppers invite friends."
        />
      ) : (
        <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
                {['Referrer', 'Referred', 'Status', 'Points', 'Date'].map((h) => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referrals.map((row) => {
                const referrer = row.referrer
                const referrerName = referrer
                  ? [referrer.firstName, referrer.lastName].filter(Boolean).join(' ') || referrer.phone || 'Customer'
                  : '—'
                const referred = row.referredEmail || row.referredPhone || '—'
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                    <td style={{ padding: '12px 24px', fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{referrerName}</td>
                    <td style={{ padding: '12px 24px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>{referred}</td>
                    <td style={{ padding: '12px 24px', fontSize: 12, fontWeight: 800, color: row.isConverted ? '#15803D' : 'var(--admin-text-muted)' }}>
                      {row.isConverted ? 'Converted' : 'Pending'}
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: 13, fontWeight: 800, color: GOLD }}>{row.rewardPoints ?? 0}</td>
                    <td style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Segments ─────────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 'high-value', label: 'High value', test: (c: ApiCustomer) => spent(c) >= 10_000 },
  { id: 'repeat',    label: 'Repeat buyers', test: (c: ApiCustomer) => c.totalOrders >= 3 },
  { id: 'at-risk',   label: 'COD at risk', test: (c: ApiCustomer) => c.codRiskScore >= 60 },
  { id: 'new',       label: 'First-time', test: (c: ApiCustomer) => c.totalOrders === 1 },
] as const

function SegmentsView({ customers }: { customers: ApiCustomer[] }) {
  const [active, setActive] = useState<(typeof SEGMENTS)[number]['id']>('high-value')
  const segment = SEGMENTS.find((s) => s.id === active)!
  const members = useMemo(() => customers.filter(segment.test), [customers, segment])

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={PieChart} title="Customer Segments" />
        <KpiStrip items={SEGMENTS.map((s) => [s.label, customers.filter(s.test).length, 'default'] as [string, number, string])} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SEGMENTS.map((s) => {
          const isActive = active === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              style={{
                background: isActive ? GOLD_LIGHT : 'rgba(255,255,255,0.7)',
                border: `1px solid ${isActive ? GOLD_BORDER : 'rgba(255,255,255,0.8)'}`,
                color: isActive ? '#8B6914' : 'var(--admin-text-secondary)',
                borderRadius: 10, padding: '7px 16px',
                fontSize: 12, fontWeight: 800,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {s.label} · {customers.filter(s.test).length}
            </button>
          )
        })}
      </div>

      {members.length === 0 ? (
        <div className="settings-card admin-panel-glass-subtle" style={{ padding: 24, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
          No customers in this segment.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.slice(0, 20).map((c) => <CustomerRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}

// ─── Customer Intelligence ────────────────────────────────────────────────────
function CustomerIntelligenceView({ customers }: { customers: ApiCustomer[] }) {
  const top = useMemo(() => [...customers].sort((a, b) => spent(b) - spent(a)).slice(0, 10), [customers])
  const repeatRate = customers.length > 0
    ? Math.round((customers.filter((c) => c.totalOrders >= 2).length / customers.length) * 100)
    : 0
  const avgClv = customers.length > 0 ? customers.reduce((s, c) => s + spent(c), 0) / customers.length : 0
  const atRisk = customers.filter((c) => c.codRiskScore >= 60).length

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={Sparkles} title="Customer Intelligence" />
        <KpiStrip items={[
          ['Customers', customers.length, 'default'],
          ['Repeat rate', `${repeatRate}%`, 'success'],
          ['Avg CLV', formatBDT(avgClv), 'gold'],
          ['COD risk', atRisk, 'warning'],
        ]} />
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users style={{ width: 16, height: 16, color: GOLD }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Top customers by spend</p>
        </div>
        {top.length === 0 ? (
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Intelligence builds as orders come in.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top.map((c) => <CustomerRow key={c.id} c={c} />)}
          </div>
        )}
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart style={{ width: 16, height: 16, color: GOLD }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Insights</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Customers with 3+ orders', value: customers.filter((c) => c.totalOrders >= 3).length },
            { label: 'High-value accounts (৳10k+)', value: customers.filter((c) => spent(c) >= 10_000).length },
            { label: 'Profiles flagged for COD risk review', value: atRisk },
          ].map(({ label, value }) => (
            <div key={label} className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-secondary)', margin: 0 }}>{label}</p>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export function GrowthModulePanel({ moduleHref }: ModuleContextProps) {
  const { data, isLoading, isError } = useCustomers({ limit: 200 })
  const customers = data?.customers ?? []

  if (isError) return (
    <div className="settings-card admin-panel-glass" style={{ padding: 24, borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>
      Customer API offline — start pnpm dev:api
    </div>
  )
  if (isLoading) return (
    <div className="settings-card admin-panel-glass" style={{ padding: 24, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
      Loading customer data…
    </div>
  )

  if (moduleHref === '/dashboard/vip-members')          return <VipMembersView customers={customers} />
  if (moduleHref === '/dashboard/loyalty-program')      return <LoyaltyProgramView customers={customers} />
  if (moduleHref === '/dashboard/referrals')            return <ReferralsView />
  if (moduleHref === '/dashboard/segments')             return <SegmentsView customers={customers} />
  if (moduleHref === '/dashboard/customer-intelligence') return <CustomerIntelligenceView customers={customers} />

  return <VipMembersView customers={customers} />
}
