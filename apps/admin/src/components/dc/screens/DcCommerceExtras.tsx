'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { fetchCommerceSubscriptions } from '@/lib/api/admin-hub'
import { fetchInvoiceStats } from '@/lib/api/commerce-finance'
import { fetchPosToday } from '@/lib/api/pos'
import { useInvoices, useTransactions } from '@/lib/api/hooks'
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

  const rows = useMemo(() => {
    if (tab === 'pos') {
      const methods = Object.entries(pos.data?.byMethod ?? {})
      return methods.map(([method, amount]) => [method, formatBDT(amount)])
    }
    if (tab === 'invoices') {
      return (invoices.data ?? []).slice(0, 40).map((row) => [
        row.invoiceNumber,
        row.customer,
        formatBDT(row.amount),
        row.status,
        row.issued,
      ])
    }
    if (tab === 'transactions') {
      return (transactions.data?.transactions ?? []).slice(0, 40).map((row) => [
        row.paymentNumber ?? row.id.slice(0, 8),
        row.orderNumber,
        row.gateway,
        formatBDT(row.amount),
        row.status,
      ])
    }
    return (subscriptions.data ?? []).slice(0, 40).map((row) => [
      row.customer ?? row.id,
      row.plan ?? '—',
      row.status ?? '—',
      row.nextBill ?? '—',
    ])
  }, [tab, pos.data, invoices.data, transactions.data, subscriptions.data])

  const columns =
    tab === 'pos'
      ? ['Method', 'Amount']
      : tab === 'invoices'
        ? ['Invoice', 'Customer', 'Amount', 'Status', 'Issued']
        : tab === 'transactions'
          ? ['Payment', 'Order', 'Gateway', 'Amount', 'Status']
          : ['Customer', 'Plan', 'Status', 'Next billing']

  return (
    <DcHubFrame
      crumbGroup="Commerce"
      title="Commerce extras"
      queries={[activeQuery, ...(tab === 'invoices' ? [invoiceStats] : [])]}
      empty={rows.length === 0}
    >
      <HubTabs
        tabs={TABS}
        active={tab}
        onChange={(id) => {
          const next = id as CommerceExtrasTab
          setTab(next)
          router.replace(TAB_PATH[next])
        }}
      />
      <HubKpis items={kpis} />
      <HubTable columns={columns} rows={rows} />
    </DcHubFrame>
  )
}
