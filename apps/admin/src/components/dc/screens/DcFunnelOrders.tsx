'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { toastCourierResult, toastOk, toastFail } from '@/lib/admin/feedback'
import { useBookCourier } from '@/lib/api/hooks'
import { DcHubFrame, hubCard, hubTh } from './DcHubKit'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { formatTaka } from '@/components/dc/tokens'
import { DcOrderDrawer } from '@/components/orders/DcOrderDrawer'
import { downloadInvoice, downloadBlob } from '@/lib/admin/admin-actions'

interface FunnelOrderRow {
  id: string
  invoiceNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  total: number | string
  subtotal: number | string
  deliveryCharge: number | string
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  shippingCity: string
  shippingDistrict?: string
  landingPage?: string
  trafficSource?: string
  createdAt: string
  store?: {
    name: string
    subdomain?: string
    domain?: string
  }
  items?: Array<{
    productName: string
    quantity: number
    price: number | string
  }>
  courier?: {
    trackingCode?: string
    status?: string
    provider?: string
    consignmentId?: string
  }
}

const STAGES = [
  'All',
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Delivered',
  'Cancelled',
] as const
type Stage = (typeof STAGES)[number]

export function DcFunnelOrders() {
  const router = useRouter()

  return (
    <DcScreenProvider screen="funnel-orders" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcFunnelOrdersBody />
    </DcScreenProvider>
  )
}

function DcFunnelOrdersBody() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL')
  const [selectedStage, setSelectedStage] = useState<Stage>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)

  const bookCourierMutation = useBookCourier()

  // 1. Fetch Funnel Orders
  const ordersQuery = useQuery({
    queryKey: ['admin-funnel-orders'],
    queryFn: async () => {
      const res = await apiFetch<FunnelOrderRow[]>('/admin/funnels/orders')
      return Array.isArray(res) ? res : []
    },
  })

  // 2. Status Change Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiFetch(`/admin/funnels/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    },
    onSuccess: (_data, vars) => {
      toastOk(`Order status updated to ${vars.status}`)
      void queryClient.invalidateQueries({ queryKey: ['admin-funnel-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['order', vars.id] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update order status'
      toastFail(msg)
    },
  })

  // 3. Delete Order Mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/admin/funnels/orders/${id}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      toastOk('Order permanently deleted')
      void queryClient.invalidateQueries({ queryKey: ['admin-funnel-orders'] })
      setOpenOrderId(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete order'
      toastFail(msg)
    },
  })

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])

  // Extract unique domains from orders for filter tabs
  const domains = useMemo(() => {
    const set = new Set<string>()
    orders.forEach((o) => {
      const d = o.store?.domain || (o.store?.subdomain ? `${o.store.subdomain}.splaro.co` : o.landingPage)
      if (d) set.add(d)
    })
    return Array.from(set)
  }, [orders])

  // Count orders per stage
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { All: orders.length }
    for (const s of STAGES) {
      if (s === 'All') continue
      counts[s] = orders.filter((o) => o.status.toUpperCase() === s.toUpperCase()).length
    }
    return counts
  }, [orders])

  // Filter orders by domain, stage, and search query
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Domain filter
      if (selectedDomain !== 'ALL') {
        const d = o.store?.domain || (o.store?.subdomain ? `${o.store.subdomain}.splaro.co` : o.landingPage)
        if (d !== selectedDomain) return false
      }

      // Stage filter
      if (selectedStage !== 'All') {
        if (o.status.toUpperCase() !== selectedStage.toUpperCase()) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchInvoice = o.invoiceNumber.toLowerCase().includes(q)
        const matchName = o.shippingName.toLowerCase().includes(q)
        const matchPhone = o.shippingPhone.includes(q)
        const matchCity = (o.shippingCity || '').toLowerCase().includes(q)
        const matchProduct = (o.items?.[0]?.productName || '').toLowerCase().includes(q)
        if (!matchInvoice && !matchName && !matchPhone && !matchCity && !matchProduct) {
          return false
        }
      }

      return true
    })
  }, [orders, selectedDomain, selectedStage, searchQuery])

  const handleBookCourier = (order: FunnelOrderRow) => {
    bookCourierMutation.mutate(
      { id: order.id, provider: 'STEADFAST' },
      {
        onSuccess: (data) => {
          toastCourierResult(data)
          void ordersQuery.refetch()
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Courier booking failed'
          toastFail(msg)
        },
      },
    )
  }

  const handleStatusChange = (order: FunnelOrderRow, newStatus: string) => {
    if (newStatus === order.status) return
    updateStatusMutation.mutate({ id: order.id, status: newStatus })
  }

  const handleCancelOrder = (order: FunnelOrderRow) => {
    const ok = window.confirm(`Are you sure you want to cancel order ${order.invoiceNumber}?`)
    if (ok) {
      updateStatusMutation.mutate({ id: order.id, status: 'CANCELLED' })
    }
  }

  const handleDeleteOrder = (order: FunnelOrderRow) => {
    const ok = window.confirm(
      `Are you sure you want to permanently delete order ${order.invoiceNumber}? This action cannot be undone.`,
    )
    if (ok) {
      deleteOrderMutation.mutate(order.id)
    }
  }

  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      toastFail('No orders to export')
      return
    }

    const headers = ['Invoice', 'Date', 'Customer', 'Phone', 'Address', 'Product', 'Quantity', 'Total', 'Domain', 'Status']
    const csvRows = [headers.join(',')]

    for (const o of filteredOrders) {
      const row = [
        `"${o.invoiceNumber}"`,
        `"${new Date(o.createdAt).toLocaleDateString('en-GB')}"`,
        `"${o.shippingName.replace(/"/g, '""')}"`,
        `"${o.shippingPhone}"`,
        `"${(o.shippingAddress + ', ' + o.shippingCity).replace(/"/g, '""')}"`,
        `"${(o.items?.[0]?.productName || '').replace(/"/g, '""')}"`,
        o.items?.[0]?.quantity || 1,
        o.total,
        `"${o.store?.domain || o.store?.subdomain || 'Funnel'}"`,
        `"${o.status}"`,
      ]
      csvRows.push(row.join(','))
    }

    downloadBlob(
      `funnel-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      csvRows.join('\n'),
      'text/csv;charset=utf-8;',
    )
    toastOk('Funnel orders CSV exported')
  }

  return (
    <DcHubFrame
      crumbGroup="D2C Funnels"
      title="Funnel Orders"
      queries={[ordersQuery]}
      actions={[
        {
          label: 'Export CSV',
          icon: 'Layers',
          variant: 'ghost',
          onClick: handleExportCsv,
        },
        {
          label: '← Funnel Universes',
          icon: 'Flame',
          variant: 'ghost',
          onClick: () => router.push('/dashboard/funnels'),
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stage Status Ladder Strip (Mirrors Main Orders Section) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {STAGES.map((s) => {
            const isSelected = selectedStage === s
            const count = stageCounts[s] ?? 0

            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedStage(s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  border: isSelected ? '1px solid var(--violet-solid)' : '1px solid var(--line)',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--violet-solid)' : 'var(--surface-2)',
                  color: isSelected ? 'var(--on-violet)' : 'var(--ink-2)',
                  whiteSpace: 'nowrap',
                  transition: 'all 150ms ease',
                }}
              >
                <span>{s}</span>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    color: isSelected ? 'var(--on-violet)' : 'var(--ink-3)',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Filter Controls: Search Bar & Domain Selector */}
        <div
          style={{
            ...hubCard,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by customer, phone, or DROP-1001..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--line)',
                color: 'var(--ink-1)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Domain Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedDomain('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
                border: selectedDomain === 'ALL' ? '1px solid var(--violet)' : '1px solid var(--line)',
                cursor: 'pointer',
                background: selectedDomain === 'ALL' ? 'var(--violet-soft)' : 'transparent',
                color: selectedDomain === 'ALL' ? 'var(--violet)' : 'var(--ink-3)',
              }}
            >
              All Domains
            </button>

            {domains.map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setSelectedDomain(dom)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  border: selectedDomain === dom ? '1px solid var(--violet)' : '1px solid var(--line)',
                  cursor: 'pointer',
                  background: selectedDomain === dom ? 'var(--violet-soft)' : 'transparent',
                  color: selectedDomain === dom ? 'var(--violet)' : 'var(--ink-3)',
                }}
              >
                {dom}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ ...hubCard, overflow: 'hidden' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
              <DcIcon name="ShoppingBag" size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>No Funnel Orders Found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {searchQuery || selectedStage !== 'All'
                  ? 'Try adjusting your stage filter or search term.'
                  : 'Orders placed through your D2C single-product drops will appear here automatically.'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={hubTh}>Invoice</th>
                    <th style={hubTh}>Customer & Location</th>
                    <th style={hubTh}>Drop Product</th>
                    <th style={hubTh}>Total & Delivery</th>
                    <th style={hubTh}>Universe Domain</th>
                    <th style={hubTh}>Status</th>
                    <th style={hubTh}>Courier Dispatch</th>
                    <th style={{ ...hubTh, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const firstItem = order.items?.[0]
                    const domainSource =
                      order.store?.domain ||
                      (order.store?.subdomain ? `${order.store.subdomain}.splaro.co` : order.landingPage) ||
                      'Funnel Drop'

                    return (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: '1px solid var(--line)',
                          transition: 'background 150ms ease',
                        }}
                      >
                        {/* 1. Invoice Number (Clickable to open drawer) */}
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          <button
                            type="button"
                            onClick={() => setOpenOrderId(order.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--violet)',
                              cursor: 'pointer',
                              padding: 0,
                              fontWeight: 700,
                              fontSize: 13,
                              textAlign: 'left',
                              textDecoration: 'underline',
                              textUnderlineOffset: 3,
                            }}
                          >
                            {order.invoiceNumber}
                          </button>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400, marginTop: 3 }}>
                            {new Date(order.createdAt).toLocaleDateString('en-GB')}
                          </div>
                        </td>

                        {/* 2. Customer & Phone */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>{order.shippingName}</div>
                          <div style={{ fontSize: 12, marginTop: 2 }}>
                            <a
                              href={`tel:${order.shippingPhone}`}
                              style={{ color: 'var(--ink-2)', textDecoration: 'none', fontFamily: 'monospace' }}
                            >
                              {order.shippingPhone}
                            </a>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, maxWidth: 220 }}>
                            {order.shippingAddress}, {order.shippingCity}
                          </div>
                        </td>

                        {/* 3. Product & Qty */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>
                            {firstItem?.productName ?? 'Funnel Drop Item'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                            Qty: <strong>{firstItem?.quantity ?? 1}</strong>
                          </div>
                        </td>

                        {/* 4. Total & Payment */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--ink-1)' }}>
                            {formatTaka(Number(order.total))}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                            Del: {formatTaka(Number(order.deliveryCharge))} ({order.paymentMethod})
                          </div>
                        </td>

                        {/* 5. Domain Source */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: 'var(--surface-2)',
                              color: 'var(--ink-2)',
                              border: '1px solid var(--line)',
                            }}
                          >
                            {domainSource}
                          </span>
                        </td>

                        {/* 6. Interactive Status Changer */}
                        <td style={{ padding: '14px 16px' }}>
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order, e.target.value)}
                            disabled={updateStatusMutation.isPending}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              border: '1px solid var(--line)',
                              background: 'var(--surface-2)',
                              color:
                                order.status === 'CONFIRMED' || order.status === 'DELIVERED'
                                  ? 'var(--ink-1)'
                                  : order.status === 'CANCELLED'
                                  ? 'var(--admin-c-f87171)'
                                  : 'var(--ink-2)',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="PROCESSING">PROCESSING</option>
                            <option value="PACKED">PACKED</option>
                            <option value="SHIPPED">SHIPPED</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </td>

                        {/* 7. Courier Dispatch */}
                        <td style={{ padding: '14px 16px' }}>
                          {order.courier?.trackingCode ? (
                            <div style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>
                                {order.courier.provider ?? 'Steadfast'}
                              </div>
                              <code style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                                {order.courier.trackingCode}
                              </code>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={bookCourierMutation.isPending || order.status === 'CANCELLED'}
                              onClick={() => handleBookCourier(order)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--line)',
                                background: 'var(--surface-2)',
                                color: 'var(--ink-1)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: order.status === 'CANCELLED' ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                opacity: order.status === 'CANCELLED' ? 0.4 : 1,
                              }}
                            >
                              <DcIcon name="Truck" size={13} />
                              Book Steadfast
                            </button>
                          )}
                        </td>

                        {/* 8. Actions (Details, Print, Cancel, Delete) */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {/* View Details Drawer */}
                            <button
                              type="button"
                              onClick={() => setOpenOrderId(order.id)}
                              title="View Full Order Details"
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                background: 'var(--surface-2)',
                                border: '1px solid var(--line)',
                                color: 'var(--ink-1)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Details
                            </button>

                            {/* Print / Download Invoice */}
                            <button
                              type="button"
                              onClick={() => downloadInvoice(order.id)}
                              title="Print Invoice"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: 'var(--surface-2)',
                                border: '1px solid var(--line)',
                                color: 'var(--ink-2)',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              <DcIcon name="FileText" size={13} />
                            </button>

                            {/* Cancel Order */}
                            {order.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(order)}
                                title="Cancel Order"
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: 'var(--admin-c-f87171)',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            )}

                            {/* Delete Order */}
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order)}
                              title="Permanently Delete Order"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: 'var(--admin-c-f87171)',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Full Order Drawer Integration */}
      {openOrderId && (
        <DcOrderDrawer
          orderId={openOrderId}
          onClose={() => {
            setOpenOrderId(null)
            void ordersQuery.refetch()
          }}
        />
      )}
    </DcHubFrame>
  )
}
