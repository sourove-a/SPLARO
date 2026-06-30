'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Mail, MessageSquare, Send, Users, Filter } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { ModulePanelShell, STATUS_CLASS } from '@/components/modules/ModulePanelShell'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useMarketingOverview, useCustomers } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'
import { mapCampaignStatus } from '@/lib/api/marketing'

export function EmailSmsPanel(_props: ModuleContextProps) {
  const { data, isError, isLoading, refetch } = useMarketingOverview()
  const { data: customerData } = useCustomers({ limit: 200 })
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [query, setQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'Email' | 'SMS'>('all')
  const [showComposer, setShowComposer] = useState(true)

  const customers = customerData?.customers ?? []
  const emailCampaigns = data?.emailCampaigns ?? []
  const emailLogs = data?.emailLogs ?? []
  const smsLogs = data?.smsLogs ?? []

  const segments = useMemo(
    () => [
      { name: 'All customers', count: customers.length },
      { name: 'VIP (Gold+)', count: customers.filter((c) => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM').length },
      { name: 'Repeat buyers', count: customers.filter((c) => c.totalOrders >= 2).length },
      { name: 'New signups', count: customers.filter((c) => c.totalOrders <= 1).length },
    ],
    [customers],
  )

  const broadcasts = useMemo(() => {
    const fromCampaigns = emailCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      channel: 'Email' as const,
      segment: 'Campaign',
      status: mapCampaignStatus(c.status),
      sent: c.totalSent,
      open: '—',
      click: '—',
      scheduled: '—',
    }))
    const fromLogs = [
      ...emailLogs.map((l) => ({
        id: l.id,
        name: l.subject ?? 'Email delivery',
        channel: 'Email' as const,
        segment: l.recipient,
        status: l.status === 'DELIVERED' || l.status === 'SENT' ? ('live' as const) : ('pending' as const),
        sent: 1,
        open: '—',
        click: '—',
        scheduled: formatRelativeTime(l.createdAt),
      })),
      ...smsLogs.map((l) => ({
        id: l.id,
        name: l.subject ?? 'SMS delivery',
        channel: 'SMS' as const,
        segment: l.recipient,
        status: l.status === 'DELIVERED' || l.status === 'SENT' ? ('live' as const) : ('pending' as const),
        sent: 1,
        open: '—',
        click: '—',
        scheduled: formatRelativeTime(l.createdAt),
      })),
    ]
    return [...fromCampaigns, ...fromLogs]
  }, [emailCampaigns, emailLogs, smsLogs])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return broadcasts.filter((b) => {
      const matchQ = !q || b.name.toLowerCase().includes(q) || b.segment.toLowerCase().includes(q)
      const matchC = channelFilter === 'all' || b.channel === channelFilter
      return matchQ && matchC
    })
  }, [query, channelFilter, broadcasts])

  const [segment, setSegment] = useState('All customers')

  if (isError) return <ApiOfflineBanner message="Email/SMS API offline — start pnpm dev:api." />

  return (
    <div className="space-y-5">
      <ModulePanelShell
        kpis={[
          ['Emails sent', isLoading ? '…' : emailLogs.length + emailCampaigns.reduce((s, c) => s + c.totalSent, 0), 'gold'],
          ['SMS sent', isLoading ? '…' : smsLogs.length, 'default'],
          ['Campaigns', emailCampaigns.length, 'success'],
          ['Customers', customers.length, 'warning'],
        ]}
        pipeline={[
          ['Email logs', emailLogs.length],
          ['SMS logs', smsLogs.length],
          ['Campaigns', emailCampaigns.length],
          ['Segments', segments.length],
          ['API', 'Live'],
        ]}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search broadcast or segment..."
        createLabel="New broadcast"
        onCreate={() => {
          setShowComposer(true)
          toast('Create email campaigns in Marketing → Campaigns.', { icon: '📧' })
        }}
        onRefresh={() => void refetch()}
        onExport={() => toast.error('This action is not available yet — feature pending.')}
        tableIcon={Mail}
        tableTitle={`Broadcasts · ${filtered.length} results`}
        footer="Live from campaigns + notification_delivery_log"
        extraFilters={
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[#6B6B6B]" />
            {(['all', 'Email', 'SMS'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannelFilter(c)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-bold transition',
                  channelFilter === c
                    ? 'border-[#5E7CFF]/50 bg-[#5E7CFF]/12 text-[#111111]'
                    : 'border-black/8 bg-white/70 text-[#6B6B6B]',
                )}
              >
                {c === 'all' ? 'All channels' : c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowComposer((v) => !v)}
              className="ml-auto text-xs font-bold text-[#5E7CFF] hover:underline"
            >
              {showComposer ? 'Hide composer' : 'Show composer'}
            </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#6B6B6B]">No email or SMS deliveries logged yet.</p>
        ) : (
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Segment</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Schedule</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold">{row.name}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold">
                      {row.channel === 'Email' ? (
                        <Mail className="h-3 w-3 text-[#5E7CFF]" />
                      ) : (
                        <MessageSquare className="h-3 w-3 text-[#5E7CFF]" />
                      )}
                      {row.channel}
                    </span>
                  </td>
                  <td className="text-xs">{row.segment}</td>
                  <td>
                    <span className={STATUS_CLASS[row.status === 'live' ? 'active' : row.status === 'scheduled' ? 'pending' : 'draft']}>
                      {row.status}
                    </span>
                  </td>
                  <td className="font-bold">{row.sent}</td>
                  <td className="muted text-xs">{row.scheduled}</td>
                  <td>
                    <RowActionsMenu recordName={row.name} moduleHref="/dashboard/email-sms" recordId={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ModulePanelShell>

      {showComposer ? (
        <section className="admin-module-card">
          <p className="admin-kpi__label">Quick composer (preview)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['email', 'sms'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-bold capitalize',
                  channel === ch ? 'border-[#5E7CFF]/50 bg-[#5E7CFF]/12' : 'border-black/8',
                )}
              >
                {ch}
              </button>
            ))}
          </div>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="mt-3 w-full rounded-[14px] border border-black/8 bg-white/80 px-3 py-2 text-sm font-semibold"
          >
            {segments.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
          {channel === 'email' ? (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="mt-2 w-full rounded-[14px] border border-black/8 bg-white/80 px-3 py-2 text-sm font-semibold"
            />
          ) : null}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={channel === 'email' ? 'Email body...' : 'SMS message (160 chars)...'}
            className="mt-2 w-full resize-none rounded-[14px] border border-black/8 bg-white/80 px-3 py-2 text-sm font-semibold"
          />
          <AdminButton
            variant="gold"
            className="mt-3"
            onClick={() => toast('Transactional sends use order webhooks — bulk via Campaigns.', { icon: '📤' })}
          >
            <Send className="h-4 w-4" /> Queue broadcast
          </AdminButton>
        </section>
      ) : null}

      <section className="admin-module-card">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#5E7CFF]" />
          <p className="admin-module-card__title">Live audience segments</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {segments.map((s) => (
            <div key={s.name} className="rounded-[14px] border border-black/5 bg-white/55 px-3 py-2 text-sm font-semibold">
              {s.name} · <span className="font-black text-[#5E7CFF]">{s.count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
