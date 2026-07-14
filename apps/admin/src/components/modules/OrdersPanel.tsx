'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  toastOk,
  toastFail,
  toastWarn,
  toastBulkOpResult,
  refreshWithToast,
  toastApiSaved,
} from '@/lib/admin/feedback'
import { verifyDeleteSuccess, verifyOrderStatus, verifyCodRisk } from '@/lib/admin/mutation-verify'
import { confirmCourierBookingSaved, toastBulkCourierHonesty } from '@/lib/admin/courier-save'
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
import { AdminSkeletonGroup } from '@/components/ui/AdminUiPrimitives'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { isNetworkOrServerError } from '@/lib/api/offline-defaults'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { downloadInvoice, exportTableFromContainer } from '@/lib/admin/admin-actions'
import { useOrders, useUpdateOrderStatus, useBookCourier, useBookCourierBulk, useBulkUpdateOrderStatus, useDeleteOrder, usePermission, useSetOrderCodRisk } from '@/lib/api/hooks'
import { useInfrastructureConfig } from '@/lib/api/integration-hooks'
import { mapPaymentMethod, fetchOrder, type ApiOrder } from '@/lib/api/orders'
import { displayOrderCode } from '@splaro/config'
import { cn } from '@/lib/utils/cn'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { OrderPreviewCard, CustomerAvatar } from '@/components/orders/OrderPreviewCard'
import { OrderStatusDropdown } from '@/components/orders/OrderStatusDropdown'
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
  address?: string
  district?: string
  trackingCode?: string | null
  consignmentId?: string | null
  courierStatus?: string
  paymentStatus?: string
  createdAt?: string
  updatedAt: string
  codRisk?: boolean
}

const API_STATUS_UI: Record<string, OrderStatus> = {
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

const PIPELINE: { key: OrderStatus | 'all'; label: string; count: (rows: OrderRow[]) => number }[] = [
  { key: 'all', label: 'All', count: (r) => r.length },
  { key: 'pending', label: 'Pending', count: (r) => r.filter((o) => o.status === 'pending').length },
  { key: 'confirmed', label: 'Confirmed', count: (r) => r.filter((o) => o.status === 'confirmed').length },
  { key: 'processing', label: 'Processing', count: (r) => r.filter((o) => o.status === 'processing').length },
  { key: 'packed', label: 'Packed', count: (r) => r.filter((o) => o.status === 'packed').length },
  { key: 'shipped', label: 'Shipped', count: (r) => r.filter((o) => o.status === 'shipped').length },
  { key: 'delivered', label: 'Delivered', count: (r) => r.filter((o) => o.status === 'delivered').length },
]

const SHIPPED_API_STATUSES =
  'SHIPPED,COURIER_BOOKED,PICKED_UP,IN_TRANSIT,OUT_FOR_DELIVERY'

const ORDER_API_STATUS: Partial<Record<OrderStatus, string>> = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  processing: 'PROCESSING',
  packed: 'PACKED',
  shipped: SHIPPED_API_STATUSES,
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
}

function formatPaymentCell(order: OrderRow): string {
  const method = order.payment
  const raw = order.paymentStatus?.trim()
  if (!raw) return method
  const status = raw.replace(/_/g, ' ').toUpperCase()
  return `${method} · ${status}`
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
  return {
    id: displayOrderCode(o.invoiceNumber, o.id),
    linkId: o.id,
    customer: o.shippingName,
    phone: o.shippingPhone,
    items: itemsLabel,
    lineItems,
    itemThumbs,
    itemCount,
    status: API_STATUS_UI[o.status] ?? 'pending',
    apiStatus: o.status,
    total: Number(o.total),
    payment: mapPaymentMethod(o.paymentMethod) as PaymentMethod,
    courier: o.courier?.provider ?? '—',
    city: o.shippingCity,
    ...(o.shippingAddress ? { address: o.shippingAddress } : {}),
    ...(o.shippingDistrict ? { district: o.shippingDistrict } : {}),
    ...(o.courier?.trackingCode ? { trackingCode: o.courier.trackingCode } : {}),
    ...(o.courier?.consignmentId ? { consignmentId: o.courier.consignmentId } : {}),
    ...(o.courier?.status ? { courierStatus: o.courier.status } : {}),
    ...(o.paymentStatus ? { paymentStatus: o.paymentStatus } : {}),
    ...(o.createdAt ? { createdAt: o.createdAt } : {}),
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

  const { data: apiOrders, isLoading, isError, error, refetch } = useOrders(orderQuery)
  const apiOffline = isError && isNetworkOrServerError(error)
  const { data: steadfast } = useInfrastructureConfig('steadfast')
  const courierReady = Boolean(steadfast?.configured)
  const updateStatus = useUpdateOrderStatus()
  const bookCourier = useBookCourier()
  const bookCourierBulk = useBookCourierBulk()
  const bulkStatus = useBulkUpdateOrderStatus()
  const deleteOrderMutation = useDeleteOrder()
  const setCodRisk = useSetOrderCodRisk()
  const canDeleteOrders = usePermission('orders', 'delete')
  const canEditOrders = usePermission('orders', 'edit')
  const handleDeleteOrder = async (order: OrderRow) => {
    const id = order.linkId ?? order.id
    if (!window.confirm(`Permanently delete order ${order.id}? Database record and items will be removed.`)) return
    try {
      const result = await deleteOrderMutation.mutateAsync(id)
      if (!verifyDeleteSuccess(result)) return
      toastApiSaved(`Order ${order.id}`)
      void refetch()
      setPreviewOrder((prev) => (prev?.id === order.id ? null : prev))
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not delete order.')
    }
  }

  const handleCodRiskToggle = async (order: OrderRow) => {
    const id = order.linkId ?? order.id
    const next = !order.codRisk
    try {
      const saved = await setCodRisk.mutateAsync({ id, isCodRisk: next })
      if (!verifyCodRisk(saved, next)) return
      toastApiSaved(`Order ${order.id} COD risk`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update COD risk flag.')
    }
  }

  const orderRowActions = (order: OrderRow) => [
    {
      label: 'View details',
      onClick: () => navigate(`/dashboard/orders/${order.linkId ?? order.id}`),
    },
    ...(canEditOrders && order.payment === 'COD'
      ? [
          {
            label: order.codRisk ? 'Clear COD risk flag' : 'Flag COD risk',
            onClick: () => void handleCodRiskToggle(order),
          },
        ]
      : []),
    ...(canDeleteOrders
      ? [
          {
            label: 'Delete permanently',
            tone: 'danger' as const,
            onClick: () => handleDeleteOrder(order),
          },
        ]
      : []),
  ]

  const sourceOrders = useMemo(
    () => (apiOrders?.orders ?? []).map(mapApiOrder),
    [apiOrders],
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previewOrder, setPreviewOrder] = useState<OrderRow | null>(null)
  const [sortBy, setSortBy] = useState<'updated' | 'total'>('updated')

  const previewOrderId = previewOrder?.id

  useEffect(() => {
    if (!previewOrderId) return
    const fresh = sourceOrders.find((o) => o.id === previewOrderId)
    if (fresh) setPreviewOrder(fresh)
  }, [sourceOrders, previewOrderId])

  const handleStatusChange = async (order: OrderRow, apiStatus: string, label: string) => {
    const id = order.linkId ?? order.id
    try {
      const saved = await updateStatus.mutateAsync({
        id,
        status: apiStatus,
        note: `Set to ${label} from orders list`,
      })
      if (!verifyOrderStatus(saved, apiStatus)) return
      toastApiSaved(`Order ${order.id} → ${label}`)
      void refetch()
    } catch {
      toastFail('Could not update order status.')
    }
  }

  const handleCancel = async (order: OrderRow) => {
    const id = order.linkId ?? order.id
    if (!window.confirm(`Cancel order ${order.id}?`)) return
    try {
      const saved = await updateStatus.mutateAsync({
        id,
        status: 'CANCELLED',
        note: 'Cancelled from admin panel',
      })
      if (!verifyOrderStatus(saved, 'CANCELLED')) return
      toastApiSaved(`Order ${order.id} cancellation`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not cancel order.')
    }
  }

  const verifyBulkStatusPersisted = async (
    targets: OrderRow[],
    status: string,
    res: { updated: number; failed: number },
  ): Promise<boolean> => {
    if (res.updated === 0 && targets.length > 0) {
      toastFail('Bulk update did not persist on server')
      return false
    }
    const sample = targets.find((o) => o.linkId)
    if (res.updated > 0 && sample?.linkId) {
      try {
        const fresh = await fetchOrder(sample.linkId)
        if (fresh.status !== status) {
          toastFail('Bulk update did not persist on server — refresh and retry')
          return false
        }
      } catch {
        toastFail('Bulk update saved but could not verify — refresh orders list')
        return false
      }
    }
    return true
  }

  const handleBulkProcessing = async () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) return
    const results = await Promise.allSettled(
      targets.map((order) =>
        updateStatus.mutateAsync({
          id: order.linkId!,
          status: 'PROCESSING',
          note: 'Bulk update from admin',
        }),
      ),
    )
    let ok = 0
    let fail = 0
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const status =
          result.value && typeof result.value === 'object' && 'status' in result.value
            ? String((result.value as { status: unknown }).status)
            : ''
        if (status === 'PROCESSING') ok += 1
        else fail += 1
      } else {
        fail += 1
      }
    }
    toastBulkOpResult(
      { updated: ok, failed: fail },
      {
        ok: (n) => `${n} orders marked processing.`,
        partial: (succeeded, failed) => `Processing: ${succeeded} updated, ${failed} failed.`,
        fail: 'Could not mark orders as processing.',
      },
    )
    if (ok > 0) setSelected(new Set())
    void refetch()
  }

  const handleBulkCancel = async () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) return
    if (!window.confirm(`Cancel ${targets.length} selected order(s)?`)) return
    try {
      const res = await bulkStatus.mutateAsync({
        orderIds: targets.map((o) => o.linkId!),
        status: 'CANCELLED',
        note: 'Bulk cancelled from admin',
      })
      if (!(await verifyBulkStatusPersisted(targets, 'CANCELLED', res))) return
      toastBulkOpResult(res, {
        ok: (n) => `${n} order(s) cancelled.`,
        partial: (ok, fail) => `${ok} cancelled, ${fail} failed.`,
        fail: 'Bulk cancel failed.',
      })
      setSelected(new Set())
      void refetch()
    } catch {
      toastFail('Bulk cancel failed.')
    }
  }

  const handleBulkPacked = async () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) return
    try {
      const res = await bulkStatus.mutateAsync({
        orderIds: targets.map((o) => o.linkId!),
        status: 'PACKED',
        note: 'Bulk packed from admin',
      })
      if (!(await verifyBulkStatusPersisted(targets, 'PACKED', res))) return
      toastBulkOpResult(res, {
        ok: (n) => `${n} order(s) marked packed.`,
        partial: (ok, fail) => `${ok} packed, ${fail} failed.`,
        fail: 'Bulk update failed.',
      })
      setSelected(new Set())
      void refetch()
    } catch {
      toastFail('Bulk update failed.')
    }
  }

  const handleBookCourier = async (order: OrderRow) => {
    const id = order.linkId
    if (!id) return
    if (!courierReady) {
      toastWarn('Steadfast not configured — save keys in Settings → Infrastructure.', 'courier-ready')
      return
    }
    try {
      const res = await bookCourier.mutateAsync({ id })
      const ok = await confirmCourierBookingSaved(res, id, order.id)
      if (ok) void refetch()
    } catch {
      toastFail('Could not book courier — is the API running?')
    }
  }

  const handleBulkCourier = async () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId && o.courier === '—')
    if (!targets.length) {
      toastFail('Select orders without courier assigned.')
      return
    }
    if (!courierReady) {
      toastWarn('Steadfast not configured — save keys in Settings → Infrastructure.', 'courier-ready-bulk')
      return
    }
    try {
      const res = await bookCourierBulk.mutateAsync({ orderIds: targets.map((o) => o.linkId!) })
      const { realBooked } = await toastBulkCourierHonesty(res)
      if (realBooked > 0) setSelected(new Set())
      void refetch()
    } catch {
      toastFail('Bulk courier booking failed — check API connection.')
    }
  }

  const handlePrintLabels = async () => {
    const targets = filtered.filter((o) => selected.has(o.id) && o.linkId)
    if (!targets.length) {
      toastFail('Select orders to print.')
      return
    }
    const batch = targets.slice(0, 10)
    let opened = 0
    let failed = 0
    for (const order of batch) {
      const ok = await downloadInvoice(order.id || order.linkId!)
      if (ok) opened += 1
      else failed += 1
    }
    if (targets.length > 10) {
      toastWarn(`Opened ${opened} of ${batch.length} invoices — ${targets.length - 10} more not opened.`)
      return
    }
    if (opened > 0 && failed === 0) {
      toastOk(`Opened ${opened} invoice(s) for printing.`)
    } else if (opened > 0) {
      toastWarn(`Opened ${opened} invoice(s); ${failed} failed — check API connection.`)
    } else {
      toastFail('Could not open invoices — check API connection.')
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
      {apiOffline ? (
        <ApiOfflineBanner onRetry={() => void refetch()} />
      ) : null}
      <header className="admin-ops-header">
        <div>
          <h2 className="admin-ops-header__title">Orders</h2>
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
          { label: 'Total', value: kpis.today, icon: ShoppingBag },
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
            <div className="p-4">
              <AdminSkeletonGroup rows={6} />
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
                  <th>Payment</th>
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
                      <span className="admin-type-badge" title={formatPaymentCell(order)}>
                        {formatPaymentCell(order)}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <OrderStatusDropdown
                        status={order.status}
                        loading={updateStatus.isPending}
                        disabled={!canEditOrders}
                        onSelect={(apiStatus, label) => handleStatusChange(order, apiStatus, label)}
                      />
                    </td>
                    <td>
                      <ProductThumbs images={order.itemThumbs} count={order.itemCount} />
                    </td>
                    <td className="font-semibold tabular-nums">{formatBDT(order.total)}</td>
                    <td className="admin-date-cell">{formatOrderDate(order.updatedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu recordName={order.id} moduleHref="/dashboard/orders" recordId={order.linkId ?? order.id} actions={orderRowActions(order)} />
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
            <span className="tabular-nums">{apiOrders?.page ?? page} / {Math.max(1, apiOrders?.totalPages ?? 1)}</span>
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
            advancing={updateStatus.isPending}
            bookingCourier={bookCourier.isPending}
            {...(canEditOrders
              ? {
                  onAdvance: async (nextStatus: string) => {
                    const id = previewOrder.linkId ?? previewOrder.id
                    try {
                      const saved = await updateStatus.mutateAsync({
                        id,
                        status: nextStatus,
                        note: 'Updated from order preview',
                      })
                      if (!verifyOrderStatus(saved, nextStatus)) return
                      toastApiSaved(`Order ${previewOrder.id}`)
                      setPreviewOrder((prev) =>
                        prev
                          ? {
                              ...prev,
                              apiStatus: nextStatus,
                              status: API_STATUS_UI[nextStatus] ?? prev.status,
                            }
                          : null,
                      )
                      void refetch()
                    } catch {
                      toastFail('Could not update order.')
                    }
                  },
                  onCancel: () => {
                    handleCancel(previewOrder)
                    setPreviewOrder(null)
                  },
                  onBookCourier: () => handleBookCourier(previewOrder),
                }
              : {})}
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
          {canEditOrders ? (
            <>
              <button type="button" className="admin-bulk-bar__btn" onClick={handleBulkProcessing}>
                <Package className="h-4 w-4" />
                Processing
              </button>
              <button type="button" className="admin-bulk-bar__btn" onClick={handleBulkPacked}>
                Mark packed
              </button>
              <button
                type="button"
                className="admin-bulk-bar__btn"
                disabled={!courierReady || bookCourierBulk.isPending}
                title={
                  courierReady
                    ? 'Book Steadfast courier'
                    : 'Steadfast not configured — Settings → Infrastructure'
                }
                onClick={handleBulkCourier}
              >
                <Truck className="h-4 w-4" />
                Courier
              </button>
              <button type="button" className="admin-bulk-bar__btn" onClick={handleBulkCancel}>
                Cancel
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
