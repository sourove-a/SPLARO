'use client'

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  toastOk,
  toastFail,
  toastWarn,
  toastCourierResult,
  toastBulkOpResult,
  refreshWithToast,
} from '@/lib/admin/feedback'
import {
  Search,
  Plus,
  RefreshCw,
  Download,
  Filter,
  Truck,
  Package,
  ChevronDown,
  Printer,
  X,
  ShoppingBag,
  Clock,
  Banknote,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { downloadInvoice, exportTableFromContainer } from '@/lib/admin/admin-actions'
import { useOrders, useUpdateOrderStatus, useBookCourier, useBookCourierBulk, useBulkUpdateOrderStatus } from '@/lib/api/hooks'
import { mapPaymentMethod, type ApiOrder } from '@/lib/api/orders'
import { cn } from '@/lib/utils/cn'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { OrderPreviewCard, CustomerAvatar } from '@/components/orders/OrderPreviewCard'
import { ProductThumbs } from '@/components/orders/OrderProductThumb'

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
type PaymentMethod = 'COD' | 'bKash' | 'SSLCommerz' | 'Paid'

interface OrderLineItem {
  name: string
  quantity: number
  lineTotal: number
  image?: string | null
}

interface OrderRow {
  id: string
  linkId?: string
  customer: string
  phone: string
  items: string
  lineItems: OrderLineItem[]
  itemThumbs: string[]
  itemCount: number
  status: OrderStatus
  apiStatus?: string
  total: number
  payment: PaymentMethod
  courier: string
  city: string
  updatedAt: string
  codRisk?: boolean
}

const PIPELINE: { key: OrderStatus | 'all'; label: string; count: (rows: OrderRow[]) => number }[] = [
  { key: 'all', label: 'All', count: (r) => r.length },
  { key: 'pending', label: 'Pending', count: (r) => r.filter((o) => o.status === 'pending').length },
  { key: 'confirmed', label: 'Confirmed', count: (r) => r.filter((o) => o.status === 'confirmed').length },
  { key: 'processing', label: 'Processing', count: (r) => r.filter((o) => o.status === 'processing').length },
  { key: 'packed', label: 'Packed', count: (r) => r.filter((o) => o.status === 'packed').length },
  { key: 'shipped', label: 'Shipped', count: (r) => r.filter((o) => o.status === 'shipped').length },
  { key: 'delivered', label: 'Delivered', count: (r) => r.filter((o) => o.status === 'delivered').length },
]

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'admin-status admin-status--pending',
  confirmed: 'admin-status admin-status--processing',
  processing: 'admin-status admin-status--processing',
  packed: 'admin-status admin-status--shipped',
  shipped: 'admin-status admin-status--shipped',
  delivered: 'admin-status admin-status--delivered',
  cancelled: 'admin-status admin-status--pending',
}

const ORDER_API_STATUS: Partial<Record<OrderStatus, string>> = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  processing: 'PROCESSING',
  packed: 'PACKED',
  shipped: 'SHIPPED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
}

function formatBDT(n: number) {
  return `৳${n.toLocaleString('en-BD')}`
}

function formatOrderDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function itemImage(item: ApiOrder['items'][number]): string | null {
  const fromItem = item.image?.trim()
  if (fromItem) return fromItem
  const fromVariant = item.variant?.image?.trim()
  if (fromVariant) return fromVariant
  return item.product?.images?.[0]?.url?.trim() || null
}

const PIPELINE_STAGES: { label: string; key: OrderStatus; count: (rows: OrderRow[]) => number }[] = [
  { label: 'Pending', key: 'pending', count: (r) => r.filter((o) => o.status === 'pending').length },
  { label: 'Confirmed', key: 'confirmed', count: (r) => r.filter((o) => o.status === 'confirmed').length },
  { label: 'Processing', key: 'processing', count: (r) => r.filter((o) => o.status === 'processing').length },
  { label: 'Packed', key: 'packed', count: (r) => r.filter((o) => o.status === 'packed').length },
  { label: 'Shipped', key: 'shipped', count: (r) => r.filter((o) => o.status === 'shipped').length },
  { label: 'Delivered', key: 'delivered', count: (r) => r.filter((o) => o.status === 'delivered').length },
]

function mapApiOrder(o: ApiOrder): OrderRow {
  const lineItems: OrderLineItem[] = (o.items ?? []).map((i) => {
    const qty = i.quantity
    const lineTotal = Number(i.subtotal ?? Number(i.price ?? 0) * qty)
    return {
      name: i.productName ?? i.product?.name ?? 'Item',
      quantity: qty,
      lineTotal,
      image: itemImage(i),
    }
  })
  const itemsLabel = lineItems.length
    ? lineItems.map((i) => `${i.name} ×${i.quantity}`).join(', ')
    : '—'
  const itemCount = lineItems.reduce((s, i) => s + i.quantity, 0) || 1
  const itemThumbs = lineItems.map((i) => i.image).filter((url): url is string => Boolean(url))
  const statusMap: Record<string, OrderStatus> = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    PACKED: 'packed',
    SHIPPED: 'shipped',
    COURIER_BOOKED: 'shipped',
    PICKED_UP: 'shipped',
    IN_TRANSIT: 'shipped',
    OUT_FOR_DELIVERY: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
  }
  return {
    id: o.invoiceNumber,
    linkId: o.id,
    customer: o.shippingName,
    phone: o.shippingPhone,
    items: itemsLabel,
    lineItems,
    itemThumbs,
    itemCount,
    status: statusMap[o.status] ?? 'pending',
    apiStatus: o.status,
    total: Number(o.total),
    payment: mapPaymentMethod(o.paymentMethod) as PaymentMethod,
    courier: o.courier?.provider ?? '—',
    city: o.shippingCity,
    updatedAt: o.updatedAt ?? o.createdAt,
    codRisk: o.isCodRisk,
  }
}

export function OrdersPanel() {
  const { navigate } = useAdminNavigate()
  const tableRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all')
  const orderQuery = useMemo(() => {
    const params: { limit: number; page: number; status?: string; search?: string } = { limit: 50, page }
    const apiStatus = statusFilter === 'all' ? undefined : ORDER_API_STATUS[statusFilter]
    if (apiStatus) params.status = apiStatus
    const q = query.trim()
    if (q) params.search = q
    return params
  }, [page, statusFilter, query])

  const { data: apiOrders, isLoading, isError, refetch } = useOrders(orderQuery)
  const updateStatus = useUpdateOrderStatus()
  const bookCourier = useBookCourier()
  const bookCourierBulk = useBookCourierBulk()
  const bulkStatus = useBulkUpdateOrderStatus()
  const sourceOrders = useMemo(
    () => (apiOrders?.orders ?? []).map(mapApiOrder),
    [apiOrders],
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previewOrder, setPreviewOrder] = useState<OrderRow | null>(null)
  const [sortBy, setSortBy] = useState<'updated' | 'total'>('updated')

  const handleConfirm = (order: OrderRow) => {
    const id = order.linkId ?? order.id
    const next =
      order.status === 'pending'
        ? 'CONFIRMED'
        : order.status === 'confirmed'
          ? 'PROCESSING'
          : order.status === 'processing'
            ? 'PACKED'
            : order.status === 'packed'
              ? 'SHIPPED'
              : order.status === 'shipped'
                ? 'DELIVERED'
                : 'CONFIRMED'
    updateStatus.mutate(
      { id, status: next, note: 'Updated from orders list' },
      {
        onSuccess: () => toastOk(`${order.id} updated.`),
        onError: () => toastFail('Could not update order.'),
      },
    )
  }

  const handleCancel = (order: OrderRow) => {
    const id = order.linkId ?? order.id
    if (!window.confirm(`Cancel order ${order.id}?`)) return
    updateStatus.mutate(
      { id, status: 'CANCELLED', note: 'Cancelled from admin panel' },
      {
        onSuccess: () => toastOk(`${order.id} cancelled.`),
        onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not cancel order.'),
      },
    )
  }

  const handleBulkProcessing = () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) return
    Promise.all(
      targets.map((order) =>
        updateStatus.mutateAsync({
          id: order.linkId!,
          status: 'PROCESSING',
          note: 'Bulk update from admin',
        }),
      ),
    )
      .then(() => {
        toastOk(`${targets.length} orders marked processing.`)
        setSelected(new Set())
      })
      .catch(() => toastFail('Some orders could not be updated.'))
  }

  const handleBulkCancel = () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) return
    if (!window.confirm(`Cancel ${targets.length} selected order(s)?`)) return
    bulkStatus.mutate(
      {
        orderIds: targets.map((o) => o.linkId!),
        status: 'CANCELLED',
        note: 'Bulk cancelled from admin',
      },
      {
        onSuccess: (res) => {
          toastBulkOpResult(res, {
            ok: (n) => `${n} order(s) cancelled.`,
            partial: (ok, fail) => `${ok} cancelled, ${fail} failed.`,
            fail: 'Bulk cancel failed.',
          })
          setSelected(new Set())
          void refetch()
        },
        onError: () => toastFail('Bulk cancel failed.'),
      },
    )
  }

  const handleBulkPacked = () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) return
    bulkStatus.mutate(
      { orderIds: targets.map((o) => o.linkId!), status: 'PACKED', note: 'Bulk packed from admin' },
      {
        onSuccess: (res) => {
          toastBulkOpResult(res, {
            ok: (n) => `${n} order(s) marked packed.`,
            partial: (ok, fail) => `${ok} packed, ${fail} failed.`,
            fail: 'Bulk update failed.',
          })
          setSelected(new Set())
          void refetch()
        },
        onError: () => toastFail('Bulk update failed.'),
      },
    )
  }

  const handleBookCourier = (order: OrderRow) => {
    const id = order.linkId
    if (!id) return
    bookCourier.mutate(
      { id },
      {
        onSuccess: (res) => {
          toastCourierResult(res, order.id)
          if (res.success && !res.simulated && res.consignmentId && !res.consignmentId.startsWith('DEV-')) {
            void refetch()
          }
        },
        onError: () => toastFail('Could not book courier — is the API running?'),
      },
    )
  }

  const handleBulkCourier = () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId && o.courier === '—')
    if (!targets.length) {
      toastFail('Select orders without courier assigned.')
      return
    }
    bookCourierBulk.mutate(
      { orderIds: targets.map((o) => o.linkId!) },
      {
        onSuccess: (res) => {
          toastBulkOpResult(res, {
            ok: (n) => `Courier booked for ${n} order(s).`,
            partial: (ok, fail) => `Courier: ${ok} booked, ${fail} failed.`,
            fail: 'Courier booking failed — Steadfast not connected or invalid keys.',
          })
          if (res.booked > 0) setSelected(new Set())
          void refetch()
        },
        onError: () => toastFail('Bulk courier booking failed — check API connection.'),
      },
    )
  }

  const handlePrintLabels = () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) {
      toastFail('Select orders to print.')
      return
    }
    for (const order of targets.slice(0, 10)) {
      downloadInvoice(order.linkId!)
    }
    if (targets.length > 10) {
      toastWarn(`Opened 10 invoices — ${targets.length - 10} more not opened.`)
    } else {
      toastOk(`Opened ${targets.length} invoice(s) for printing.`)
    }
  }

  const filtered = useMemo(() => {
    let rows = sourceOrders.filter((o) => paymentFilter === 'all' || o.payment === paymentFilter)
    if (sortBy === 'total') rows = [...rows].sort((a, b) => b.total - a.total)
    return rows
  }, [paymentFilter, sortBy, sourceOrders])

  const kpis = useMemo(() => {
    const total = apiOrders?.total ?? sourceOrders.length
    const pending = sourceOrders.filter((o) => o.status === 'pending').length
    const shipped = sourceOrders.filter((o) => ['shipped', 'delivered'].includes(o.status)).length
    const revenue = sourceOrders.reduce((s, o) => s + o.total, 0)
    return { today: total, pending, shipped, revenue }
  }, [apiOrders?.total, sourceOrders])

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((o) => o.id)))
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="admin-ops-page">
      <header className="admin-ops-header">
        <div>
          <h1 className="admin-ops-header__title">Orders</h1>
          <p className="admin-ops-header__sub">
            {apiOrders?.total ?? sourceOrders.length} total · {kpis.pending} awaiting action
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton onClick={() => { void refreshWithToast(() => refetch(), 'Orders refreshed.') }}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </AdminButton>
          <AdminButton
            onClick={() => {
              if (!exportTableFromContainer(tableRef.current, 'orders')) {
                toastFail('No order data to export.')
              }
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </AdminButton>
          <AdminButton variant="dark" onClick={() => navigate('/dashboard/orders/new')}>
            <Plus className="h-4 w-4" />
            New order
          </AdminButton>
        </div>
      </header>

      <div className="admin-kpi-grid">
        {[
          { label: 'Today', value: kpis.today, icon: ShoppingBag },
          { label: 'Pending', value: kpis.pending, icon: Clock },
          { label: 'Shipped', value: kpis.shipped, icon: Truck },
          { label: 'Revenue', value: formatBDT(kpis.revenue), icon: Banknote },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="admin-kpi">
            <span className="admin-kpi__icon"><Icon className="h-4 w-4" strokeWidth={1.75} /></span>
            <p className="admin-kpi__label">{label}</p>
            <p className="admin-kpi__value">{value}</p>
          </div>
        ))}
      </div>

      <div className="admin-pipeline-bar">
        {PIPELINE_STAGES.map(({ label, key, count }) => (
          <button
            key={key}
            type="button"
            className={cn('admin-pipeline-bar__stage', statusFilter === key && 'admin-pipeline-bar__stage--active')}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
          >
            <p className="admin-pipeline-bar__count">{count(sourceOrders)}</p>
            <p className="admin-pipeline-bar__label">{label}</p>
          </button>
        ))}
      </div>

      <div className="admin-ops-card">
        <div className="admin-ops-card__toolbar">
          <div className="admin-search max-w-sm flex-1 !min-w-[200px]">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search orders…"
              className="flex-1 bg-transparent text-sm font-medium text-[var(--admin-text-primary)] outline-none placeholder:text-[var(--admin-text-muted)]"
            />
          </div>
          <div className="admin-ops-card__tabs">
            {PIPELINE.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={cn('admin-ops-tab', statusFilter === key && 'admin-ops-tab--active')}
              >
                {label}
                <span className="admin-ops-tab__count">{count(sourceOrders)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-ops-card__filters">
          <Filter className="h-3.5 w-3.5 text-[var(--admin-text-muted)]" />
          {(['all', 'COD', 'bKash', 'SSLCommerz', 'Paid'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPaymentFilter(p)}
              className={cn('admin-filter-pill', paymentFilter === p && 'admin-filter-pill--active')}
            >
              {p === 'all' ? 'All payments' : p}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'updated' | 'total')}
            className="admin-ops-sort ml-auto rounded-lg border border-[var(--admin-glass-border)] bg-[var(--admin-surface-input)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-text-muted)] outline-none"
          >
            <option value="updated">Latest first</option>
            <option value="total">Highest value</option>
          </select>
        </div>

        <div className="overflow-x-auto" ref={tableRef}>
          {isLoading && sourceOrders.length === 0 ? (
            <div className="admin-table-skeleton">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="admin-table-skeleton__row" />
              ))}
            </div>
          ) : (
            <table className="admin-module-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      className="admin-checkbox"
                      aria-label="Select all orders"
                    />
                  </th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Total</th>
                  <th>Date</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      'admin-table-row',
                      selected.has(order.id) && 'is-selected',
                      previewOrder?.id === order.id && 'is-preview-target',
                    )}
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.closest('input, button, a, [role="menu"]')) return
                      setPreviewOrder(order)
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="admin-checkbox"
                        aria-label={`Select ${order.id}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewOrder(previewOrder?.id === order.id ? null : order)
                        }}
                        className="flex items-center gap-1 font-mono text-xs font-semibold text-[var(--admin-text-primary)] hover:text-[var(--admin-text-secondary)]"
                      >
                        #{order.id}
                        <ChevronDown className={cn('h-3 w-3 transition', previewOrder?.id === order.id && 'rotate-180')} />
                      </button>
                      {order.codRisk ? (
                        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">COD review</span>
                      ) : null}
                    </td>
                    <td>
                      <div className="admin-avatar-row">
                        <CustomerAvatar name={order.customer} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--admin-text-primary)]">{order.customer}</p>
                          <p className="truncate text-[10px] font-medium text-[var(--admin-text-muted)]">{order.city}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="admin-type-badge">
                        {order.payment === 'COD' ? 'COD' : 'Shipping'}
                      </span>
                    </td>
                    <td>
                      {order.status === 'cancelled' ? (
                        <span className="admin-status admin-status--cancelled">Cancelled</span>
                      ) : order.payment === 'Paid' || order.status === 'delivered' ? (
                        <span className="admin-status admin-status--paid">Paid</span>
                      ) : (
                        <button
                          type="button"
                          className={cn(STATUS_CLASS[order.status], 'cursor-pointer')}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleConfirm(order)
                          }}
                          title="Move to next order status"
                        >
                          {order.status}
                        </button>
                      )}
                    </td>
                    <td>
                      <ProductThumbs images={order.itemThumbs} count={order.itemCount} />
                    </td>
                    <td className="font-semibold tabular-nums">{formatBDT(order.total)}</td>
                    <td className="admin-date-cell">{formatOrderDate(order.updatedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu recordName={order.id} moduleHref="/dashboard/orders" recordId={order.linkId ?? order.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length === 0 && !isLoading ? (
          <div className="admin-empty-state">
            <div className="admin-empty-state__icon">
              <Package className="h-5 w-5" />
            </div>
            <p className="admin-empty-state__title">No orders found</p>
            <p className="admin-empty-state__text">Try adjusting your filters or search query.</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-[var(--admin-table-row-border)] px-4 py-3 text-xs font-medium text-[var(--admin-text-muted)]">
          <span>Showing {filtered.length} of {apiOrders?.total ?? sourceOrders.length}{isError ? ' · load error' : ''}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[var(--admin-glass-border)] px-2.5 py-1 text-[var(--admin-text-muted)] disabled:opacity-40 hover:bg-[var(--admin-surface-hover)]"
            >
              Prev
            </button>
            <span className="tabular-nums">{apiOrders?.page ?? page} / {apiOrders?.totalPages ?? 1}</span>
            <button
              type="button"
              disabled={(apiOrders?.page ?? page) >= (apiOrders?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[var(--admin-glass-border)] px-2.5 py-1 text-[var(--admin-text-muted)] disabled:opacity-40 hover:bg-[var(--admin-surface-hover)]"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {previewOrder ? (
          <OrderPreviewCard
            key={previewOrder.id}
            order={previewOrder}
            onClose={() => setPreviewOrder(null)}
            onAdvance={(nextStatus) => {
              const id = previewOrder.linkId ?? previewOrder.id
              updateStatus.mutate(
                { id, status: nextStatus, note: 'Updated from order preview' },
                {
                  onSuccess: () => {
                    toastOk(`${previewOrder.id} updated.`)
                    void refetch()
                    setPreviewOrder(null)
                  },
                  onError: () => toastFail('Could not update order.'),
                },
              )
            }}
            advancing={updateStatus.isPending}
            onCancel={() => {
              handleCancel(previewOrder)
              setPreviewOrder(null)
            }}
            onBookCourier={() => handleBookCourier(previewOrder)}
            bookingCourier={bookCourier.isPending}
          />
        ) : null}
      </AnimatePresence>

      {selected.size > 0 ? (
        <div className="admin-bulk-bar">
          <button type="button" className="admin-bulk-bar__close" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </button>
          <span className="admin-bulk-bar__count">Selected: {selected.size}</span>
          <span className="admin-bulk-bar__divider" />
          <button type="button" className="admin-bulk-bar__btn" onClick={() => {
            if (!exportTableFromContainer(tableRef.current, 'orders')) toastFail('No order data to export.')
          }}>
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" className="admin-bulk-bar__btn" onClick={handlePrintLabels}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button type="button" className="admin-bulk-bar__btn" onClick={handleBulkProcessing}>
            <Package className="h-4 w-4" />
            Processing
          </button>
          <button type="button" className="admin-bulk-bar__btn" onClick={handleBulkPacked}>
            Mark packed
          </button>
          <button type="button" className="admin-bulk-bar__btn" onClick={handleBulkCourier}>
            <Truck className="h-4 w-4" />
            Courier
          </button>
          <button type="button" className="admin-bulk-bar__btn" onClick={handleBulkCancel}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}
