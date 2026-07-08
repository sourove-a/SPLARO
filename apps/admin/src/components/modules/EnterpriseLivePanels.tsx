'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { Bell, Download, FileSpreadsheet, Instagram, MessageCircle, Search, Share2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { ModulePanelShell, STATUS_CLASS } from '@/components/modules/ModulePanelShell'
import { ApiOfflineBanner, KpiGrid } from '@/components/modules/PlatformUi'
import { useNotificationsOverview, useMarketingOverview, useUpdateSocialChannels } from '@/lib/api/hooks'
import { fetchOrders } from '@/lib/api/orders'
import { fetchCustomers } from '@/lib/api/customers'
import { fetchProducts } from '@/lib/api/products'
import { formatRelativeTime } from '@/lib/api/orders'

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportCenterPanelLive() {
  const [busy, setBusy] = useState<string | null>(null)

  const exportDataset = async (kind: 'orders' | 'customers' | 'products', format: 'csv' | 'excel') => {
    setBusy(`${kind}-${format}`)
    try {
      if (kind === 'orders') {
        const data = await fetchOrders({ limit: 500 })
        const rows = [
          ['Invoice', 'Customer', 'Status', 'Total', 'Created'],
          ...data.orders.map((o) => [o.invoiceNumber, o.shippingName, o.status, String(o.total), o.createdAt]),
        ]
        downloadCsv(`splaro-orders.${format === 'excel' ? 'csv' : 'csv'}`, rows)
      } else if (kind === 'customers') {
        const data = await fetchCustomers({ limit: 500 })
        const rows = [
          ['Name', 'Phone', 'Email', 'Orders', 'Total spent', 'Tier'],
          ...data.customers.map((c) => [
            `${c.firstName} ${c.lastName}`,
            c.phone,
            c.email ?? '',
            String(c.totalOrders),
            String(c.totalSpent),
            c.loyaltyTier,
          ]),
        ]
        downloadCsv('splaro-customers.csv', rows)
      } else {
        const data = await fetchProducts({ limit: 500, status: 'published' })
        const rows = [
          ['Name', 'SKU', 'Price', 'Status'],
          ...data.products.map((p) => [p.name, p.sku ?? '', String(p.basePrice), p.status]),
        ]
        downloadCsv('splaro-products.csv', rows)
      }
      toast.success(`${kind} exported as ${format.toUpperCase()}.`)
    } catch {
      toast.error('Export failed — is the API running?')
    } finally {
      setBusy(null)
    }
  }

  const exports = [
    { label: 'Orders', kind: 'orders' as const, desc: 'Up to 500 recent orders' },
    { label: 'Customers', kind: 'customers' as const, desc: 'Customer CRM export' },
    { label: 'Products', kind: 'products' as const, desc: 'Published catalog' },
  ]

  return (
    <div className="space-y-5">
      <KpiGrid items={[['Datasets', '3', 'default'], ['Format', 'CSV', 'gold'], ['API', 'Live', 'success'], ['Max rows', '500', 'warning']]} />
      <div className="grid gap-4 md:grid-cols-3">
        {exports.map((ex) => (
          <section key={ex.kind} className="admin-module-card">
            <div className="mb-2 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#5E7CFF]" />
              <p className="admin-module-card__title">{ex.label}</p>
            </div>
            <p className="admin-module-card__subtitle mb-4">{ex.desc}</p>
            <div className="flex flex-wrap gap-2">
              <AdminButton
                variant="gold"
                size="sm"
                disabled={busy !== null}
                onClick={() => void exportDataset(ex.kind, 'csv')}
              >
                <Download className="h-3.5 w-3.5" />
                {busy === `${ex.kind}-csv` ? 'Exporting…' : 'CSV'}
              </AdminButton>
              <AdminButton
                size="sm"
                disabled={busy !== null}
                onClick={() => void exportDataset(ex.kind, 'excel')}
              >
                Excel
              </AdminButton>
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs font-semibold text-[#6B6B6B]">
        PDF exports use order invoices — open Orders and use Print label / invoice download. Google Sheets sync lives under Finance → Google Sheets.
      </p>
      <AdminNavLink href="/dashboard/finance/google-sheets-finance" className="admin-btn admin-btn--ghost px-4 py-2 text-xs">
        Google Sheets sync →
      </AdminNavLink>
    </div>
  )
}

export function NotificationCenterPanelLive() {
  const { data, isError, isLoading, refetch } = useNotificationsOverview()
  const [query, setQuery] = useState('')
  const logs = useMemo(() => data?.logs ?? [], [data])
  const summary = data?.summary

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return logs.filter(
      (l) =>
        !q ||
        l.channel.toLowerCase().includes(q) ||
        l.recipient.toLowerCase().includes(q) ||
        (l.subject ?? '').toLowerCase().includes(q),
    )
  }, [query, logs])

  if (isError) return <ApiOfflineBanner message="Notifications API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Total', isLoading ? '…' : summary?.total ?? 0, 'default'],
        ['Delivered', isLoading ? '…' : `${summary?.deliveredRate ?? 0}%`, 'success'],
        ['Failed', summary?.failed ?? 0, 'warning'],
        ['Pending', summary?.pending ?? 0, 'gold'],
      ]}
      pipeline={[
        ['Email', logs.filter((l) => l.channel === 'EMAIL').length],
        ['SMS', logs.filter((l) => l.channel === 'SMS').length],
        ['WhatsApp', logs.filter((l) => l.channel === 'WHATSAPP').length],
        ['Telegram', logs.filter((l) => l.channel === 'TELEGRAM').length],
        ['API', 'Live'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search channel, recipient..."
      createLabel="View channels"
      onCreate={() => toast('Configure channels in Integrations.', { icon: '🔔' })}
      onRefresh={() => void refetch()}
      exportDisabled
      tableIcon={Bell}
      tableTitle={`Delivery log · ${filtered.length}`}
      footer="Live from notification_delivery_log"
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No notifications logged yet.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id}>
                <td className="text-xs font-bold">{l.channel}</td>
                <td className="font-mono text-xs">{l.recipient}</td>
                <td className="max-w-[180px] truncate text-xs">{l.subject ?? '—'}</td>
                <td>
                  <span className={STATUS_CLASS[l.status === 'DELIVERED' || l.status === 'SENT' ? 'delivered' : l.status === 'FAILED' ? 'cancelled' : 'pending']}>
                    {l.status.toLowerCase()}
                  </span>
                </td>
                <td className="muted text-xs">{formatRelativeTime(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function SocialCommercePanelLive() {
  const { data: marketing, isError, isLoading, refetch } = useMarketingOverview()
  const updateSocial = useUpdateSocialChannels()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    instagram: '',
    facebook: '',
    tiktok: '',
    youtube: '',
    whatsapp: '',
  })

  const channels = marketing?.socialChannels ?? []

  useEffect(() => {
    if (!marketing?.socialChannels?.length) return
    const byId = Object.fromEntries(marketing.socialChannels.map((c) => [c.id, c]))
    setDraft({
      instagram: byId.instagram?.storedUrl ?? byId.instagram?.url ?? '',
      facebook: byId.facebook?.storedUrl ?? byId.facebook?.url ?? '',
      tiktok: byId.tiktok?.storedUrl ?? byId.tiktok?.url ?? '',
      youtube: byId.youtube?.storedUrl ?? byId.youtube?.url ?? '',
      whatsapp: byId.whatsapp?.storedUrl ?? byId.whatsapp?.handle ?? '',
    })
  }, [marketing?.socialChannels])

  const filtered = channels.filter(
    (c) => !query || c.platform.toLowerCase().includes(query.toLowerCase()),
  )

  if (isError) return <ApiOfflineBanner message="Social Hub API offline — run pnpm dev:stack" />

  const summary = marketing?.socialSummary
  const storefrontLive = summary?.storefrontLive ?? channels.filter((c) => c.storefrontVisible).length

  const statusLabel = (status: string) => {
    if (status === 'live') return 'Connected'
    if (status === 'default') return 'Live on storefront'
    return 'Not linked'
  }

  const statusClass = (status: string) => {
    if (status === 'live' || status === 'default') return STATUS_CLASS.active
    return STATUS_CLASS.draft
  }

  async function handleSave() {
    try {
      await updateSocial.mutateAsync({
        instagram: draft.instagram,
        facebook: draft.facebook,
        tiktok: draft.tiktok,
        youtube: draft.youtube,
        whatsapp: draft.whatsapp,
      })
      toastOk('Social channels saved to database.')
      setEditing(false)
      void refetch()
    } catch {
      toastFail('Save failed — check API connection.')
    }
  }

  return (
    <div className="social-hub-panel space-y-5">
      <KpiGrid
        items={[
          ['Channels', summary?.total ?? channels.length, 'default'],
          ['Live on storefront', storefrontLive, 'success'],
          ['Saved in DB', summary?.savedInDatabase ?? 0, 'gold'],
          ['WhatsApp msgs', marketing?.whatsappLogs.length ?? 0, 'warning'],
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="admin-search max-w-md flex-1">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search platform..."
            className="flex-1 bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel edit' : 'Edit links'}
          </AdminButton>
          <AdminNavLink href="/dashboard/settings" className="admin-btn admin-btn--gold px-4 py-2 text-xs font-black">
            Store settings
          </AdminNavLink>
        </div>
      </div>

      {editing ? (
        <div className="admin-module-card social-hub-panel__editor">
          <p className="admin-module-card__title">Social profile URLs</p>
          <p className="admin-module-card__subtitle">
            Saves to database — same links used on storefront footer and Social Hub status.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(
              [
                ['instagram', 'Instagram URL'],
                ['facebook', 'Facebook URL'],
                ['tiktok', 'TikTok URL'],
                ['youtube', 'YouTube URL'],
                ['whatsapp', 'WhatsApp number'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block space-y-1.5">
                <span className="footwear-field__label">{label}</span>
                <input
                  className="admin-input"
                  value={draft[key]}
                  onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={key === 'whatsapp' ? '+8801XXXXXXXXX' : `https://${key}.com/...`}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminButton variant="gold" onClick={handleSave} disabled={updateSocial.isPending}>
              {updateSocial.isPending ? 'Saving…' : 'Save to API'}
            </AdminButton>
          </div>
        </div>
      ) : null}

      <div className="admin-module-table-wrap">
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Handle / URL</th>
              <th>Source</th>
              <th>Inbox</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="muted py-8 text-center">
                  Loading social channels…
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      {c.platform === 'Instagram' ? <Instagram className="h-3.5 w-3.5 text-[var(--admin-accent)]" /> : null}
                      {c.platform === 'WhatsApp' ? <MessageCircle className="h-3.5 w-3.5 text-[var(--admin-accent)]" /> : null}
                      {c.platform === 'Facebook' || c.platform === 'YouTube' ? (
                        <Share2 className="h-3.5 w-3.5 text-[var(--admin-accent)]" />
                      ) : null}
                      {c.platform}
                    </span>
                  </td>
                  <td className="text-xs">
                    {c.url ? (
                      <a
                        href={c.url.startsWith('http') ? c.url : `https://${c.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[var(--admin-accent)] hover:underline"
                      >
                        {c.handle}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-xs muted">
                    {c.status === 'live' ? 'Database' : c.status === 'default' ? 'Brand default' : '—'}
                  </td>
                  <td>{c.inboxCount > 0 ? c.inboxCount : '—'}</td>
                  <td>
                    <span className={statusClass(c.status)}>{statusLabel(c.status)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {summary?.usingBrandDefaults ? (
        <p className="social-hub-panel__hint text-xs font-semibold text-[var(--admin-text-secondary)]">
          {summary.usingBrandDefaults} channel(s) use SPLARO brand defaults on the storefront — click &quot;Edit links&quot; then Save to store custom URLs in the database.
        </p>
      ) : null}
    </div>
  )
}
