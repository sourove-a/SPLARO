'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { FONT, MONO } from '@/components/dc/tokens'
import { fetchCommerceSubscriptions } from '@/lib/api/admin-hub'
import { fetchInvoiceStats } from '@/lib/api/commerce-finance'
import { useInvoices, useTransactions } from '@/lib/api/hooks'
import { fetchPosToday } from '@/lib/api/pos'
import { formatBDT } from '@/lib/format/currency'

export type CommerceExtrasTab = 'pos' | 'invoices' | 'transactions' | 'subscriptions'

const TABS: { id: CommerceExtrasTab; label: string }[] = [
  { id: 'pos', label: 'POS' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'subscriptions', label: 'Subscriptions' },
]

const TAB_PATH: Record<CommerceExtrasTab, string> = {
  pos: '/dashboard/pos',
  invoices: '/dashboard/invoices',
  transactions: '/dashboard/transactions',
  subscriptions: '/dashboard/subscriptions',
}

export function DcCommerceExtras({ tab = 'pos' }: { tab?: CommerceExtrasTab }) {
  const router = useRouter()
  return (
    <DcScreenProvider screen="commerce-extras" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCommerceExtrasBody initial={tab} />
    </DcScreenProvider>
  )
}

function DcCommerceExtrasBody({ initial }: { initial: CommerceExtrasTab }) {
  const router = useRouter()
  const [tab, setTab] = useState<CommerceExtrasTab>(initial)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const pos = useQuery({ queryKey: ['pos-today'], queryFn: fetchPosToday, staleTime: 15_000, retry: 1 })
  const invoices = useInvoices()
  const invoiceStats = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: () => fetchInvoiceStats(30),
    staleTime: 30_000,
    retry: 1,
  })
  const transactions = useTransactions()
  const subscriptions = useQuery({
    queryKey: ['commerce-subscriptions'],
    queryFn: fetchCommerceSubscriptions,
    staleTime: 30_000,
    retry: 1,
  })

  const activeQuery =
    tab === 'pos'
      ? pos
      : tab === 'invoices'
        ? invoices
        : tab === 'transactions'
          ? transactions
          : subscriptions

  const kpis = useMemo(() => {
    if (tab === 'pos') {
      return [
        { label: 'Today sales', value: pos.data?.count ?? '—' },
        { label: 'Today total', value: formatBDT(pos.data?.total ?? 0) },
      ]
    }
    if (tab === 'invoices') {
      return [
        { label: 'Invoices (30d)', value: invoiceStats.data?.totalInvoices ?? invoices.data?.length ?? '—' },
        { label: 'Revenue (30d)', value: formatBDT(invoiceStats.data?.totalRevenue ?? 0) },
      ]
    }
    if (tab === 'transactions') {
      const stats = transactions.data?.stats
      return [
        { label: 'Volume', value: formatBDT(stats?.volume ?? 0) },
        { label: 'Success rate', value: stats ? `${Math.round(stats.successRate)}%` : '—' },
        { label: 'Pending', value: stats?.pending ?? '—' },
      ]
    }
    return [{ label: 'Subscriptions', value: subscriptions.data?.length ?? '—' }]
  }, [tab, pos.data, invoices.data, invoiceStats.data, transactions.data, subscriptions.data])

  const handlePrintInvoice = (invoiceId: string, invoiceNumber?: string) => {
    const target = invoiceNumber ? invoiceNumber : invoiceId
    window.open(`/api/proxy/admin/invoices/${encodeURIComponent(target)}/pdf`, '_blank')
  }

  const rows = useMemo(() => {
    if (tab === 'pos') {
      const methods = Object.entries(pos.data?.byMethod ?? {})
      return methods.map(([method, amount]) => [method, formatBDT(amount)])
    }

    if (tab === 'invoices') {
      let list = invoices.data ?? []
      if (statusFilter !== 'all') {
        list = list.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase())
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        list = list.filter(
          (r) =>
            r.invoiceNumber.toLowerCase().includes(q) ||
            r.customer.toLowerCase().includes(q),
        )
      }

      return list.slice(0, 40).map((row) => [
        <span key={`inv-${row.id}`} style={{ font: `600 13px/1.2 ${MONO}`, color: 'var(--ink)' }}>
          {row.invoiceNumber}
        </span>,
        row.customer,
        formatBDT(row.amount),
        <span
          key={`st-${row.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background:
              row.status === 'paid'
                ? 'var(--ok-soft)'
                : row.status === 'overdue'
                  ? 'var(--bad-soft)'
                  : 'var(--warn-soft)',
            color:
              row.status === 'paid'
                ? 'var(--ok)'
                : row.status === 'overdue'
                  ? 'var(--bad)'
                  : 'var(--warn)',
          }}
        >
          {row.status}
        </span>,
        row.issued,
        <button
          key={`btn-${row.id}`}
          type="button"
          onClick={() => handlePrintInvoice(row.id, row.invoiceNumber)}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '4px 8px',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          View / Print PDF
        </button>,
      ])
    }

    if (tab === 'transactions') {
      let list = transactions.data?.transactions ?? []
      if (statusFilter !== 'all') {
        list = list.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase())
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        list = list.filter(
          (r) =>
            r.orderNumber.toLowerCase().includes(q) ||
            (r.paymentNumber && r.paymentNumber.toLowerCase().includes(q)) ||
            r.gateway.toLowerCase().includes(q),
        )
      }

      return list.slice(0, 40).map((row) => [
        <span key={`tx-${row.id}`} style={{ font: `600 12.5px/1.2 ${MONO}`, color: 'var(--ink)' }}>
          {row.paymentNumber ?? row.id.slice(0, 8)}
        </span>,
        row.orderNumber,
        <span
          key={`gw-${row.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--surface-2)',
            fontSize: 11,
            fontFamily: MONO,
          }}
        >
          {row.gateway}
        </span>,
        formatBDT(row.amount),
        <span
          key={`txst-${row.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: row.status === 'success' ? 'var(--ok-soft)' : 'var(--warn-soft)',
            color: row.status === 'success' ? 'var(--ok)' : 'var(--warn)',
          }}
        >
          {row.status}
        </span>,
      ])
    }

    return (subscriptions.data ?? []).slice(0, 40).map((row) => [
      row.customer ?? row.id,
      <span key={`plan-${row.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>
        {row.plan ?? 'Standard'}
      </span>,
      <span
        key={`subst-${row.id}`}
        style={{
          display: 'inline-flex',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: row.status === 'ACTIVE' ? 'var(--ok-soft)' : 'var(--surface-2)',
          color: row.status === 'ACTIVE' ? 'var(--ok)' : 'var(--ink-2)',
        }}
      >
        {row.status ?? 'ACTIVE'}
      </span>,
      row.nextBill ?? '—',
    ])
  }, [tab, pos.data, invoices.data, transactions.data, subscriptions.data, searchQuery, statusFilter])

  const columns =
    tab === 'pos'
      ? ['Method', 'Amount']
      : tab === 'invoices'
        ? ['Invoice', 'Customer', 'Amount', 'Status', 'Issued', '']
        : tab === 'transactions'
          ? ['Payment', 'Order', 'Gateway', 'Amount', 'Status']
          : ['Customer', 'Plan', 'Status', 'Next billing']

  return (
    <DcHubFrame
      crumbGroup="Commerce"
      title="Commerce extras"
      queries={[activeQuery, ...(tab === 'invoices' ? [invoiceStats] : [])]}
      empty={rows.length === 0}
      emptyState={{
        icon: 'icon-receipt',
        title: 'No POS or invoice activity yet',
        body:
          'This screen reads POS sessions, invoices and payment splits. Nothing has been recorded for the selected period — take a POS sale or issue an invoice and it will appear here.',
      }}
      actions={[
        tab === 'pos'
          ? {
              label: 'Open POS counter',
              icon: 'icon-scan-line',
              variant: 'primary',
              onClick: () => router.push('/dashboard/pos'),
            }
          : {
              label: 'Refresh data',
              icon: 'icon-refresh-cw',
              variant: 'ghost',
              onClick: () => {
                void activeQuery.refetch()
              },
            },
      ]}
    >
      <HubTabs
        tabs={TABS}
        active={tab}
        onChange={(id) => {
          const next = id as CommerceExtrasTab
          setTab(next)
          setSearchQuery('')
          setStatusFilter('all')
          router.replace(TAB_PATH[next])
        }}
      />

      <HubKpis items={kpis} />

      {(tab === 'invoices' || tab === 'transactions') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            margin: '8px 0',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              tab === 'invoices'
                ? 'Search by invoice # or customer...'
                : 'Search order #, payment or gateway...'
            }
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 12,
              minWidth: 240,
              fontFamily: FONT,
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 12,
              fontFamily: FONT,
            }}
          >
            <option value="all">All Statuses</option>
            {tab === 'invoices' ? (
              <>
                <option value="paid">Paid</option>
                <option value="sent">Sent</option>
                <option value="draft">Draft</option>
                <option value="overdue">Overdue</option>
              </>
            ) : (
              <>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </>
            )}
          </select>
        </div>
      )}

      <HubTable columns={columns} rows={rows} />
    </DcHubFrame>
  )
}
