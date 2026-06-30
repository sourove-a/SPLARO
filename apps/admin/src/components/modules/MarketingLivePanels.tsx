'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { MessageCircle, Share2, Star, Filter, Send, Instagram } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { ModulePanelShell, STATUS_CLASS, formatBDT } from '@/components/modules/ModulePanelShell'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import { useMarketingOverview, useCreateAffiliate } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'

export function WhatsAppPanelLive() {
  const { data, isError, refetch } = useMarketingOverview()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'inbox' | 'templates' | 'broadcasts'>('inbox')
  const logs = data?.whatsappLogs ?? []
  const campaigns = data?.whatsappCampaigns ?? []

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return logs.filter(
      (w) =>
        !q ||
        w.recipient.toLowerCase().includes(q) ||
        (w.subject ?? '').toLowerCase().includes(q) ||
        (w.body ?? '').toLowerCase().includes(q),
    )
  }, [query, logs])

  if (isError) return <ApiOfflineBanner message="Marketing API offline — start pnpm dev:api." />

  return (
    <div className="space-y-5">
      <ModulePanelShell
        kpis={[
          ['Deliveries', logs.length, 'default'],
          ['Sent', logs.filter((w) => w.status === 'SENT' || w.status === 'DELIVERED').length, 'success'],
          ['Failed', logs.filter((w) => w.status === 'FAILED').length, 'warning'],
          ['Campaigns', campaigns.length, 'gold'],
        ]}
        pipeline={[
          ['Logs', logs.length],
          ['Campaigns', campaigns.length],
          ['Sent', logs.filter((w) => w.status === 'SENT').length],
          ['Pending', logs.filter((w) => w.status === 'PENDING').length],
          ['API', 'Live'],
        ]}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search recipient, subject..."
        createLabel="New broadcast"
        onCreate={() => toast('Create WhatsApp campaigns in Marketing → Campaigns.', { icon: '📢' })}
        onRefresh={() => void refetch()}
        onExport={() => toast.error('This action is not available yet — feature pending.')}
        tableIcon={MessageCircle}
        tableTitle={
          view === 'inbox'
            ? `Delivery log · ${filtered.length}`
            : view === 'broadcasts'
              ? `Broadcasts · ${campaigns.length}`
              : 'Message templates'
        }
        footer="Live from notification_delivery_log"
        extraFilters={
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[#6B6B6B]" />
            {(['inbox', 'templates', 'broadcasts'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-bold capitalize transition',
                  view === v
                    ? 'border-[#5E7CFF]/50 bg-[#5E7CFF]/12 text-[#111111]'
                    : 'border-black/8 bg-white/70 text-[#6B6B6B]',
                )}
              >
                {v}
              </button>
            ))}
            <span className="ml-auto rounded-[12px] bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
              WhatsApp · Live API
            </span>
          </div>
        }
      >
        {view === 'inbox' ? (
          filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#6B6B6B]">No WhatsApp deliveries logged yet.</p>
          ) : (
            <table className="admin-module-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Preview</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs">{w.recipient}</td>
                    <td className="text-xs">{w.subject ?? '—'}</td>
                    <td className="max-w-[200px] truncate text-xs text-[#6B6B6B]">{w.body ?? '—'}</td>
                    <td>
                      <span
                        className={STATUS_CLASS[w.status === 'DELIVERED' || w.status === 'SENT' ? 'delivered' : w.status === 'FAILED' ? 'cancelled' : 'pending']}
                      >
                        {w.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="muted text-xs">{formatRelativeTime(w.createdAt)}</td>
                    <td>
                      <AdminButton className="!px-2 !py-1 !text-xs" onClick={() => toast.error('This action is not available yet — feature pending.')}>
                        <Send className="h-3 w-3" /> View
                      </AdminButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : view === 'broadcasts' ? (
          campaigns.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#6B6B6B]">No WhatsApp campaigns yet.</p>
          ) : (
            <table className="admin-module-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.name}</td>
                    <td className="font-bold">{c.totalSent}</td>
                    <td>
                      <span className={STATUS_CLASS[c.status === 'SENT' ? 'delivered' : 'pending']}>{c.status.toLowerCase()}</span>
                    </td>
                    <td>
                      <RowActionsMenu recordName={c.name} moduleHref="/dashboard/campaigns" recordId={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <p className="px-4 py-6 text-sm text-[#6B6B6B]">
            WhatsApp templates are managed in Meta Business Manager — connect via Integrations.
          </p>
        )}
      </ModulePanelShell>
    </div>
  )
}

export function AffiliatePanelLive() {
  const { data, isError, refetch } = useMarketingOverview()
  const createAffiliate = useCreateAffiliate()
  const [query, setQuery] = useState('')
  const affiliates = data?.affiliates ?? []

  const filtered = useMemo(
    () =>
      affiliates.filter(
        (a) =>
          !query ||
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.code.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, affiliates],
  )

  const pendingPayout = affiliates.reduce((s, a) => s + Number(a.pendingPayout), 0)
  const totalEarned = affiliates.reduce((s, a) => s + Number(a.totalEarned), 0)

  const handleCreate = () => {
    const name = window.prompt('Partner name')
    if (!name?.trim()) return
    const code = window.prompt('Referral code (e.g. STYLE15)')
    if (!code?.trim()) return
    const email = window.prompt('Email (optional)') ?? undefined
    createAffiliate.mutate(
      { name: name.trim(), code: code.trim(), ...(email?.trim() ? { email: email.trim() } : {}) },
      {
        onSuccess: () => toast.success('Affiliate partner created.'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  if (isError) return <ApiOfflineBanner message="Marketing API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Partners', affiliates.length, 'default'],
        ['Active', affiliates.filter((a) => a.status === 'ACTIVE').length, 'success'],
        ['Pending payout', formatBDT(pendingPayout), 'warning'],
        ['Total earned', formatBDT(totalEarned), 'gold'],
      ]}
      pipeline={[
        ['Partners', affiliates.length],
        ['Active', affiliates.filter((a) => a.status === 'ACTIVE').length],
        ['Pending', affiliates.filter((a) => a.status === 'PENDING').length],
        ['Earned', formatBDT(totalEarned)],
        ['API', 'Live'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search partner or referral code..."
      createLabel="Add partner"
      onCreate={handleCreate}
      onRefresh={() => void refetch()}
      onExport={() => toast.error('This action is not available yet — feature pending.')}
      tableIcon={Share2}
      tableTitle={`Affiliate · ${filtered.length} partners`}
      footer="Live from affiliate_account table"
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No affiliate partners yet — click Add partner.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Referral code</th>
              <th>Commission %</th>
              <th>Earned</th>
              <th>Pending</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.name}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(a.code)
                      toast.success('Code copied.')
                    }}
                    className="font-mono text-xs font-black hover:text-[#5E7CFF]"
                  >
                    {a.code}
                  </button>
                </td>
                <td>{Number(a.commissionRate)}%</td>
                <td className="font-black text-[#5E7CFF]">{formatBDT(Number(a.totalEarned))}</td>
                <td>{formatBDT(Number(a.pendingPayout))}</td>
                <td>
                  <span
                    className={STATUS_CLASS[a.status === 'ACTIVE' ? 'active' : a.status === 'PENDING' ? 'pending' : 'draft']}
                  >
                    {a.status.toLowerCase()}
                  </span>
                </td>
                <td>
                  {Number(a.pendingPayout) > 0 ? (
                    <AdminButton
                      variant="gold"
                      className="!px-2 !py-1 !text-xs"
                      onClick={() => toast.error('This action is not available yet — feature pending.')}
                    >
                      Pay
                    </AdminButton>
                  ) : (
                    <RowActionsMenu recordName={a.name} moduleHref="/dashboard/affiliate" recordId={a.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

type InfluencerStatus = 'active' | 'negotiating' | 'completed' | 'draft'

export function InfluencersPanelLive() {
  const { data, isError, refetch } = useMarketingOverview()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InfluencerStatus | 'all'>('all')

  const influencers = useMemo(() => {
    const affiliates = data?.affiliates ?? []
    const campaigns = data?.campaigns ?? []
    return affiliates.map((a, i) => {
      const campaign = campaigns[i % Math.max(campaigns.length, 1)]
      const status: InfluencerStatus =
        a.status === 'ACTIVE' ? 'active' : a.status === 'PENDING' ? 'negotiating' : 'completed'
      return {
        id: a.id,
        name: a.name,
        handle: a.email ? `@${a.email.split('@')[0]}` : a.code,
        platform: 'Instagram' as const,
        followers: '—',
        campaign: campaign?.name ?? 'Brand collab',
        deliverables: `${Number(a.commissionRate)}% commission`,
        fee: Number(a.totalEarned),
        engagement: '—',
        status,
      }
    })
  }, [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return influencers.filter((i) => {
      const matchQ =
        !q || i.name.toLowerCase().includes(q) || i.handle.toLowerCase().includes(q) || i.campaign.toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || i.status === statusFilter
      return matchQ && matchS
    })
  }, [query, statusFilter, influencers])

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'negotiating', label: 'Negotiating' },
    { key: 'completed', label: 'Completed' },
  ] as const

  if (isError) return <ApiOfflineBanner message="Marketing API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Collabs', influencers.length, 'default'],
        ['Active', influencers.filter((i) => i.status === 'active').length, 'success'],
        ['In negotiation', influencers.filter((i) => i.status === 'negotiating').length, 'warning'],
        ['Campaigns', data?.campaigns.length ?? 0, 'gold'],
      ]}
      pipeline={[
        ['Active', influencers.filter((i) => i.status === 'active').length],
        ['Negotiating', influencers.filter((i) => i.status === 'negotiating').length],
        ['Completed', influencers.filter((i) => i.status === 'completed').length],
        ['Campaigns', data?.campaigns.length ?? 0],
        ['API', 'Live'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search influencer, campaign..."
      createLabel="Add influencer"
      onCreate={() => toast('Add influencers as affiliate partners with social codes.', { icon: '⭐' })}
      onRefresh={() => void refetch()}
      onExport={() => toast.error('This action is not available yet — feature pending.')}
      tabs={tabs.map((t) => ({
        key: t.key,
        label: t.label,
        count: t.key === 'all' ? influencers.length : influencers.filter((i) => i.status === t.key).length,
      }))}
      activeTab={statusFilter}
      onTab={(k) => setStatusFilter(k as InfluencerStatus | 'all')}
      tableIcon={Star}
      tableTitle={`Influencers · ${filtered.length} results`}
      footer="Mapped from affiliate partners + campaigns"
      extraFilters={
        <div className="flex items-center gap-2">
          <Instagram className="h-3.5 w-3.5 text-[#6B6B6B]" />
          <span className="text-[11px] font-bold text-[#6B6B6B]">Partners with campaign assignments</span>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No influencer collabs yet — add affiliate partners first.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Influencer</th>
              <th>Platform</th>
              <th>Campaign</th>
              <th>Deliverables</th>
              <th>Earned</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id}>
                <td>
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-[10px] font-bold text-[#5E7CFF]">{i.handle}</p>
                </td>
                <td className="text-xs">{i.platform}</td>
                <td className="text-xs">{i.campaign}</td>
                <td className="max-w-[120px] truncate text-xs">{i.deliverables}</td>
                <td className="font-black">{i.fee ? formatBDT(i.fee) : '—'}</td>
                <td>
                  <span
                    className={STATUS_CLASS[i.status === 'negotiating' ? 'pending' : i.status === 'completed' ? 'delivered' : i.status]}
                  >
                    {i.status}
                  </span>
                </td>
                <td>
                  <RowActionsMenu recordName={i.name} moduleHref="/dashboard/influencers" recordId={i.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}
