'use client'

import { Fragment, useMemo, useState } from 'react'
import { refreshWithToast, toastNotImplemented } from '@/lib/admin/feedback'
import { ChevronDown, Copy, Megaphone, Plus, RefreshCw, Search, TrendingUp } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { formatBDT } from '@/lib/utils/currency'
import { useCampaigns } from '@/lib/api/hooks'
import { mapCampaignStatus } from '@/lib/api/marketing'
import { formatRelativeTime } from '@/lib/api/orders'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { CouponsLivePanel } from '@/components/modules/CouponsLivePanel'
import { WhatsAppPanelLive, AffiliatePanelLive, InfluencersPanelLive } from '@/components/modules/MarketingLivePanels'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.4)' }

// ─── Shared ────────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  live:        { bg: 'rgba(22,163,74,0.10)',  text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  active:      { bg: 'rgba(22,163,74,0.10)',  text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  scheduled:   { bg: 'rgba(59,130,246,0.10)', text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
  draft:       { bg: 'rgba(245,158,11,0.10)', text: '#B45309', border: 'rgba(245,158,11,0.30)' },
  ended:       { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' },
  archived:    { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' },
}

function StatusPill({ value }: { value: string }) {
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = STATUS_MAP[value.toLowerCase()] ?? fallback
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{value}</span>
}

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const accentColor = accent === 'gold' ? GOLD : accent === 'success' ? '#16A34A' : accent === 'warning' ? '#D97706' : '#6366F1'
  const accentBg = accent === 'gold' ? GOLD_LIGHT : accent === 'success' ? 'rgba(22,163,74,0.08)' : accent === 'warning' ? 'rgba(217,119,6,0.08)' : 'rgba(99,102,241,0.08)'
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
      <div style={{ width: 28, height: 28, borderRadius: 8, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
      </div>
      <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--admin-text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

// ─── Campaigns ─────────────────────────────────────────────────────────────────
type CampaignStatus = 'draft' | 'scheduled' | 'live' | 'ended'

interface CampaignRow {
  id: string; name: string; channels: string[]
  budget: number; spent: number; reach: number; conversions: number
  roi: string; status: CampaignStatus; period: string
}

function CampaignsPanel() {
  const { data: campaigns = [], isLoading, isError, refetch } = useCampaigns()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows: CampaignRow[] = campaigns.map((c) => ({
    id: c.id, name: c.name, channels: [c.type],
    budget: 0, spent: 0, reach: c.totalSent, conversions: c.totalClicked,
    roi: c.totalSent > 0 && c.totalClicked > 0 ? `${(c.totalClicked / Math.max(c.totalSent, 1)).toFixed(1)}% CTR` : '—',
    status: mapCampaignStatus(c.status),
    period: c.sentAt ? formatRelativeTime(c.sentAt) : c.scheduledAt ? `Scheduled ${c.scheduledAt.slice(0, 10)}` : c.createdAt.slice(0, 10),
  }))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((c) => {
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || c.status === statusFilter
      return matchQ && matchS
    })
  }, [query, statusFilter, rows])

  const totalReach = rows.reduce((s, c) => s + c.reach, 0)
  const totalConv = rows.reduce((s, c) => s + c.conversions, 0)

  if (isError) return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>
      API offline — start backend on :4000. No fake campaigns are shown.
    </div>
  )

  const TABS = ['all', 'live', 'scheduled', 'draft', 'ended'] as const

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* KPIs */}
      <div className="settings-card admin-panel-glass" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone style={{ width: 18, height: 18, color: GOLD }} strokeWidth={2} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>Campaigns</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <KpiCard label="Active campaigns" value={rows.filter((c) => c.status === 'live').length} accent="success" />
          <KpiCard label="Total sent" value={totalReach.toLocaleString('en-BD')} accent="gold" />
          <KpiCard label="Clicks" value={totalConv.toLocaleString('en-BD')} />
          <KpiCard label="In database" value={rows.length} accent="success" />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--admin-text-muted)', pointerEvents: 'none' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaign name or ID…" className="admin-catalog-input" style={{ width: '100%', paddingLeft: 36, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => toastNotImplemented('New campaign')} style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus style={{ width: 13, height: 13 }} /> New campaign
            </button>
            <button type="button" onClick={() => void refreshWithToast(refetch, 'Campaigns refreshed')} className="admin-catalog-action" style={{ padding: '8px 12px', cursor: 'pointer'  }}>
              <RefreshCw style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TABS.map((t) => {
            const count = t === 'all' ? rows.length : rows.filter((c) => c.status === t).length
            return (
              <button key={t} type="button" onClick={() => setStatusFilter(t as CampaignStatus | 'all')} style={{
                background: statusFilter === t ? GOLD_LIGHT : 'rgba(255,255,255,0.7)',
                border: `1px solid ${statusFilter === t ? GOLD_BORDER : 'rgba(255,255,255,0.8)'}`,
                color: statusFilter === t ? '#8B6914' : 'var(--admin-text-secondary)',
                borderRadius: 9, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
              }}>
                {t === 'all' ? 'All' : t} · {count}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone style={{ width: 13, height: 13, color: GOLD }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>
            {isLoading ? 'Campaigns · loading…' : `Campaigns · ${filtered.length} results`}
          </p>
        </div>
        {isLoading ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading campaigns…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No campaigns yet. Create one to reach customers via email, SMS, or push.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Campaign', 'Channels', 'Budget', 'Spent', 'Reach', 'Conv.', 'ROI', 'Status', 'Period', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <Fragment key={c.id}>
                    <tr style={{ background: expandedId === c.id ? 'rgba(255,255,255,0.45)' : 'transparent' }}>
                      <td style={TD}>
                        <button type="button" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--admin-text-primary)', padding: 0, fontSize: 13 }}>
                          {c.name}
                          <ChevronDown style={{ width: 12, height: 12, transition: 'transform 0.2s', transform: expandedId === c.id ? 'rotate(180deg)' : 'none' }} />
                        </button>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text-muted)' }}>{c.id}</span>
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {c.channels.map((ch) => (
                            <span key={ch} style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{ch}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...TD, fontWeight: 600 }}>{formatBDT(c.budget)}</td>
                      <td style={{ ...TD, fontWeight: 700, color: c.spent > c.budget * 0.9 && c.spent > 0 ? '#D97706' : 'inherit' }}>{c.spent ? formatBDT(c.spent) : '—'}</td>
                      <td style={TD}>{c.reach ? c.reach.toLocaleString() : '—'}</td>
                      <td style={{ ...TD, fontWeight: 900 }}>{c.conversions || '—'}</td>
                      <td style={{ ...TD, fontWeight: 700, color: GOLD }}>{c.roi}</td>
                      <td style={TD}><StatusPill value={c.status} /></td>
                      <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{c.period}</td>
                      <td style={TD}><RowActionsMenu recordName={c.name} moduleHref="/dashboard/campaigns" recordId={c.id} /></td>
                    </tr>
                    {expandedId === c.id && (
                      <tr>
                        <td colSpan={10} style={{ ...TD, background: 'rgba(255,255,255,0.35)', padding: '12px 20px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {c.status === 'draft' && (
                              <AdminButton variant="gold" className="!text-xs" onClick={() => toastNotImplemented('Schedule campaign')}>Schedule launch</AdminButton>
                            )}
                            {c.status === 'live' && (
                              <AdminButton className="!text-xs" onClick={() => toastNotImplemented('Pause campaign')}>
                                <TrendingUp className="h-3.5 w-3.5" /> Pause
                              </AdminButton>
                            )}
                            <AdminButton className="!text-xs" onClick={() => toastNotImplemented('Campaign analytics')}>
                              <TrendingUp className="h-3.5 w-3.5" /> Analytics
                            </AdminButton>
                            <AdminButton className="!text-xs" onClick={() => { void navigator.clipboard?.writeText(c.id); toastNotImplemented('Duplicate campaign') }}>
                              <Copy className="h-3.5 w-3.5" /> Duplicate
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
          {isLoading ? 'Loading campaigns…' : `Showing ${filtered.length} of ${rows.length} campaigns — live API`}
        </div>
      </div>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/campaigns':   CampaignsPanel,
  '/dashboard/coupons':     CouponsLivePanel,
  '/dashboard/whatsapp':    WhatsAppPanelLive,
  '/dashboard/affiliate':   AffiliatePanelLive,
  '/dashboard/influencers': InfluencersPanelLive,
}

export function MarketingModulePanel(props: ModuleContextProps) {
  const Panel = PANELS[props.moduleHref]
  return renderModuleSubPanel(Panel, props)
}
