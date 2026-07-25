'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { toastFail, toastApiSaved } from '@/lib/admin/feedback'
import { copyWithToast } from '@/lib/admin/clipboard'
import { verifyReturnStatus } from '@/lib/admin/mutation-verify'
import { confirmOrderPaymentSaved, collectPaymentEvidence } from '@/lib/admin/payment-save'
import {
  RotateCcw, FileText, CreditCard, ChevronDown, Printer, CheckCircle2,
  AlertTriangle, Repeat, Calendar, Download, Search, Filter, RefreshCw,
  TrendingUp, DollarSign, Clock, XCircle, Package, ArrowLeftRight,
  Banknote,
} from 'lucide-react'

import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminStatusBadge, type AdminBadgeTone } from '@/components/ui/AdminStatusBadge'
import { useReturns, useInvoices, useInvoiceHealth, useInvoiceStats, useTransactions, useTransactionHealth, useTransaction, useCommerceSubscriptions, useUpdateReturnStatus, useUpdateOrderPayment } from '@/lib/api/hooks'
import { downloadInvoice, downloadInvoicePdf } from '@/lib/admin/admin-actions'
import { formatRelativeTime } from '@/lib/api/orders'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'
import { InvoiceDetailPanel } from '@/components/modules/InvoiceDetailPanel'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'
import { formatBDT } from '@/components/modules/ModulePanelShell'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { cn } from '@/lib/utils/cn'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'

type KpiTone = 'gold' | 'warn' | 'success' | 'danger' | 'neutral'

const KPI_ACCENT: Record<KpiTone, string | undefined> = {
  gold: 'gold',
  warn: 'warning',
  success: 'success',
  danger: 'danger',
  neutral: undefined,
}

function statusTone(status: string): AdminBadgeTone {
  const v = status.toLowerCase()
  if (['paid', 'refunded', 'active', 'success', 'sent', 'completed'].includes(v)) return 'success'
  if (['pending', 'approved', 'received', 'processing', 'draft', 'open'].includes(v)) return 'warning'
  if (['failed', 'rejected', 'cancelled', 'overdue', 'void'].includes(v)) return 'danger'
  return 'muted'
}

function StatusBadge({ status }: { status: string }) {
  return <AdminStatusBadge label={status} tone={statusTone(status)} />
}

function KpiStrip({ items }: { items: { label: string; value: string | number; icon: React.ElementType; tone?: KpiTone }[] }) {
  return (
    <div className="admin-kpi-grid admin-kpi-grid--catalog">
      {items.map(({ label, value, icon: Icon, tone = 'neutral' }) => (
        <div key={label} className={cn('admin-kpi-card', KPI_ACCENT[tone] && `admin-kpi-card--${KPI_ACCENT[tone]}`)}>
          <div className="mb-2 flex items-center gap-2">
            <span className="admin-catalog-icon-ring !h-7 !w-7">
              <Icon size={14} strokeWidth={2.2} />
            </span>
            <p className="admin-kpi-card__label !m-0">{label}</p>
          </div>
          <div className="admin-kpi-card__row">
            <p className="admin-kpi-card__value">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommerceToolbar({
  summary,
  onRefresh,
}: {
  summary: ReactNode
  onRefresh?: () => void
}) {
  return (
    <div className="admin-catalog-toolbar !mb-3">
      <div className="admin-catalog-toolbar__row !justify-between">
        <p className="m-0 text-sm font-semibold text-[var(--admin-text-secondary)]">{summary}</p>
        {onRefresh ? (
          <AdminButton size="sm" variant="secondary" onClick={onRefresh}>
            <RefreshCw size={14} />
            Refresh
          </AdminButton>
        ) : null}
      </div>
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
    <div className="admin-catalog-toolbar !mb-3">
      <div className="admin-catalog-toolbar__row">
        <div className="admin-catalog-toolbar__search">
          <Search className="admin-catalog-toolbar__search-icon" aria-hidden />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            className="admin-catalog-input"
          />
        </div>
        {chips && onChip ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter size={12} className="text-[var(--admin-text-muted)]" />
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onChip(chip)}
                className={cn('admin-filter-pill', activeChip === chip && 'admin-filter-pill--active')}
              >
                {chip === 'all' ? 'All' : chip}
              </button>
            ))}
          </div>
        ) : null}
      </div>
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
    <div className="admin-catalog-table-shell">
      {loading ? (
        <div className="admin-catalog-empty">
          <RefreshCw className="h-5 w-5 animate-spin text-[var(--admin-accent)]" aria-hidden />
          <p className="admin-empty-state__text">Loading…</p>
        </div>
      ) : !children ? (
        <div className="admin-catalog-empty">
          {EmptyIcon ? (
            <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg mb-2">
              <EmptyIcon size={22} strokeWidth={1.8} />
            </div>
          ) : null}
          <p className="admin-empty-state__title">{emptyTitle ?? 'No data yet'}</p>
          <p className="admin-empty-state__text">{emptySub ?? empty ?? 'Records will appear here when available.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-catalog-data-table">{children}</table>
        </div>
      )}
    </div>
  )
}

function OfflineBanner() {
  return <ApiOfflineBanner />
}

/* ─────────────────────────────────────────────────────────────
   RETURNS / RMA
───────────────────────────────────────────────────────────── */

type RmaStatus = 'pending' | 'approved' | 'received' | 'refunded' | 'rejected'

const RMA_UI_FROM_API: Record<string, RmaStatus> = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ITEM_RECEIVED: 'received',
  REFUNDED: 'refunded',
}

interface RmaRow {
  id: string
  rmaNumber: string
  orderId: string
  customer: string
  reason: string
  items: string
  amount: number
  method: string
  status: RmaStatus
  updated: string
}

function ReturnsRmaPanel() {
  const { data: apiRows = [], isLoading, isError, refetch } = useReturns()
  const updateReturn = useUpdateReturnStatus()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RmaStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows: RmaRow[] = apiRows.map((r) => ({
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderId: r.orderId,
    customer: r.customer,
    reason: r.reason,
    items: r.items,
    amount: r.amount,
    method: r.method,
    status: r.status as RmaStatus,
    updated: r.updated,
  }))

  const applyStatus = async (
    row: RmaRow,
    status: 'APPROVED' | 'REJECTED' | 'ITEM_RECEIVED' | 'REFUNDED',
    note: string,
    refundAmount?: number,
  ) => {
    try {
      const saved = await updateReturn.mutateAsync({
        id: row.id,
        status,
        note,
        ...(refundAmount !== undefined ? { refundAmount } : {}),
      })
      const expectedUi = RMA_UI_FROM_API[status]
      if (!expectedUi || !verifyReturnStatus(saved, expectedUi)) return
      toastApiSaved(`RMA ${row.rmaNumber}`)
      void refetch()
      setExpandedId(null)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update RMA.')
    }
  }

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
    <div className="admin-panel-page settings-section-enter space-y-4">
      <CommerceToolbar
        summary={<><strong>{rows.length}</strong> requests · <strong>{openCount}</strong> open</>}
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
                        {row.rmaNumber}
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
                      <td colSpan={9} style={{ background: 'rgba(16, 17, 20, 0.08)', paddingTop: 12, paddingBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600, marginRight: 4 }}>Items: {row.items}</span>
                          {row.status === 'pending' && (
                            <>
                              <AdminButton
                                variant="gold"
                                size="sm"
                                loading={updateReturn.isPending}
                                onClick={() => applyStatus(row, 'APPROVED', 'Approved from admin panel')}
                              >
                                <CheckCircle2 size={13} /> Approve
                              </AdminButton>
                              <AdminButton
                                variant="danger"
                                size="sm"
                                loading={updateReturn.isPending}
                                onClick={() => {
                                  if (!window.confirm(`Reject RMA ${row.rmaNumber}?`)) return
                                  applyStatus(row, 'REJECTED', 'Rejected from admin panel')
                                }}
                              >
                                Reject
                              </AdminButton>
                            </>
                          )}
                          {row.status === 'approved' && (
                            <AdminButton
                              variant="gold"
                              size="sm"
                              loading={updateReturn.isPending}
                              onClick={() => applyStatus(row, 'ITEM_RECEIVED', 'Items received at warehouse')}
                            >
                              Mark received
                            </AdminButton>
                          )}
                          {row.status === 'received' && (
                            <AdminButton
                              variant="gold"
                              size="sm"
                              loading={updateReturn.isPending}
                              onClick={() => applyStatus(row, 'REFUNDED', 'Refund processed', row.amount)}
                            >
                              Process refund
                            </AdminButton>
                          )}
                          <AdminButton
                            size="sm"
                            onClick={() => window.open(`/dashboard/orders/${row.orderId}`, '_self')}
                          >
                            <Printer size={13} /> View order
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
    <div className="admin-panel-page settings-section-enter space-y-4">
      <CommerceToolbar
        summary={<><strong>{mapped.length}</strong> customers · subscription commerce</>}
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
                      <Repeat size={11} className="text-[var(--admin-accent)]" />
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
  const { navigate } = useAdminNavigate()
  const { data: apiRows = [], isLoading, isError, refetch, isFetched } = useInvoices()
  const { data: health, isError: healthError } = useInvoiceHealth()
  const { data: stats } = useInvoiceStats(30)
  const updatePayment = useUpdateOrderPayment()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')

  const rows = apiRows.map((r) => ({
    id: r.invoiceNumber,
    orderId: r.orderId,
    customer: r.customer,
    amount: r.amount,
    status: r.status as InvoiceStatus,
    due: r.due,
    issued: r.issued,
  }))

  const markRowPaid = async (row: (typeof rows)[number]) => {
    if (row.status === 'paid') return
    const evidence = collectPaymentEvidence(Number(row.amount))
    if (!evidence) return
    const ok = await confirmOrderPaymentSaved(
      row.orderId,
      () =>
        updatePayment.mutateAsync({
          id: row.orderId,
          paymentStatus: 'PAID',
          reference: evidence.reference,
          amount: evidence.amount,
        }),
      `Invoice ${row.id}`,
    )
    if (ok) void refetch()
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) => {
      const matchQ = !q || r.id.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q)
      return matchQ && (statusFilter === 'all' || r.status === statusFilter)
    })
  }, [query, statusFilter, rows])

  const outstanding = rows.filter((r) => ['sent', 'overdue'].includes(r.status)).reduce((s, r) => s + r.amount, 0)
  const overdueCount = rows.filter((r) => r.status === 'overdue').length
  const paidMtd = stats?.totalRevenue ?? rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)

  if (isError) return <OfflineBanner />

  return (
    <div className="admin-panel-page settings-section-enter space-y-4">
      <ModuleLiveStrip
        items={[
          {
            label: 'Invoice list API',
            value: isFetched ? `${rows.length} invoices loaded` : 'Connecting…',
            ok: isFetched && !isError,
            hint: 'GET /admin/commerce-finance/invoices',
          },
          {
            label: 'PDF & email routes',
            value: healthError ? 'Unreachable' : health?.status === 'ok' ? 'Ready' : 'Checking…',
            ok: !healthError && health?.status === 'ok',
            hint: health?.pdfRoute ?? '/admin/orders/:id/invoice/pdf',
          },
          {
            label: 'Latest invoice',
            value: health?.latestInvoice ?? '—',
            ok: Boolean(health?.latestInvoice),
          },
        ]}
      />

      <CommerceToolbar
        summary={<><strong>{rows.length}</strong> total · <strong>{formatBDT(outstanding)}</strong> outstanding</>}
        onRefresh={() => void refetch()}
      />

      <KpiStrip items={[
        { label: 'Outstanding', value: formatBDT(outstanding), icon: Clock, tone: 'warn' },
        { label: 'Revenue (30d)', value: formatBDT(paidMtd), icon: CheckCircle2, tone: 'success' },
        { label: 'Overdue', value: overdueCount, icon: AlertTriangle, tone: overdueCount > 0 ? 'danger' : 'neutral' },
        { label: 'Total invoices', value: stats?.totalInvoices ?? rows.length, icon: FileText, tone: 'neutral' },
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
                  <td>
                    <button
                      type="button"
                      className="admin-commerce-link"
                      onClick={() => navigate(`/dashboard/invoices/${row.orderId}`)}
                    >
                      {row.id}
                    </button>
                  </td>
                  <td style={{ fontWeight: 700 }}>{row.customer}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-commerce-link"
                      onClick={() => navigate(`/dashboard/orders/${row.orderId}`)}
                    >
                      {row.orderId.slice(0, 12)}
                    </button>
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
                        onClick={() => downloadInvoice(row.orderId)}
                        className="admin-commerce-icon-btn"
                        aria-label="View invoice"
                      >
                        <Download size={13} />
                      </button>
                      {row.status !== 'paid' && (
                        <button
                          type="button"
                          disabled={updatePayment.isPending}
                          onClick={() => markRowPaid(row)}
                          className="admin-commerce-icon-btn"
                          aria-label="Mark as paid"
                          title="Mark as paid"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      <RowActionsMenu
                        recordName={row.id}
                        moduleHref="/dashboard/invoices"
                        recordId={row.orderId}
                        actions={[
                          {
                            label: 'View details',
                            onClick: () => navigate(`/dashboard/invoices/${row.orderId}`),
                          },
                          {
                            label: 'Open order',
                            onClick: () => navigate(`/dashboard/orders/${row.orderId}`),
                          },
                          {
                            label: 'Download PDF',
                            onClick: () => downloadInvoicePdf(row.orderId, row.id),
                          },
                          ...(row.status !== 'paid'
                            ? [{
                                label: 'Mark as paid',
                                onClick: () => markRowPaid(row),
                              }]
                            : []),
                        ]}
                      />
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

function TransactionExpandDetail({
  txnId,
  orderId: _orderId,
  gateway,
  status,
  markingPaid,
  onMarkPaid,
  onOpenOrder,
}: {
  txnId: string
  orderId: string
  gateway: string
  status: TxnStatus
  markingPaid: boolean
  onMarkPaid: () => void
  onOpenOrder: () => void
}) {
  const { data: detail, isLoading } = useTransaction(txnId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isLoading && (
        <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>Loading payment details…</span>
      )}
      {detail && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div>
            <p className="admin-kpi__label">Method</p>
            <p style={{ fontSize: 12, fontWeight: 700 }}>{detail.method.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="admin-kpi__label">Payment #</p>
            <p style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 700 }}>
              {detail.paymentNumber ?? '—'}
            </p>
          </div>
          <div>
            <p className="admin-kpi__label">Gateway Txn ID</p>
            <p style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, fontWeight: 650 }}>{detail.ref}</p>
          </div>
          {detail.paidAt && (
            <div>
              <p className="admin-kpi__label">Paid at</p>
              <p style={{ fontSize: 12 }}>{formatRelativeTime(detail.paidAt)}</p>
            </div>
          )}
          {detail.failureReason && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p className="admin-kpi__label">Failure reason</p>
              <p style={{ fontSize: 12, color: 'var(--admin-danger)', fontWeight: 600 }}>{detail.failureReason}</p>
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {status === 'pending' && gateway === 'COD' && (
          <AdminButton variant="gold" size="sm" loading={markingPaid} onClick={onMarkPaid}>
            <CheckCircle2 size={13} /> Confirm COD payment
          </AdminButton>
        )}
        <AdminButton size="sm" onClick={onOpenOrder}>
          Open order
        </AdminButton>
      </div>
    </div>
  )
}

function TransactionsPanel() {
  const { navigate } = useAdminNavigate()
  const { data, isLoading, isError, refetch, isFetched } = useTransactions()
  const { data: health, isError: healthError } = useTransactionHealth()
  const updatePayment = useUpdateOrderPayment()
  const [query, setQuery] = useState('')
  const [gatewayFilter, setGatewayFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<TxnType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<TxnStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows = (data?.transactions ?? []).map((r) => ({
    id: r.id,
    paymentNumber: r.paymentNumber,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    gateway: r.gateway,
    type: r.type as TxnType,
    amount: r.amount,
    status: r.status as TxnStatus,
    ref: r.ref,
    time: formatRelativeTime(r.time),
  }))

  const markCodPaid = async (row: (typeof rows)[number]) => {
    const evidence = collectPaymentEvidence(Number(row.amount))
    if (!evidence) return
    const ok = await confirmOrderPaymentSaved(
      row.orderId,
      () =>
        updatePayment.mutateAsync({
          id: row.orderId,
          paymentStatus: 'PAID',
          reference: evidence.reference,
          amount: evidence.amount,
        }),
      `Payment ${row.orderNumber}`,
    )
    if (ok) {
      void refetch()
      setExpandedId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) => {
      const matchQ = !q || r.id.toLowerCase().includes(q) || r.orderNumber.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q)
      return matchQ
        && (gatewayFilter === 'all' || r.gateway === gatewayFilter)
        && (typeFilter === 'all' || r.type === typeFilter)
        && (statusFilter === 'all' || r.status === statusFilter)
    })
  }, [query, gatewayFilter, typeFilter, statusFilter, rows])

  const stats = data?.stats
  const gateways = [...new Set(rows.map((r) => r.gateway))]

  if (isError) return <OfflineBanner />

  return (
    <div className="admin-panel-page settings-section-enter space-y-4">
      <ModuleLiveStrip
        items={[
          {
            label: 'Transactions API',
            value: isFetched ? `${rows.length} payments loaded` : 'Connecting…',
            ok: isFetched && !isError,
            hint: 'GET /admin/commerce-finance/transactions',
          },
          {
            label: 'Payment gateways',
            value: healthError ? 'Unreachable' : (health?.gateways.join(', ') || 'None yet'),
            ok: !healthError && health?.status === 'ok',
            hint: `${health?.paymentCount ?? 0} total in DB`,
          },
          {
            label: 'Latest payment',
            value: health?.latestTxnId ?? '—',
            ok: Boolean(health?.latestTxnId),
          },
        ]}
      />

      <CommerceToolbar
        summary={<><strong>{rows.length}</strong> transactions · live payments</>}
        onRefresh={() => void refetch()}
      />

      <KpiStrip items={[
        { label: 'Volume', value: formatBDT(stats?.volume ?? 0), icon: Banknote, tone: 'gold' },
        { label: 'Success rate', value: stats ? `${stats.successRate}%` : '—', icon: TrendingUp, tone: 'success' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, tone: 'warn' },
        { label: 'Failed', value: stats?.failed ?? 0, icon: XCircle, tone: (stats?.failed ?? 0) > 0 ? 'danger' : 'neutral' },
      ]} />

      {(stats?.failed ?? 0) > 0 && (
        <div className="admin-commerce-alert admin-commerce-alert--warn">
          <AlertTriangle size={15} />
          <span>{stats?.failed} failed payment{(stats?.failed ?? 0) > 1 ? 's' : ''} need review</span>
        </div>
      )}

      <div className="admin-commerce-filter">
        <div className="admin-commerce-search">
          <Search size={14} className="text-[var(--admin-accent)]" />
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
        <div className="admin-commerce-chips">
          {(['all', 'success', 'pending', 'failed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`admin-commerce-chip${statusFilter === s ? ' admin-commerce-chip--active' : ''}`}
            >
              {s === 'all' ? 'All status' : s}
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
                {['Payment #', 'Order', 'Gateway', 'Type', 'Amount', 'Gateway Txn', 'Status', 'Time', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const paymentLabel = row.paymentNumber?.trim() || '—'
                const txnIdLabel = row.ref && row.ref !== '—' ? row.ref : '—'
                const canCopyTxn = txnIdLabel !== '—'
                return (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                        className="admin-commerce-link"
                        title={paymentLabel !== '—' ? paymentLabel : 'Serial pending'}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 700 }}>
                          {paymentLabel}
                        </span>
                        <ChevronDown size={12} style={{ flexShrink: 0, transition: 'transform 200ms', transform: expandedId === row.id ? 'rotate(180deg)' : 'none' }} />
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-commerce-link"
                        onClick={() => navigate(`/dashboard/orders/${row.orderId}`)}
                      >
                        {row.orderNumber}
                      </button>
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
                    <td
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10, color: 'var(--admin-text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={txnIdLabel}
                    >
                      {txnIdLabel}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{row.time}</td>
                    <td>
                      <RowActionsMenu
                        recordName={paymentLabel !== '—' ? paymentLabel : row.orderNumber}
                        moduleHref="/dashboard/transactions"
                        recordId={row.id}
                        actions={[
                          {
                            label: 'View details',
                            onClick: () => setExpandedId(row.id),
                          },
                          {
                            label: 'Open order',
                            onClick: () => navigate(`/dashboard/orders/${row.orderId}`),
                          },
                          {
                            label: 'Copy Payment #',
                            onClick: () => {
                              if (paymentLabel === '—') {
                                toastFail('Payment serial not assigned yet.')
                                return
                              }
                              void copyWithToast(paymentLabel, 'Payment # copied.')
                            },
                          },
                          {
                            label: 'Copy Gateway Txn',
                            onClick: () => {
                              if (!canCopyTxn) {
                                toastFail('No gateway transaction ID to copy yet.')
                                return
                              }
                              void copyWithToast(txnIdLabel, 'Gateway Txn copied.')
                            },
                          },
                          ...(row.status === 'pending' && row.gateway === 'COD'
                            ? [{
                                label: 'Confirm COD payment',
                                onClick: () => markCodPaid(row),
                              }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={9} style={{ background: 'rgba(16, 17, 20, 0.08)', paddingTop: 12, paddingBottom: 12 }}>
                        <TransactionExpandDetail
                          txnId={row.id}
                          orderId={row.orderId}
                          gateway={row.gateway}
                          status={row.status}
                          markingPaid={updatePayment.isPending}
                          onMarkPaid={() => markCodPaid(row)}
                          onOpenOrder={() => navigate(`/dashboard/orders/${row.orderId}`)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )})}
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
