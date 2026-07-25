'use client'

import { Fragment, useMemo, useState } from 'react'
import { refreshWithToast, toastFail } from '@/lib/admin/feedback'
import { copyWithToast } from '@/lib/admin/clipboard'
import {
  confirmCampaignCreated,
  confirmCampaignDeleted,
  confirmCampaignDuplicated,
  confirmCampaignSent,
} from '@/lib/admin/marketing-save'
import { ChevronDown, Copy, Megaphone, Plus, RefreshCw, Search, Send, Trash2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminStatusBadge, type AdminBadgeTone } from '@/components/ui/AdminStatusBadge'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { useCampaigns, useCampaignStats, useCreateCampaign, useDeleteCampaign, useDuplicateCampaign, useSendCampaign } from '@/lib/api/hooks'
import { formatCampaignType, mapCampaignStatus } from '@/lib/api/marketing'
import { formatRelativeTime } from '@/lib/api/orders'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'
import { cn } from '@/lib/utils/cn'
import { CouponsLivePanel } from '@/components/modules/CouponsLivePanel'
import { WhatsAppPanelLive, AffiliatePanelLive, InfluencersPanelLive } from '@/components/modules/MarketingLivePanels'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'

// ─── Shared ────────────────────────────────────────────────────────────────────
const CAMPAIGN_STATUS_TONE: Record<string, AdminBadgeTone> = {
  live: 'success',
  active: 'success',
  scheduled: 'info',
  draft: 'warning',
  ended: 'muted',
  archived: 'muted',
}

function StatusPill({ value }: { value: string }) {
  return <AdminStatusBadge label={value} tone={CAMPAIGN_STATUS_TONE[value.toLowerCase()] ?? 'muted'} />
}

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const tone =
    accent === 'success' ? 'success' : accent === 'warning' ? 'warning' : accent === 'gold' ? 'gold' : undefined
  return (
    <div className={cn('admin-kpi-card', tone && `admin-kpi-card--${tone}`)}>
      <p className="admin-kpi-card__label">{label}</p>
      <div className="admin-kpi-card__row">
        <p className="admin-kpi-card__value">{value}</p>
      </div>
    </div>
  )
}

// ─── Campaigns ─────────────────────────────────────────────────────────────────
type CampaignStatus = 'draft' | 'scheduled' | 'live' | 'ended'
type CampaignType = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP'

interface CampaignRow {
  id: string
  name: string
  type: string
  channel: string
  sent: number
  opened: number
  clicked: number
  ctr: string
  status: CampaignStatus
  period: string
  rawStatus: string
}

function CampaignsPanel() {
  const { data: campaigns = [], isLoading, isError, refetch, isFetched } = useCampaigns()
  const { data: stats, isError: statsError } = useCampaignStats()
  const createCampaign = useCreateCampaign()
  const deleteCampaignMut = useDeleteCampaign()
  const duplicateCampaign = useDuplicateCampaign()
  const sendCampaignMut = useSendCampaign()

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'EMAIL' as CampaignType,
    subject: '',
    body: '',
  })

  const rows: CampaignRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    channel: formatCampaignType(c.type),
    sent: c.totalSent,
    opened: c.totalOpened,
    clicked: c.totalClicked,
    ctr: c.totalSent > 0 ? `${Math.round((c.totalClicked / c.totalSent) * 1000) / 10}%` : '—',
    status: mapCampaignStatus(c.status),
    period: c.sentAt
      ? formatRelativeTime(c.sentAt)
      : c.scheduledAt
        ? `Scheduled ${c.scheduledAt.slice(0, 10)}`
        : c.createdAt.slice(0, 10),
    rawStatus: c.status,
  }))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((c) => {
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.channel.toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || c.status === statusFilter
      return matchQ && matchS
    })
  }, [query, statusFilter, rows])

  const handleCreate = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      toastFail('Name and message body are required.')
      return
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      subject: form.subject.trim() || form.name.trim(),
      body: form.body.trim(),
    }
    const id = await confirmCampaignCreated(
      { name: payload.name, type: payload.type },
      () => createCampaign.mutateAsync(payload),
    )
    if (!id) return
    setForm({ name: '', type: 'EMAIL', subject: '', body: '' })
    setShowCreate(false)
    void refetch()
  }

  const handleSend = async (row: CampaignRow) => {
    if (!window.confirm(`Send "${row.name}" now? This queues delivery to your audience.`)) return
    const sent = await confirmCampaignSent(row.id, () => sendCampaignMut.mutateAsync(row.id))
    if (sent === null) return
    setExpandedId(null)
    void refetch()
  }

  const handleDuplicate = async (row: CampaignRow) => {
    const expectedName = `${row.name} (copy)`
    const id = await confirmCampaignDuplicated(expectedName, () => duplicateCampaign.mutateAsync(row.id))
    if (id) void refetch()
  }

  const handleDelete = async (row: CampaignRow) => {
    if (!window.confirm(`Delete campaign "${row.name}"? This cannot be undone.`)) return
    const ok = await confirmCampaignDeleted(row.id, () => deleteCampaignMut.mutateAsync(row.id))
    if (!ok) return
    setExpandedId(null)
    void refetch()
  }

  if (isError) {
    return <ApiOfflineBanner message="API offline — start backend on :4000. No fake campaigns are shown." />
  }

  const TABS = ['all', 'live', 'scheduled', 'draft', 'ended'] as const
  const busy = createCampaign.isPending || sendCampaignMut.isPending || duplicateCampaign.isPending || deleteCampaignMut.isPending

  return (
    <div className="admin-panel-page settings-section-enter space-y-4">
      <ModuleLiveStrip
        items={[
          {
            label: 'Campaigns API',
            value: isFetched ? `${rows.length} campaigns loaded` : 'Connecting…',
            ok: isFetched && !isError,
            hint: 'GET /marketing/campaigns',
            critical: true,
          },
          {
            label: 'Delivery stats',
            value: statsError ? 'Unreachable' : `${stats?.totalSent ?? 0} sent`,
            ok: !statsError && stats !== undefined,
            hint: stats ? `${stats.openRate}% open · ${stats.clickRate}% click` : 'GET /marketing/campaigns/stats',
          },
          {
            label: 'Active channels',
            value: stats?.byType?.map((t) => formatCampaignType(t.type)).join(', ') || '—',
            ok: (stats?.byType?.length ?? 0) > 0 || rows.length === 0,
            informational: true,
          },
        ]}
      />

      <div className="admin-catalog-hero admin-panel-hero">
        <div className="admin-catalog-hero__top">
          <div className="admin-catalog-hero__title-row">
            <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg">
              <Megaphone strokeWidth={2} />
            </div>
            <h1 className="admin-catalog-hero__title">Campaigns</h1>
          </div>
        </div>
        <div className="admin-kpi-grid admin-kpi-grid--catalog">
          <KpiCard label="Active" value={rows.filter((c) => c.status === 'live').length} accent="success" />
          <KpiCard label="Total sent" value={(stats?.totalSent ?? rows.reduce((s, c) => s + c.sent, 0)).toLocaleString('en-BD')} accent="gold" />
          <KpiCard label="Open rate" value={stats ? `${stats.openRate}%` : '—'} />
          <KpiCard label="In database" value={rows.length} accent="success" />
        </div>
      </div>

      {showCreate && (
        <div className="admin-catalog-hero admin-panel-hero !mb-0 grid gap-2.5 !p-4">
          <p className="m-0 text-xs font-extrabold text-[var(--admin-text-primary)]">New campaign</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <input className="admin-input" placeholder="Campaign name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select className="admin-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CampaignType }))}>
              {(['EMAIL'] as const).map((t) => (
                <option key={t} value={t}>{formatCampaignType(t)}</option>
              ))}
            </select>
            <input className="admin-input" placeholder="Subject / headline" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </div>
          <textarea className="admin-input" rows={3} placeholder="Message body…" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          <div className="flex gap-2">
            <AdminButton variant="primary" loading={createCampaign.isPending} onClick={() => void handleCreate()}>Save draft</AdminButton>
            <AdminButton variant="ghost" onClick={() => setShowCreate(false)}>Cancel</AdminButton>
          </div>
        </div>
      )}

      <div className="admin-catalog-toolbar">
        <div className="admin-catalog-toolbar__row">
          <div className="admin-catalog-toolbar__search">
            <Search className="admin-catalog-toolbar__search-icon" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaign name or ID…" className="admin-catalog-input" />
          </div>
          <div className="admin-catalog-toolbar__actions">
            <AdminButton variant="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> New campaign
            </AdminButton>
            <AdminButton variant="secondary" size="sm" onClick={() => void refreshWithToast(refetch, 'Campaigns refreshed')} aria-label="Refresh campaigns">
              <RefreshCw className="h-3.5 w-3.5" />
            </AdminButton>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const count = t === 'all' ? rows.length : rows.filter((c) => c.status === t).length
            return (
              <button
                key={t}
                type="button"
                onClick={() => setStatusFilter(t as CampaignStatus | 'all')}
                className={cn('admin-filter-pill capitalize', statusFilter === t && 'admin-filter-pill--active')}
              >
                {t === 'all' ? 'All' : t} · {count}
              </button>
            )
          })}
        </div>
      </div>

      <div className="admin-catalog-table-shell">
        <div className="admin-catalog-table-shell__head">
          <div className="admin-catalog-icon-ring">
            <Megaphone className="h-3.5 w-3.5" />
          </div>
          <p className="admin-catalog-table-shell__title">
            {isLoading ? 'Campaigns · loading…' : `Campaigns · ${filtered.length} results`}
          </p>
        </div>
        {isLoading ? (
          <p className="p-5 text-sm font-semibold text-[var(--admin-text-muted)]">Loading campaigns…</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm font-semibold text-[var(--admin-text-muted)]">No email campaigns yet. Create a discount campaign for customers who accepted marketing.</p>
        ) : (
          <div className="admin-catalog-table-shell__scroll overflow-x-auto">
            <table className="admin-catalog-data-table">
              <thead>
                <tr>{['Campaign', 'Channel', 'Sent', 'Opened', 'Clicks', 'CTR', 'Status', 'Period', ''].map((h) => <th key={h} className="admin-catalog-th">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const source = campaigns.find((x) => x.id === c.id)
                  return (
                    <Fragment key={c.id}>
                      <tr className={cn('admin-catalog-row', expandedId === c.id && 'admin-catalog-row--open')}>
                        <td className="admin-catalog-td">
                          <button type="button" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="flex items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-bold text-[var(--admin-text-primary)]">
                            {c.name}
                            <ChevronDown className={cn('h-3 w-3 transition-transform', expandedId === c.id && 'rotate-180')} />
                          </button>
                          <span className="font-mono text-[10px] text-[var(--admin-text-muted)]">{c.id.slice(0, 12)}…</span>
                        </td>
                        <td className="admin-catalog-td"><span className="rounded-md bg-black/5 px-2 py-0.5 text-[11px] font-bold">{c.channel}</span></td>
                        <td className="admin-catalog-td">{c.sent || '—'}</td>
                        <td className="admin-catalog-td">{c.opened || '—'}</td>
                        <td className="admin-catalog-td admin-catalog-td--strong">{c.clicked || '—'}</td>
                        <td className="admin-catalog-td font-bold text-[var(--admin-accent)]">{c.ctr}</td>
                        <td className="admin-catalog-td"><StatusPill value={c.status} /></td>
                        <td className="admin-catalog-td text-xs text-[var(--admin-text-muted)]">{c.period}</td>
                        <td className="admin-catalog-td">
                          <RowActionsMenu
                            recordName={c.name}
                            moduleHref="/dashboard/campaigns"
                            recordId={c.id}
                            actions={[
                              { label: 'View details', onClick: () => setExpandedId(c.id) },
                              ...(c.status === 'draft' || c.status === 'scheduled'
                                ? [{ label: 'Send now', onClick: () => void handleSend(c) }]
                                : []),
                              { label: 'Duplicate', onClick: () => void handleDuplicate(c) },
                              { label: 'Delete', tone: 'danger', onClick: () => void handleDelete(c) },
                            ]}
                          />
                        </td>
                      </tr>
                      {expandedId === c.id && (
                        <tr>
                          <td colSpan={9} className="admin-catalog-td bg-[rgba(113,46,255,0.03)] px-5 py-3">
                            {source?.subject && (
                              <p className="mb-1.5 text-xs font-bold">Subject: {source.subject}</p>
                            )}
                            {source?.body && (
                              <p className="mb-2.5 whitespace-pre-wrap text-xs text-[var(--admin-text-muted)]">{source.body.slice(0, 280)}{source.body.length > 280 ? '…' : ''}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {(c.status === 'draft' || c.status === 'scheduled') && (
                                <AdminButton variant="primary" size="sm" loading={busy} onClick={() => void handleSend(c)}>
                                  <Send className="h-3.5 w-3.5" /> Send now
                                </AdminButton>
                              )}
                              <AdminButton size="sm" loading={busy} onClick={() => void handleDuplicate(c)}>
                                <Copy className="h-3.5 w-3.5" /> Duplicate
                              </AdminButton>
                              <AdminButton size="sm" loading={busy} onClick={() => void copyWithToast(c.id, 'Campaign ID copied.')}>
                                <Copy className="h-3.5 w-3.5" /> Copy ID
                              </AdminButton>
                              <AdminButton variant="danger" size="sm" loading={busy} onClick={() => void handleDelete(c)}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </AdminButton>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-catalog-table-shell__footer">
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
