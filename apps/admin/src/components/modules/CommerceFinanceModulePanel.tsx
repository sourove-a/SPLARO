'use client'

import { Fragment, useMemo, useState } from 'react'
import { toastNotImplemented } from '@/lib/admin/feedback'
import {
  RotateCcw, FileText, CreditCard, ChevronDown, Printer, CheckCircle2,
  AlertTriangle, Repeat, Calendar, Download, Search, Filter, RefreshCw,
  TrendingUp, DollarSign, Clock, XCircle, Package, ArrowLeftRight,
  Banknote,
} from 'lucide-react'

import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { AdminButton } from '@/components/ui/AdminButton'
import { useReturns, useInvoices, useTransactions, useCommerceSubscriptions } from '@/lib/api/hooks'
import { downloadInvoice } from '@/lib/admin/admin-actions'
import { formatRelativeTime } from '@/lib/api/orders'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'
import { InvoiceDetailPanel } from '@/components/modules/InvoiceDetailPanel'
import { formatBDT, STATUS_CLASS } from '@/components/modules/ModulePanelShell'

/* ── Design tokens ────────────────────────────────────────── */

const GOLD = '#5E7CFF'

type KpiTone = 'gold' | 'warn' | 'success' | 'danger' | 'neutral'

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASS[status] ?? STATUS_CLASS.draft
  return <span className={cls}>{status}</span>
}

function KpiStrip({ items }: { items: { label: string; value: string | number; icon: React.ElementType; tone?: KpiTone }[] }) {
  return (
    <div className="admin-commerce-kpi-grid">
      {items.map(({ label, value, icon: Icon, tone = 'neutral' }) => (
        <div key={label} className={`admin-commerce-kpi admin-commerce-kpi--${tone}`}>
          <div className="admin-commerce-kpi__icon">
            <Icon size={15} strokeWidth={2.2} />
          </div>
          <p className="admin-commerce-kpi__value">{value}</p>
          <p className="admin-commerce-kpi__label">{label}</p>
        </div>
      ))}
    </div>
  )
}

function CommerceToolbar({ summary, onRefresh }: { summary: string; onRefresh?: () => void }) {
  return (
    <div className="admin-commerce-toolbar">
      <p className="admin-commerce-toolbar__meta" dangerouslySetInnerHTML={{ __html: summary }} />
      {onRefresh ? (
        <AdminButton className="!text-xs" onClick={onRefresh}>
          <RefreshCw size={14} />
          Refresh
        </AdminButton>
      ) : null}
    </div>
  )
}

function FilterBar({
  query, onQuery, placeholder, chips, activeChip, onChip,
}: {
  query: string; onQuery: (v: string) => void; placeholder: string
  chips?: string[]; activeChip?: string; onChip?: (k: string) => void
}) {
  return (
    <div className="admin-commerce-filter">
      <div className="admin-commerce-search">
        <Search size={14} color={GOLD} />
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} />
      </div>
      {chips && onChip ? (
        <div className="admin-commerce-chips">
          <Filter size={12} color="var(--admin-text-muted)" />
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChip(chip)}
              className={`admin-commerce-chip${activeChip === chip ? ' admin-commerce-chip--active' : ''}`}
            >
              {chip === 'all' ? 'All' : chip}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function GlassTable({
  children, empty, loading, emptyIcon: EmptyIcon, emptyTitle, emptySub,
}: {
  children?: React.ReactNode; empty?: string; loading?: boolean
  emptyIcon?: React.ElementType; emptyTitle?: string; emptySub?: string
}) {
  return (
    <div className="admin-commerce-table-wrap settings-card">
      {loading ? (
        <div className="admin-commerce-empty">
          <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="10" cy="10" r="8" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="20 12" />
          </svg>
          <p className="admin-commerce-empty__sub">Loading…</p>
        </div>
      ) : !children ? (
        <div className="admin-commerce-empty">
          {EmptyIcon ? (
            <div className="admin-commerce-empty__icon">
              <EmptyIcon size={22} strokeWidth={1.8} />
            </div>
          ) : null}
          <p className="admin-commerce-empty__title">{emptyTitle ?? 'No data yet'}</p>
          <p className="admin-commerce-empty__sub">{emptySub ?? empty ?? 'Records will appear here when available.'}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-commerce-table">{children}</table>
        </div>
      )}
    </div>
  )
}

function OfflineBanner() {
  return (
    <div className="admin-commerce-offline">
      API offline — run <code style={{ fontSize: 12 }}>pnpm dev:stack</code> (API on :4000)
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   RETURNS / RMA
───────────────────────────────────────────────────────────── */

type RmaStatus = 'pending' | 'approved' | 'received' | 'refunded' | 'rejected'

interface RmaRow {
  id: string; orderId: string; customer: string; reason: string
  items: string; amount: number; method: string; status: RmaStatus; updated: string
}

function ReturnsRmaPanel() {
  const { data: apiRows = [], isLoading, isError, refetch } = useReturns()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RmaStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows: RmaRow[] = apiRows.map((r) => ({
    id: r.id, orderId: r.orderId, customer: r.customer, reason: r.reason,
    items: r.items, amount: r.amount, method: r.method,
    status: r.status as RmaStatus, updated: r.updated,
  }))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) => {
      const matchQ = !q || r.id.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q)
      return matchQ && (statusFilter === 'all' || r.status === statusFilter)
    })
  }, [query, statusFilter, rows])

  const openCount = rows.filter((r) => ['pending', 'approved', 'received'].includes(r.status)).length
  const returnValue = rows.filter((r) => r.status !== 'rejected').reduce((s, r) => s + r.amount, 0)

  if (isError) return <OfflineBanner />

  return (
    <div className="admin-commerce-panel settings-section-enter">
      <CommerceToolbar
        summary={`<strong>${rows.length}</strong> requests · <strong>${openCount}</strong> open`}
        onRefresh={() => void refetch()}
      />

      <KpiStrip items={[
        { label: 'Open RMAs', value: openCount, icon: Package, tone: 'warn' },
        { label: 'Awaiting review', value: rows.filter((r) => r.status === 'pending').length, icon: Clock, tone: 'gold' },
        { label: 'Refunded MTD', value: rows.filter((r) => r.status === 'refunded').length, icon: CheckCircle2, tone: 'success' },
        { label: 'Return value', value: formatBDT(returnValue), icon: ArrowLeftRight, tone: 'neutral' },
      ]} />

      <FilterBar
        query={query} onQuery={setQuery}
        placeholder="Search RMA ID, order, customer…"
        chips={['all', 'pending', 'approved', 'received', 'refunded', 'rejected']}
        activeChip={statusFilter}
        onChip={(k) => setStatusFilter(k as RmaStatus | 'all')}
      />

      <GlassTable
        loading={isLoading}
        emptyIcon={RotateCcw}
        emptyTitle="No return requests yet"
        emptySub="RMA requests appear when customers initiate returns."
      >
        {filtered.length > 0 && (
          <>
            <thead>
              <tr>
                {['RMA', 'Order', 'Customer', 'Reason', 'Method', 'Amount', 'Status', 'Updated', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                        className="admin-commerce-link"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {row.id.slice(0, 10)}…
                        <ChevronDown size={12} style={{ transition: 'transform 200ms', transform: expandedId === row.id ? 'rotate(180deg)' : 'none' }} />
                      </button>
                    </td>
                    <td>
                      <a href={`/dashboard/orders/${row.orderId}`} className="admin-commerce-link">
                        {row.orderId.slice(0, 10)}
                      </a>
                    </td>
                    <td style={{ fontWeight: 700 }}>{row.customer}</td>
                    <td style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{row.reason}</td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{row.method}</td>
                    <td style={{ fontWeight: 800 }}>{formatBDT(row.amount)}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{row.updated}</td>
                    <td><RowActionsMenu recordName={row.id} moduleHref="/dashboard/returns-rma" recordId={row.id} /></td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={9} style={{ background: 'rgba(200,169,126,0.08)', paddingTop: 12, paddingBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600, marginRight: 4 }}>Items: {row.items}</span>
                          {row.status === 'pending' && (
                            <>
                              <AdminButton variant="gold" className="!text-xs" onClick={() => toastNotImplemented('Approve RMA')}>
                                <CheckCircle2 size={13} /> Approve
                              </AdminButton>
                              <AdminButton className="!text-xs" onClick={() => toastNotImplemented('Reject RMA')}>Reject</AdminButton>
                            </>
                          )}
                          {row.status === 'approved' && (
                            <AdminButton variant="gold" className="!text-xs" onClick={() => toastNotImplemented('Mark received')}>
                              Mark received
                            </AdminButton>
                          )}
                          {row.status === 'received' && (
                            <AdminButton variant="gold" className="!text-xs" onClick={() => toastNotImplemented('Process refund')}>
                              Process refund
                            </AdminButton>
                          )}
                          <AdminButton className="!text-xs" onClick={() => toastNotImplemented('Print label')}>
                            <Printer size={13} /> Print label
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </>
        )}
      </GlassTable>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SUBSCRIPTIONS (repeat buyers)
───────────────────────────────────────────────────────────── */

type SubStatus = 'active' | 'paused' | 'cancelled' | 'pending'

function SubscriptionsPanel() {
  const { data: rows = [], isError, isLoading, refetch } = useCommerceSubscriptions()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<SubStatus | 'all'>('all')

  const mapped = rows.map((r) => ({
    id: r.id, customer: r.customer, plan: r.plan, frequency: r.frequency,
    amount: r.amount, nextBill: r.nextBill, status: r.status as SubStatus, orders: r.orders,
  }))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return mapped.filter((r) => {
      const matchQ = !q || r.customer.toLowerCase().includes(q) || r.plan.toLowerCase().includes(q)
      return matchQ && (statusFilter === 'all' || r.status === statusFilter)
    })
  }, [query, statusFilter, mapped])

  const mrr = mapped.filter((r) => r.status === 'active').reduce((s, r) => s + r.amount, 0)

  if (isError) return <OfflineBanner />

  return (
    <div className="admin-commerce-panel settings-section-enter">
      <CommerceToolbar
        summary={`<strong>${mapped.length}</strong> customers · subscription commerce`}
        onRefresh={() => void refetch()}
      />

      <KpiStrip items={[
        { label: 'Repeat buyers', value: mapped.length, icon: Repeat, tone: 'gold' },
        { label: 'Active', value: mapped.filter((r) => r.status === 'active').length, icon: TrendingUp, tone: 'success' },
        { label: 'Revenue base', value: formatBDT(mrr), icon: DollarSign, tone: 'neutral' },
        { label: 'Total orders', value: mapped.reduce((s, r) => s + r.orders, 0), icon: Package, tone: 'neutral' },
      ]} />

      <FilterBar
        query={query} onQuery={setQuery}
        placeholder="Search customer, plan…"
        chips={['all', 'active', 'paused', 'pending', 'cancelled']}
        activeChip={statusFilter}
        onChip={(k) => setStatusFilter(k as SubStatus | 'all')}
      />

      <GlassTable
        loading={isLoading}
        emptyIcon={Repeat}
        emptyTitle="No repeat buyers yet"
        emptySub="Appears when customers place multiple orders."
      >
        {filtered.length > 0 && (
          <>
            <thead>
              <tr>
                {['ID', 'Customer', 'Plan', 'Frequency', 'Amount', 'Next Bill', 'Orders', 'Status', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td><span className="admin-commerce-link">{row.id.slice(0, 10)}</span></td>
                  <td style={{ fontWeight: 700 }}>{row.customer}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
                      <Repeat size={11} color={GOLD} />
                      {row.plan}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{row.frequency}</td>
                  <td style={{ fontWeight: 800 }}>{formatBDT(row.amount)}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--admin-text-muted)' }}>
                      <Calendar size={11} />
                      {row.nextBill}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{row.orders}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td><RowActionsMenu recordName={row.id} moduleHref="/dashboard/subscriptions" recordId={row.id} /></td>
                </tr>
              ))}
            </tbody>
          </>
        )}
      </GlassTable>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   INVOICES
───────────────────────────────────────────────────────────── */

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

function InvoicesPanel() {
  const { data: apiRows = [], isLoading, isError, refetch } = useInvoices()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')

  const rows = apiRows.map((r) => ({
    id: r.invoiceNumber, customer: r.customer, orderId: r.orderId,
    amount: r.amount, status: r.status as InvoiceStatus, due: r.due, issued: r.issued,
  }))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) => {
      const matchQ = !q || r.id.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q)
      return matchQ && (statusFilter === 'all' || r.status === statusFilter)
    })
  }, [query, statusFilter, rows])

  const outstanding = rows.filter((r) => ['sent', 'overdue'].includes(r.status)).reduce((s, r) => s + r.amount, 0)
  const overdueCount = rows.filter((r) => r.status === 'overdue').length

  if (isError) return <OfflineBanner />

  return (
    <div className="admin-commerce-panel settings-section-enter">
      <CommerceToolbar
        summary={`<strong>${rows.length}</strong> total · <strong>${formatBDT(outstanding)}</strong> outstanding`}
        onRefresh={() => void refetch()}
      />

      <KpiStrip items={[
        { label: 'Outstanding', value: formatBDT(outstanding), icon: Clock, tone: 'warn' },
        { label: 'Paid MTD', value: formatBDT(rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)), icon: CheckCircle2, tone: 'success' },
        { label: 'Overdue', value: overdueCount, icon: AlertTriangle, tone: overdueCount > 0 ? 'danger' : 'neutral' },
        { label: 'Draft', value: rows.filter((r) => r.status === 'draft').length, icon: FileText, tone: 'neutral' },
      ]} />

      {overdueCount > 0 && (
        <div className="admin-commerce-alert admin-commerce-alert--warn">
          <AlertTriangle size={15} />
          <span>
            {overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''} need follow-up
          </span>
        </div>
      )}

      <FilterBar
        query={query} onQuery={setQuery}
        placeholder="Search invoice, customer, order…"
        chips={['all', 'draft', 'sent', 'paid', 'overdue']}
        activeChip={statusFilter}
        onChip={(k) => setStatusFilter(k as InvoiceStatus | 'all')}
      />

      <GlassTable
        loading={isLoading}
        emptyIcon={FileText}
        emptyTitle="No invoices yet"
        emptySub="Invoices appear when orders are placed."
      >
        {filtered.length > 0 && (
          <>
            <thead>
              <tr>
                {['Invoice', 'Customer', 'Order', 'Amount', 'Issued', 'Due', 'Status', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td><span className="admin-commerce-link">{row.id}</span></td>
                  <td style={{ fontWeight: 700 }}>{row.customer}</td>
                  <td>
                    <a href={`/dashboard/orders/${row.orderId}`} className="admin-commerce-link">
                      {row.orderId.slice(0, 12)}
                    </a>
                  </td>
                  <td style={{ fontWeight: 800 }}>{formatBDT(row.amount)}</td>
                  <td style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{row.issued}</td>
                  <td style={{
                    fontSize: 12, fontWeight: 700,
                    color: row.status === 'overdue' ? 'var(--admin-danger)' : 'var(--admin-text)',
                  }}>{row.due}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => void downloadInvoice(row.orderId)}
                        className="admin-commerce-icon-btn"
                        aria-label="Download"
                      >
                        <Download size={13} />
                      </button>
                      <RowActionsMenu recordName={row.id} moduleHref="/dashboard/invoices" recordId={row.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        )}
      </GlassTable>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TRANSACTIONS
───────────────────────────────────────────────────────────── */

type TxnType = 'payment' | 'refund' | 'payout'
type TxnStatus = 'success' | 'pending' | 'failed'

function TransactionsPanel() {
  const { data, isLoading, isError, refetch } = useTransactions()
  const [query, setQuery] = useState('')
  const [gatewayFilter, setGatewayFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<TxnType | 'all'>('all')

  const rows = (data?.transactions ?? []).map((r) => ({
    id: r.id, orderId: r.orderId, orderNumber: r.orderNumber,
    gateway: r.gateway, type: r.type as TxnType, amount: r.amount,
    status: r.status as TxnStatus, ref: r.ref, time: formatRelativeTime(r.time),
  }))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) => {
      const matchQ = !q || r.id.toLowerCase().includes(q) || r.orderNumber.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q)
      return matchQ && (gatewayFilter === 'all' || r.gateway === gatewayFilter) && (typeFilter === 'all' || r.type === typeFilter)
    })
  }, [query, gatewayFilter, typeFilter, rows])

  const stats = data?.stats
  const gateways = [...new Set(rows.map((r) => r.gateway))]

  if (isError) return <OfflineBanner />

  return (
    <div className="admin-commerce-panel settings-section-enter">
      <CommerceToolbar
        summary={`<strong>${rows.length}</strong> transactions · live payments`}
        onRefresh={() => void refetch()}
      />

      <KpiStrip items={[
        { label: 'Volume', value: formatBDT(stats?.volume ?? 0), icon: Banknote, tone: 'gold' },
        { label: 'Success rate', value: stats ? `${stats.successRate}%` : '—', icon: TrendingUp, tone: 'success' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, tone: 'warn' },
        { label: 'Failed', value: stats?.failed ?? 0, icon: XCircle, tone: (stats?.failed ?? 0) > 0 ? 'danger' : 'neutral' },
      ]} />

      <div className="admin-commerce-filter">
        <div className="admin-commerce-search">
          <Search size={14} color={GOLD} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search txn ID, order, ref…"
          />
        </div>
        <div className="admin-commerce-chips">
          {(['all', 'payment', 'refund', 'payout'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`admin-commerce-chip${typeFilter === t ? ' admin-commerce-chip--active' : ''}`}
            >
              {t === 'all' ? 'All types' : t}
            </button>
          ))}
        </div>
        {gateways.length > 0 && (
          <div className="admin-commerce-chips">
            {(['all', ...gateways] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGatewayFilter(g)}
                className={`admin-commerce-chip${gatewayFilter === g ? ' admin-commerce-chip--active' : ''}`}
              >
                {g === 'all' ? 'All gateways' : g}
              </button>
            ))}
          </div>
        )}
      </div>

      <GlassTable
        loading={isLoading}
        emptyIcon={CreditCard}
        emptyTitle="No payment records yet"
        emptySub="Transactions appear when customers pay for orders."
      >
        {filtered.length > 0 && (
          <>
            <thead>
              <tr>
                {['Txn ID', 'Order', 'Gateway', 'Type', 'Amount', 'Reference', 'Status', 'Time', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td><span className="admin-commerce-link">{row.id.slice(0, 10)}…</span></td>
                  <td>
                    <a href={`/dashboard/orders/${row.orderId}`} className="admin-commerce-link">
                      {row.orderNumber}
                    </a>
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 700 }}>{row.gateway}</td>
                  <td>
                    <span className={`admin-commerce-txn-type admin-commerce-txn-type--${row.type}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className={row.type === 'refund' ? 'admin-commerce-amount--refund' : undefined} style={{ fontWeight: 800 }}>
                    {row.type === 'refund' ? '−' : ''}{formatBDT(row.amount)}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text-muted)' }}>{row.ref}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{row.time}</td>
                  <td><RowActionsMenu recordName={row.id} moduleHref="/dashboard/transactions" recordId={row.id} /></td>
                </tr>
              ))}
            </tbody>
          </>
        )}
      </GlassTable>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ROUTER
───────────────────────────────────────────────────────────── */

const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/returns-rma':   ReturnsRmaPanel,
  '/dashboard/subscriptions': SubscriptionsPanel,
  '/dashboard/invoices':      InvoicesPanel,
  '/dashboard/transactions':  TransactionsPanel,
}

function invoiceRecordId(subPath: string[] | undefined) {
  if (!subPath?.length) return null
  if (subPath[subPath.length - 1] === 'edit') return subPath[subPath.length - 2] ?? subPath[0] ?? null
  return subPath[0] ?? null
}

export function CommerceFinanceModulePanel(props: ModuleContextProps) {
  const { moduleHref, subPath, action } = props

  if (moduleHref === '/dashboard/invoices' && (action === 'detail' || action === 'edit')) {
    const recordId = invoiceRecordId(subPath)
    if (recordId) return <InvoiceDetailPanel recordId={recordId} moduleHref={moduleHref} />
  }

  const Panel = PANELS[moduleHref]
  return renderModuleSubPanel(Panel, props)
}
