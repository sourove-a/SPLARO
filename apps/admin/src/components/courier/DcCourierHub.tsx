'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useCourierShipments, useCourierStats, useCourierProviders } from '@/lib/api/hooks'
import {
  bookCourierShipment,
  retryCourierShipment,
  fetchCourierTracking,
  fetchCourierShipmentDetail,
  cancelCourierBookingLocal,
  updateCourierStatus,
  bulkUpdateCourierStatus,
  pickBookableCourierProvider,
  type CourierShipmentRow,
  type CourierProviderOption,
} from '@/lib/api/courier'
import { toastCourierResult, toastFail, toastInfo, toastOk, toastWarn } from '@/lib/admin/feedback'
import { isDevCourierConsignment, isLiveCourierConsignment } from '@/lib/admin/courier-save'
import { DcModal } from '@/components/dc/DcModal'
import { dcPageStatus } from '@/components/dc/page-status'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { formatBdPhone } from '@/lib/format/bd-phone'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const th = {
  textAlign: 'left' as const,
  padding: '9px 14px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const inputStyle = {
  minHeight: 34,
  padding: '6px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  outline: 0,
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `400 12px/1.4 ${FONT}`,
} as const

const COURIER_PROVIDERS = [
  { value: '', label: 'All Providers' },
  { value: 'STEADFAST', label: 'Steadfast Courier' },
  { value: 'PATHAO', label: 'Pathao Courier' },
  { value: 'REDX', label: 'REDX' },
  { value: 'PAPERFLY', label: 'Paperfly' },
  { value: 'SUNDARBAN', label: 'Sundarban Courier' },
  { value: 'SA_PARIBAHAN', label: 'SA Paribahan' },
] as const

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Shipments' },
  { key: 'QUEUED', label: 'Queued / Pending' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'FAILED', label: 'Failed / Cancelled' },
] as const

const STATE_TONE: Record<string, DcTone> = {
  PENDING: 'warn',
  QUEUED: 'warn',
  BOOKED: 'info',
  IN_TRANSIT: 'info',
  PICKED_UP: 'info',
  DELIVERED: 'ok',
  FAILED: 'bad',
  CANCELLED: 'bad',
  RETURNED: 'bad',
}

function label(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())
}

function providerOptionLabel(p: CourierProviderOption, recommended: boolean) {
  if (!p.configured) return `${p.label} — Setup required`
  if (recommended && p.recommended) return `${p.label} (Recommended)`
  return p.label
}

function bookingSelectOptions(loaded: CourierProviderOption[]): CourierProviderOption[] {
  if (loaded.length > 0) return loaded
  return COURIER_PROVIDERS.filter((p) => p.value).map((p) => ({
    value: p.value,
    label: p.label,
    recommended: p.value === 'STEADFAST',
    configured: false,
  }))
}

function stableTime(value?: string | null) {
  if (!value) return '—'
  if (!value.includes('T')) return value
  return `${value.replace('T', ' ').slice(0, 16)} UTC`
}

export function DcCourierHub() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="courier" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCourierBody />
    </DcScreenProvider>
  )
}

function DcCourierBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const providersQuery = useCourierProviders()
  const bookingProviders = providersQuery.data?.providers ?? []

  // Filters and search state
  const [statusTab, setStatusTab] = useState<string>('ALL')
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 40

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modal states
  const [confirmBook, setConfirmBook] = useState<{ orderId: string; invoice: string } | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('STEADFAST')

  const [confirmRetry, setConfirmRetry] = useState<{ orderId: string; invoice: string } | null>(null)
  const [retryProvider, setRetryProvider] = useState<string>('STEADFAST')

  const [trackingModal, setTrackingModal] = useState<{ orderId: string; invoice: string } | null>(null)
  const [detailModal, setDetailModal] = useState<{ orderId: string; invoice: string } | null>(null)

  const [statusOverride, setStatusOverride] = useState<{ orderId: string; invoice: string; current: string } | null>(null)
  const [overrideStatusVal, setOverrideStatusVal] = useState<string>('DELIVERED')
  const [overrideNote, setOverrideNote] = useState<string>('')

  const [cancelModal, setCancelModal] = useState<{ orderId: string; invoice: string } | null>(null)
  const [cancelNote, setCancelNote] = useState<string>('')

  const [bulkStatusModal, setBulkStatusModal] = useState<boolean>(false)
  const [bulkStatusVal, setBulkStatusVal] = useState<string>('DELIVERED')
  const [bulkStatusNote, setBulkStatusNote] = useState<string>('')

  // Query parameters mapping
  const queryParams = useMemo(() => {
    const p: { status?: string; provider?: string; search?: string; page: number; limit: number } = {
      page,
      limit: pageSize,
    }
    if (statusTab === 'QUEUED') p.status = 'PENDING'
    else if (statusTab === 'IN_TRANSIT') p.status = 'IN_TRANSIT'
    else if (statusTab === 'DELIVERED') p.status = 'DELIVERED'
    else if (statusTab === 'FAILED') p.status = 'FAILED'

    if (providerFilter) p.provider = providerFilter
    if (searchQuery.trim()) p.search = searchQuery.trim()
    return p
  }, [statusTab, providerFilter, searchQuery, page])

  const shipments = useCourierShipments(queryParams)
  const stats = useCourierStats(30)
  const { api } = useAdminConnection(25_000)

  // Tracking query for tracking modal
  const liveTracking = useQuery({
    queryKey: ['courier-track', trackingModal?.orderId],
    queryFn: () => (trackingModal ? fetchCourierTracking(trackingModal.orderId) : null),
    enabled: Boolean(trackingModal?.orderId),
    staleTime: 10_000,
  })

  // Shipment detail query for detail modal
  const shipmentDetail = useQuery({
    queryKey: ['courier-detail', detailModal?.orderId],
    queryFn: () => (detailModal ? fetchCourierShipmentDetail(detailModal.orderId) : null),
    enabled: Boolean(detailModal?.orderId),
    staleTime: 15_000,
  })

  const rows = useMemo(() => shipments.data?.items ?? [], [shipments.data])
  const totalCount = shipments.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const byStatus = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of stats.data?.byStatus ?? []) m[s.status.toUpperCase()] = s._count
    return m
  }, [stats.data])

  const queued = (byStatus['PENDING'] ?? 0) + (byStatus['QUEUED'] ?? 0)
  const inTransit = byStatus['IN_TRANSIT'] ?? 0
  const delivered = byStatus['DELIVERED'] ?? 0
  const failed = (byStatus['FAILED'] ?? 0) + (byStatus['CANCELLED'] ?? 0) + (byStatus['RETURNED'] ?? 0)
  const recentFailed = stats.data?.recentFailed ?? []

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['courier-shipments'] }),
      qc.invalidateQueries({ queryKey: ['courier-stats'] }),
      qc.invalidateQueries({ queryKey: ['orders'] }),
    ])
  }

  // ── MUTATIONS ─────────────────────────────────────────────

  const bookMutation = useMutation({
    mutationFn: ({ orderId, provider }: { orderId: string; provider?: string }) =>
      bookCourierShipment(orderId, provider),
    onSuccess: (res, variables) => {
      void invalidate()
      const inv = confirmBook?.invoice ?? variables.orderId
      setConfirmBook(null)
      toastCourierResult(
        {
          success: Boolean(res.consignmentId || res.status === 'BOOKED' || res.status === 'IN_REVIEW'),
          ...(res.consignmentId ? { consignmentId: res.consignmentId } : {}),
          ...(res.simulated ? { simulated: true } : {}),
        },
        inv,
      )
    },
    onError: (err) => {
      setConfirmBook(null)
      toastFail(err instanceof Error ? err.message : 'Booking failed')
    },
  })

  const retryMutation = useMutation({
    mutationFn: ({ orderId, provider }: { orderId: string; provider?: string }) =>
      retryCourierShipment(orderId, provider),
    onSuccess: (res, variables) => {
      void invalidate()
      const inv = confirmRetry?.invoice ?? variables.orderId
      setConfirmRetry(null)
      toastCourierResult(
        {
          success: Boolean(res.consignmentId),
          ...(res.consignmentId ? { consignmentId: res.consignmentId } : {}),
        },
        inv,
      )
    },
    onError: (err) => {
      setConfirmRetry(null)
      toastFail(err instanceof Error ? err.message : 'Retry failed')
    },
  })

  const overrideStatusMutation = useMutation({
    mutationFn: ({ orderId, status, note }: { orderId: string; status: string; note?: string }) =>
      updateCourierStatus(orderId, status, note),
    onSuccess: () => {
      void invalidate()
      setStatusOverride(null)
      toastOk('Courier status updated successfully')
    },
    onError: (err) => {
      toastFail(err instanceof Error ? err.message : 'Status update failed')
    },
  })

  const cancelLocalMutation = useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note?: string }) =>
      cancelCourierBookingLocal(orderId, note),
    onSuccess: () => {
      void invalidate()
      setCancelModal(null)
      toastInfo('Booking cancelled locally · Marked as CANCELLED in database.')
    },
    onError: (err) => {
      toastFail(err instanceof Error ? err.message : 'Cancellation failed')
    },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: ({ orderIds, status, note }: { orderIds: string[]; status: string; note?: string }) =>
      bulkUpdateCourierStatus(orderIds, status, note),
    onSuccess: (res) => {
      void invalidate()
      setSelectedIds([])
      setBulkStatusModal(false)
      toastOk(`Updated ${res.updated} shipment(s) to ${bulkStatusVal}`)
    },
    onError: (err) => {
      toastFail(err instanceof Error ? err.message : 'Bulk status update failed')
    },
  })

  // ── SELECTION HANDLERS ────────────────────────────────────

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.orderId))

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(rows.map((r) => r.orderId))
    }
  }

  const toggleSelectRow = (orderId: string) => {
    setSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    )
  }

  // ── CSV EXPORT ─────────────────────────────────────────────

  const exportCsv = () => {
    if (rows.length === 0) {
      toastWarn('No rows to export')
      return
    }
    const headers = ['Order', 'Recipient', 'Phone', 'Provider', 'ConsignmentID', 'TrackingCode', 'State', 'Updated']
    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        [
          `"${r.order?.invoiceNumber ?? r.orderId}"`,
          `"${(r.order?.shippingName ?? '').replace(/"/g, '""')}"`,
          `"${r.order?.shippingPhone ?? ''}"`,
          `"${r.provider}"`,
          `"${r.consignmentId ?? ''}"`,
          `"${r.trackingCode ?? ''}"`,
          `"${r.status}"`,
          `"${r.updatedAt}"`,
        ].join(','),
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `splaro-courier-shipments-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toastOk('Shipment CSV exported')
  }

  const skeleton: DcBlock[] = [
    { t: 'banner', tone: 'info', icon: 'icon-info', text: '' },
    { t: 'kpis', items: [] },
    { t: 'table', w: 'main', title: '', cols: [], rows: [] },
    { t: 'list', w: 'side', title: '', items: [] },
  ]

  const pageStatus = dcPageStatus([shipments, stats], api.pulse)

  return (
    <>
      <DcPageHead
        crumbGroup="Operations"
        title="Courier Hub"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={shipments.isFetching ? 'syncing…' : `${totalCount} shipments`}
        syncing={shipments.isFetching}
        onSync={() => {
          void shipments.refetch()
          void stats.refetch()
        }}
        actions={[
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
          {
            label: 'Sync statuses',
            icon: 'icon-refresh-cw',
            onClick: () => {
              void shipments.refetch()
              void stats.refetch()
              toast('info', 'Refreshing shipments', 'Pulls latest rows from courier API cache.')
            },
          },
        ]}
      />

      {shipments.isLoading && !shipments.data ? (
        <DcLoadingState blocks={skeleton} />
      ) : shipments.error ? (
        <DcErrorState
          error={`GET /admin/courier → ${shipments.error instanceof Error ? shipments.error.message : '500 Internal Server Error'}`}
          hint="Parcels already handed over are unaffected — only this view failed to load."
          onRetry={() => {
            void shipments.refetch()
          }}
        />
      ) : (
        <>
          {/* Mobile Courier List */}
          <MobileCourierList
            rows={rows}
            onOpenOrder={(invoice) => router.push(`/dashboard/orders/${invoice}`)}
            onBook={(orderId, invoice) => setConfirmBook({ orderId, invoice })}
            onRetry={(orderId, invoice) => setConfirmRetry({ orderId, invoice })}
            onTrack={(orderId, invoice) => setTrackingModal({ orderId, invoice })}
          />

          <div className="dc-desktop-route-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Honesty Info Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '11px 14px',
                borderRadius: 11,
                border: '1px solid var(--info-bd)',
                background: 'var(--info-soft)',
              }}
            >
              <DcIcon name="icon-info" size={15} color="var(--info)" />
              <span style={{ flex: 1, font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-2)' }}>
                A parcel only reads <strong style={{ color: 'var(--ink)' }}>Booked</strong> once the courier API returns a valid consignment ID. Until then it stays <strong style={{ color: 'var(--ink)' }}>Queued</strong> — no optimistic green states.
              </span>
            </div>

            {/* KPIs Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))',
                gap: 12,
              }}
            >
              <Kpi label="Queued" value={String(queued)} sub="waiting for consignment ID" color={queued > 0 ? 'var(--warn)' : 'var(--ink)'} />
              <Kpi label="In transit" value={String(inTransit)} sub="with courier network" color="var(--info)" />
              <Kpi label="Delivered · 30d" value={String(delivered)} sub="completed deliveries" color="var(--ok)" />
              <Kpi label="Failed · 30d" value={String(failed)} sub="need retry / review" color={failed > 0 ? 'var(--bad)' : 'var(--ink)'} />
            </div>

            {/* Main Content Area */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', width: '100%' }}>
              {/* Left Shipments Table Panel */}
              <div style={{ flex: '1 1 64%', minWidth: 340, maxWidth: '100%' }}>
                <div style={{ ...card, overflow: 'hidden' }}>
                  {/* Toolbar with Search and Filters */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {/* Status Tabs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {STATUS_FILTERS.map((tab) => {
                        const active = statusTab === tab.key
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => {
                              setStatusTab(tab.key)
                              setPage(1)
                            }}
                            style={{
                              padding: '5px 11px',
                              borderRadius: 8,
                              border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                              background: active ? 'var(--violet-soft)' : 'var(--surface-2)',
                              color: active ? 'var(--violet)' : 'var(--ink-2)',
                              font: `600 11.5px/1 ${FONT}`,
                              cursor: 'pointer',
                            }}
                          >
                            {tab.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Search & Provider Filter Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', flex: '1 1 220px' }}>
                        <input
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value)
                            setPage(1)
                          }}
                          placeholder="Search invoice, customer, consignment, tracking…"
                          style={{ ...inputStyle, width: '100%', paddingLeft: 28 }}
                        />
                        <span style={{ position: 'absolute', left: 9, top: 10, color: 'var(--ink-3)', pointerEvents: 'none' }}>
                          <DcIcon name="icon-search" size={13} />
                        </span>
                      </div>

                      <select
                        value={providerFilter}
                        onChange={(e) => {
                          setProviderFilter(e.target.value)
                          setPage(1)
                        }}
                        style={{ ...inputStyle, flex: '0 0 auto' }}
                      >
                        {COURIER_PROVIDERS.map((p) => {
                          const meta = bookingProviders.find((row) => row.value === p.value)
                          const setupNeeded = Boolean(p.value && meta && !meta.configured)
                          return (
                            <option key={p.value || 'all'} value={p.value}>
                              {setupNeeded ? `${p.label} — Setup required` : p.label}
                            </option>
                          )
                        })}
                      </select>

                      {selectedIds.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                          <span style={{ font: `600 11.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {selectedIds.length} selected
                          </span>
                          <button
                            type="button"
                            onClick={() => setBulkStatusModal(true)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 7,
                              border: '1px solid var(--violet-bd)',
                              background: 'var(--violet-soft)',
                              color: 'var(--violet)',
                              font: `600 11.5px/1 ${FONT}`,
                              cursor: 'pointer',
                            }}
                          >
                            Bulk Status
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedIds([])}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 7,
                              border: '1px solid var(--line)',
                              background: 'var(--surface-2)',
                              color: 'var(--ink-3)',
                              font: `500 11px/1 ${FONT}`,
                              cursor: 'pointer',
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Table Content */}
                  {rows.length === 0 ? (
                    <div style={{ padding: '42px 18px', textAlign: 'center' }}>
                      <DcIcon name="icon-truck" size={24} color="var(--ink-3)" />
                      <p style={{ margin: '12px 0 4px', font: `600 14px/1 ${FONT}`, color: 'var(--ink)' }}>
                        No matching shipments found
                      </p>
                      <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                        Try clearing search terms or selecting a different status filter.
                      </span>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: 840, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ ...th, width: 36, textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleSelectAll}
                                style={{ cursor: 'pointer' }}
                              />
                            </th>
                            <th style={th}>Order</th>
                            <th style={th}>Recipient</th>
                            <th style={th}>Provider</th>
                            <th style={th}>Consignment / Tracking</th>
                            <th style={th}>State</th>
                            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => {
                            const isSelected = selectedIds.includes(r.orderId)
                            const tone = toneStyle(STATE_TONE[r.status.toUpperCase()] ?? 'mute')
                            const booked = isLiveCourierConsignment(r.consignmentId, r.trackingCode)
                            const simulated = isDevCourierConsignment(r.consignmentId, r.trackingCode)
                            const hasFailed = ['FAILED', 'CANCELLED', 'RETURNED'].includes(r.status.toUpperCase())
                            const isQueued = ['PENDING', 'QUEUED'].includes(r.status.toUpperCase())
                            const cnLabel = r.consignmentId ?? r.trackingCode ?? '—'

                            return (
                              <tr
                                key={r.id}
                                className="dc-hover-surface"
                                style={{
                                  borderBottom: '1px solid var(--line)',
                                  background: isSelected ? 'var(--violet-soft)' : undefined,
                                }}
                              >
                                <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectRow(r.orderId)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ padding: '11px 14px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/dashboard/orders/${r.orderId}`)}
                                      style={{
                                        border: 0,
                                        background: 'transparent',
                                        padding: 0,
                                        font: `600 12.5px/1 ${MONO}`,
                                        color: 'var(--violet)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      {r.order?.invoiceNumber ?? r.orderId}
                                    </button>
                                    <span style={{ font: `400 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                                      Order: {r.order?.status ?? '—'}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '11px 14px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <strong style={{ font: `500 12.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>
                                      {r.order?.shippingName ?? '—'}
                                    </strong>
                                    <span style={{ font: `400 11px/1.2 ${MONO}`, color: 'var(--ink-3)' }}>
                                      {r.order?.shippingPhone ? formatBdPhone(r.order.shippingPhone) : '—'}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '11px 14px', font: `600 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                                  {r.provider}
                                </td>
                                <td style={{ padding: '11px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                      style={{
                                        font: `500 12px/1 ${MONO}`,
                                        color: booked ? 'var(--ink)' : simulated ? 'var(--warn)' : 'var(--ink-3)',
                                      }}
                                    >
                                      {simulated ? `${cnLabel} · sim` : cnLabel}
                                    </span>
                                    {cnLabel !== '—' ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void navigator.clipboard.writeText(cnLabel)
                                          toastOk('Consignment copied')
                                        }}
                                        title="Copy Consignment ID"
                                        style={{
                                          border: 0,
                                          background: 'transparent',
                                          color: 'var(--ink-3)',
                                          cursor: 'pointer',
                                          padding: 2,
                                        }}
                                      >
                                        <DcIcon name="icon-copy" size={11} />
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                                <td style={{ padding: '11px 14px' }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '3px 8px',
                                      borderRadius: 6,
                                      font: `600 11px/1 ${FONT}`,
                                      border: `1px solid ${tone.bd}`,
                                      background: tone.bg,
                                      color: tone.fg,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                                    {label(r.status)}
                                  </span>
                                </td>
                                <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {/* Quick action button depending on status */}
                                    {isQueued ? (
                                      <button
                                        type="button"
                                        disabled={bookMutation.isPending}
                                        onClick={() => {
                                          setSelectedProvider(pickBookableCourierProvider(r.provider, bookingProviders))
                                          setConfirmBook({ orderId: r.orderId, invoice: r.order?.invoiceNumber ?? r.orderId })
                                        }}
                                        style={{
                                          height: 28,
                                          padding: '0 10px',
                                          borderRadius: 7,
                                          border: '1px solid var(--violet-solid)',
                                          background: 'var(--violet-solid)',
                                          color: 'var(--on-violet)',
                                          cursor: 'pointer',
                                          font: `600 11.5px/1 ${FONT}`,
                                        }}
                                      >
                                        Book
                                      </button>
                                    ) : hasFailed ? (
                                      <button
                                        type="button"
                                        disabled={retryMutation.isPending}
                                        onClick={() => {
                                          setRetryProvider(pickBookableCourierProvider(r.provider, bookingProviders))
                                          setConfirmRetry({ orderId: r.orderId, invoice: r.order?.invoiceNumber ?? r.orderId })
                                        }}
                                        style={{
                                          height: 28,
                                          padding: '0 10px',
                                          borderRadius: 7,
                                          border: '1px solid var(--bad-bd)',
                                          background: 'var(--bad-soft)',
                                          color: 'var(--bad)',
                                          cursor: 'pointer',
                                          font: `600 11.5px/1 ${FONT}`,
                                        }}
                                      >
                                        Retry
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setTrackingModal({ orderId: r.orderId, invoice: r.order?.invoiceNumber ?? r.orderId })}
                                        style={{
                                          height: 28,
                                          padding: '0 9px',
                                          borderRadius: 7,
                                          border: '1px solid var(--line)',
                                          background: 'var(--surface-2)',
                                          color: 'var(--ink)',
                                          cursor: 'pointer',
                                          font: `600 11.5px/1 ${FONT}`,
                                        }}
                                      >
                                        Track
                                      </button>
                                    )}

                                    {/* Action Dropdown / Detail Menu */}
                                    <button
                                      type="button"
                                      onClick={() => setDetailModal({ orderId: r.orderId, invoice: r.order?.invoiceNumber ?? r.orderId })}
                                      title="View Details & Webhook Timeline"
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 7,
                                        border: '1px solid var(--line)',
                                        background: 'var(--surface-2)',
                                        color: 'var(--ink-2)',
                                        cursor: 'pointer',
                                        display: 'grid',
                                        placeItems: 'center',
                                      }}
                                    >
                                      <DcIcon name="icon-more-vertical" size={13} />
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

                  {/* Pagination Footer */}
                  {totalCount > pageSize ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderTop: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                        Showing {Math.min((page - 1) * pageSize + 1, totalCount)}–{Math.min(page * pageSize, totalCount)} of {totalCount}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: page <= 1 ? 'var(--ink-4)' : 'var(--ink)',
                            cursor: page <= 1 ? 'not-allowed' : 'pointer',
                            font: `600 11px/1 ${FONT}`,
                          }}
                        >
                          Prev
                        </button>
                        <span style={{ padding: '4px 8px', font: `600 11px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {page} / {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: page >= totalPages ? 'var(--ink-4)' : 'var(--ink)',
                            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                            font: `600 11px/1 ${FONT}`,
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Right Sidebar: Intelligence & Providers */}
              <div style={{ flex: '1 1 30%', minWidth: 290, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Providers Performance Card */}
                <div style={{ ...card, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--violet)',
                      }}
                    >
                      <DcIcon name="icon-truck" size={14} />
                    </span>
                    <span style={{ flex: 1, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                      Connected Couriers
                    </span>
                  </div>
                  {(stats.data?.byProvider ?? []).length === 0 ? (
                    <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                      No provider has handled a parcel in the last 30 days.
                    </span>
                  ) : (
                    (stats.data?.byProvider ?? []).map((p) => (
                      <div key={p.provider} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--ok)' }} />
                        <span style={{ flex: 1, font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                          {p.provider}
                        </span>
                        <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {p._count}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Recent Booking Failures Card */}
                {recentFailed.length > 0 ? (
                  <div
                    style={{
                      border: '1px solid var(--bad-bd)',
                      borderRadius: 14,
                      background: 'var(--bad-soft)',
                      padding: '13px 15px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DcIcon name="icon-triangle-alert" size={13} color="var(--bad)" />
                      <span
                        style={{
                          flex: 1,
                          font: `700 10.5px/1 ${FONT}`,
                          letterSpacing: '.09em',
                          textTransform: 'uppercase',
                          color: 'var(--bad)',
                        }}
                      >
                        Recent Failures · {recentFailed.length}
                      </span>
                    </span>
                    {recentFailed.slice(0, 5).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setRetryProvider(f.provider)
                          setConfirmRetry({
                            orderId: f.orderId,
                            invoice: f.order?.invoiceNumber ?? f.orderId,
                          })
                        }}
                        title="Retry this booking"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          padding: '9px 10px',
                          borderRadius: 9,
                          border: '1px solid var(--line)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {f.order?.invoiceNumber ?? f.orderId}
                          </span>
                          <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                            {f.order?.shippingName ?? 'Customer'}
                          </span>
                        </span>
                        <span style={{ font: `500 11px/1.45 ${MONO}`, color: 'var(--bad)' }}>
                          {f.provider} · {f.failureReason ?? 'No reason returned'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}

      {/* Book Shipment Modal */}
      <DcModal
        open={confirmBook !== null}
        title={confirmBook ? `Book ${confirmBook.invoice} with courier?` : 'Book shipment'}
        subtitle="Dispatches parcel to the courier API and assigns an official consignment ID."
        confirmLabel="Confirm & Book"
        busy={bookMutation.isPending}
        disabled={!bookingProviders.some((p) => p.value === selectedProvider && p.configured)}
        disabledLabel="Setup required"
        onClose={() => setConfirmBook(null)}
        onConfirm={() => {
          if (!confirmBook) return
          if (!bookingProviders.some((p) => p.value === selectedProvider && p.configured)) {
            toastWarn('This courier needs credentials in Settings → Infrastructure')
            return
          }
          bookMutation.mutate({ orderId: confirmBook.orderId, provider: selectedProvider })
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Select Courier Provider</span>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              style={inputStyle}
            >
              {bookingSelectOptions(bookingProviders).map((p) => (
                <option key={p.value} value={p.value} disabled={!p.configured}>
                  {providerOptionLabel(p, true)}
                </option>
              ))}
            </select>
          </label>
          {!bookingProviders.some((p) => p.configured) ? (
            <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
              No courier credentials saved. Configure Steadfast in Settings → Infrastructure.
            </span>
          ) : null}
        </div>
      </DcModal>

      {/* Retry Booking Modal */}
      <DcModal
        open={confirmRetry !== null}
        title={confirmRetry ? `Retry booking for ${confirmRetry.invoice}?` : 'Retry booking'}
        subtitle="Sends the parcel to the courier again. If recipient info was faulty, verify order address first."
        confirmLabel="Retry Shipment"
        busy={retryMutation.isPending}
        disabled={!bookingProviders.some((p) => p.value === retryProvider && p.configured)}
        disabledLabel="Setup required"
        onClose={() => setConfirmRetry(null)}
        onConfirm={() => {
          if (!confirmRetry) return
          if (!bookingProviders.some((p) => p.value === retryProvider && p.configured)) {
            toastWarn('This courier needs credentials in Settings → Infrastructure')
            return
          }
          retryMutation.mutate({ orderId: confirmRetry.orderId, provider: retryProvider })
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Provider</span>
            <select
              value={retryProvider}
              onChange={(e) => setRetryProvider(e.target.value)}
              style={inputStyle}
            >
              {bookingSelectOptions(bookingProviders).map((p) => (
                <option key={p.value} value={p.value} disabled={!p.configured}>
                  {providerOptionLabel(p, false)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </DcModal>

      {/* Live Tracking Modal */}
      <DcModal
        open={trackingModal !== null}
        title={`Tracking ${trackingModal?.invoice ?? ''}`}
        subtitle="Real-time status queried from courier API"
        confirmLabel="Done"
        busy={liveTracking.isFetching}
        onClose={() => setTrackingModal(null)}
        onConfirm={() => setTrackingModal(null)}
      >
        {liveTracking.isLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            Querying courier network…
          </div>
        ) : liveTracking.data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Live Status</span>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    font: `600 11.5px/1 ${MONO}`,
                    background: 'var(--info-soft)',
                    color: 'var(--info)',
                  }}
                >
                  {liveTracking.data.status ?? 'UNKNOWN'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>Provider</span>
                <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink)' }}>{liveTracking.data.provider ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>Consignment ID</span>
                <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>{liveTracking.data.consignmentId ?? '—'}</span>
              </div>
              {liveTracking.data.trackingCode ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>Tracking Code</span>
                  <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>{liveTracking.data.trackingCode}</span>
                </div>
              ) : null}
            </div>

            {liveTracking.data.trackingUrl ? (
              <a
                href={liveTracking.data.trackingUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  height: 34,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-3)',
                  color: 'var(--ink)',
                  font: `600 12px/1 ${FONT}`,
                  textDecoration: 'none',
                }}
              >
                Open Courier Tracking Portal ↗
              </a>
            ) : null}
          </div>
        ) : (
          <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            No live tracking info returned by courier.
          </span>
        )}
      </DcModal>

      {/* Shipment Detail & Webhook Timeline Modal */}
      <DcModal
        open={detailModal !== null}
        title={`Shipment Detail · ${detailModal?.invoice ?? ''}`}
        subtitle="Full lifecycle record, recipient address, and webhook logs"
        confirmLabel="Close"
        onClose={() => setDetailModal(null)}
        onConfirm={() => setDetailModal(null)}
      >
        {shipmentDetail.isLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            Loading shipment details…
          </div>
        ) : shipmentDetail.data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
            {/* Quick Actions inside Detail */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (!detailModal) return
                  setStatusOverride({
                    orderId: detailModal.orderId,
                    invoice: detailModal.invoice,
                    current: shipmentDetail.data?.status ?? 'PENDING',
                  })
                }}
                style={{
                  flex: 1,
                  height: 32,
                  borderRadius: 7,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  font: `600 11.5px/1 ${FONT}`,
                  cursor: 'pointer',
                }}
              >
                Change Status
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!detailModal) return
                  setCancelModal({
                    orderId: detailModal.orderId,
                    invoice: detailModal.invoice,
                  })
                }}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 7,
                  border: '1px solid var(--bad-bd)',
                  background: 'var(--bad-soft)',
                  color: 'var(--bad)',
                  font: `600 11.5px/1 ${FONT}`,
                  cursor: 'pointer',
                }}
              >
                Cancel Local
              </button>
            </div>

            {/* Recipient Info Card */}
            <div style={{ padding: '11px 13px', borderRadius: 9, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ font: `600 10.5px/1 ${FONT}`, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Recipient Info</span>
              <strong style={{ font: `600 13px/1.2 ${FONT}`, color: 'var(--ink)' }}>{shipmentDetail.data.order?.shippingName}</strong>
              <span style={{ font: `400 11.5px/1.2 ${MONO}`, color: 'var(--ink-2)' }}>{shipmentDetail.data.order?.shippingPhone ? formatBdPhone(shipmentDetail.data.order.shippingPhone) : '—'}</span>
              <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>{shipmentDetail.data.order?.shippingAddress ?? 'No address'}</span>
            </div>

            {/* Webhook Events Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: `600 10.5px/1 ${FONT}`, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                Webhook Event History ({(shipmentDetail.data.webhookEvents ?? []).length})
              </span>
              {(shipmentDetail.data.webhookEvents ?? []).length === 0 ? (
                <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                  No webhook events received from courier yet.
                </span>
              ) : (
                (shipmentDetail.data.webhookEvents ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: '1px solid var(--line)',
                      background: 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ font: `600 11.5px/1 ${MONO}`, color: 'var(--ink)' }}>{ev.event}</strong>
                      <span style={{ font: `400 10px/1 ${MONO}`, color: 'var(--ink-3)' }}>{stableTime(ev.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </DcModal>

      {/* Manual Status Override Modal */}
      <DcModal
        open={statusOverride !== null}
        title={`Update Status · ${statusOverride?.invoice ?? ''}`}
        subtitle="Manually update shipment state. Order status will sync automatically when matched."
        confirmLabel="Update Status"
        busy={overrideStatusMutation.isPending}
        onClose={() => setStatusOverride(null)}
        onConfirm={() => {
          if (!statusOverride) return
          const note = overrideNote.trim()
          overrideStatusMutation.mutate({
            orderId: statusOverride.orderId,
            status: overrideStatusVal,
            ...(note ? { note } : {}),
          })
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>New Status</span>
            <select
              value={overrideStatusVal}
              onChange={(e) => setOverrideStatusVal(e.target.value)}
              style={inputStyle}
            >
              <option value="PICKED_UP">PICKED_UP</option>
              <option value="IN_TRANSIT">IN_TRANSIT</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="RETURNED">RETURNED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Audit Note</span>
            <input
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Reason for manual update (e.g. customer collected in store)"
              style={inputStyle}
            />
          </label>
        </div>
      </DcModal>

      {/* Local Cancel Modal */}
      <DcModal
        open={cancelModal !== null}
        title={`Cancel Booking Locally · ${cancelModal?.invoice ?? ''}`}
        subtitle="Steadfast does not support API-side parcel cancellation. This marks the shipment CANCELLED in SPLARO without sending a request to the courier."
        confirmLabel="Cancel Locally"
        danger
        busy={cancelLocalMutation.isPending}
        onClose={() => setCancelModal(null)}
        onConfirm={() => {
          if (!cancelModal) return
          const note = cancelNote.trim()
          cancelLocalMutation.mutate({
            orderId: cancelModal.orderId,
            ...(note ? { note } : {}),
          })
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Reason</span>
          <input
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
            placeholder="e.g. customer cancelled order before pickup"
            style={inputStyle}
          />
        </label>
      </DcModal>

      {/* Bulk Status Update Modal */}
      <DcModal
        open={bulkStatusModal}
        title={`Bulk Status Update (${selectedIds.length} shipments)`}
        subtitle="Applies new status to all selected shipments in one action."
        confirmLabel="Apply Bulk Status"
        busy={bulkStatusMutation.isPending}
        onClose={() => setBulkStatusModal(false)}
        onConfirm={() => {
          const note = bulkStatusNote.trim()
          bulkStatusMutation.mutate({
            orderIds: selectedIds,
            status: bulkStatusVal,
            ...(note ? { note } : {}),
          })
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>New Status</span>
            <select
              value={bulkStatusVal}
              onChange={(e) => setBulkStatusVal(e.target.value)}
              style={inputStyle}
            >
              <option value="IN_TRANSIT">IN_TRANSIT</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="RETURNED">RETURNED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Audit Note</span>
            <input
              value={bulkStatusNote}
              onChange={(e) => setBulkStatusNote(e.target.value)}
              placeholder="Bulk status update note"
              style={inputStyle}
            />
          </label>
        </div>
      </DcModal>
    </>
  )
}

function MobileCourierList({
  rows,
  onOpenOrder,
  onBook,
  onRetry,
  onTrack,
}: {
  rows: CourierShipmentRow[]
  onOpenOrder: (invoice: string) => void
  onBook: (orderId: string, invoice: string) => void
  onRetry: (orderId: string, invoice: string) => void
  onTrack: (orderId: string, invoice: string) => void
}) {
  return (
    <div className="dc-mobile-route-panel" aria-label="Courier">
      {rows.length === 0 ? (
        <div
          style={{
            padding: '42px 18px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--ink-3)',
            textAlign: 'center',
            font: `500 12.5px/1.5 ${FONT}`,
          }}
        >
          No shipments in the queue.
        </div>
      ) : (
        <div className="dc-mobile-list">
          {rows.map((s) => {
            const status = (s.status || 'PENDING').toUpperCase()
            const tone = toneStyle(STATE_TONE[status] ?? 'mute')
            const invoice = s.order?.invoiceNumber ?? s.orderId
            const canBook = status === 'PENDING' || status === 'QUEUED'
            const canRetry = status === 'FAILED' || status === 'CANCELLED' || status === 'RETURNED'
            return (
              <div key={s.id} className="dc-mobile-list-card dc-mobile-list-card--static">
                <button
                  type="button"
                  className="dc-mobile-list-card__main"
                  onClick={() => onOpenOrder(invoice)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    className="dc-mobile-list-card__icon"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    <DcIcon name="icon-truck" size={15} />
                  </span>
                  <span className="dc-mobile-list-card__copy">
                    <span className="dc-mobile-list-card__title">
                      {invoice} · {s.order?.shippingName ?? 'Recipient'}
                    </span>
                    <span className="dc-mobile-list-card__sub">
                      {label(status)} · {s.provider ?? '—'} · {s.consignmentId ?? 'no CN'}
                    </span>
                  </span>
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  {canBook || canRetry ? (
                    <button
                      type="button"
                      className="dc-mobile-chip"
                      data-on="true"
                      onClick={() =>
                        canBook ? onBook(s.orderId, invoice) : onRetry(s.orderId, invoice)
                      }
                    >
                      {canBook ? 'Book' : 'Retry'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="dc-mobile-chip"
                      onClick={() => onTrack(s.orderId, invoice)}
                    >
                      Track
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({
  label: text,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span
        style={{
          font: `600 11px/1 ${FONT}`,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {text}
      </span>
      <span
        style={{ font: `700 26px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
