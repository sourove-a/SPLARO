'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastInfo, toastOk } from '@/lib/admin/feedback'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import {
  useCreateWebhook,
  useDeleteWebhook,
  useDispatchWebhook,
  useTestWebhook,
  useUpdateWebhook,
  useWebhookEvents,
  useWebhookLogs,
  useWebhooks,
  useWebhookStats,
} from '@/lib/api/hooks'
import type { WebhookEndpoint, WebhookEventType } from '@/lib/api/webhooks'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.085em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const ALL_EVENT_OPTIONS: Array<{
  id: WebhookEventType
  category: 'Orders' | 'Payments' | 'Courier' | 'Catalog & Stock' | 'Customers & RMA'
  label: string
  desc: string
}> = [
  { id: 'order.created', category: 'Orders', label: 'Order Created', desc: 'Fires when a new order is placed by customer' },
  { id: 'order.confirmed', category: 'Orders', label: 'Order Confirmed', desc: 'Fires when order is accepted/confirmed' },
  { id: 'order.cancelled', category: 'Orders', label: 'Order Cancelled', desc: 'Fires when order is cancelled' },
  { id: 'order.delivered', category: 'Orders', label: 'Order Delivered', desc: 'Fires upon final package delivery' },
  { id: 'payment.received', category: 'Payments', label: 'Payment Received', desc: 'Fires when bKash, Nagad, or gateway completes' },
  { id: 'payment.failed', category: 'Payments', label: 'Payment Failed', desc: 'Fires when payment attempt fails' },
  { id: 'courier.booked', category: 'Courier', label: 'Courier Booked', desc: 'Fires when consignment is created with Steadfast/courier' },
  { id: 'courier.failed', category: 'Courier', label: 'Courier Failed', desc: 'Fires when courier dispatch fails' },
  { id: 'product.created', category: 'Catalog & Stock', label: 'Product Created', desc: 'Fires when a new product is added to catalog' },
  { id: 'product.updated', category: 'Catalog & Stock', label: 'Product Updated', desc: 'Fires on product edits or price changes' },
  { id: 'product.low_stock', category: 'Catalog & Stock', label: 'Low Stock Alert', desc: 'Fires when variant stock drops below threshold (≤5)' },
  { id: 'customer.created', category: 'Customers & RMA', label: 'Customer Signup', desc: 'Fires when a new customer registers' },
  { id: 'rma.requested', category: 'Customers & RMA', label: 'RMA / Return Requested', desc: 'Fires when customer initiates return or warranty request' },
]

export function DcWebhooks() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="webhooks" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcWebhooksBody />
    </DcScreenProvider>
  )
}

function DcWebhooksBody() {
  const { api } = useAdminConnection(25_000)

  const webhooksQuery = useWebhooks()
  const statsQuery = useWebhookStats(30)
  const eventsQuery = useWebhookEvents()
  const logsQuery = useWebhookLogs({ limit: 40 })

  const createMutation = useCreateWebhook()
  const updateMutation = useUpdateWebhook()
  const deleteMutation = useDeleteWebhook()
  const testMutation = useTestWebhook()
  const dispatchMutation = useDispatchWebhook()

  const [activeTab, setActiveTab] = useState<'endpoints' | 'logs' | 'dispatch' | 'docs'>('endpoints')

  // Endpoint Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingUrl, setEditingUrl] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formSecret, setFormSecret] = useState('')
  const [formEvents, setFormEvents] = useState<WebhookEventType[]>([
    'order.created',
    'order.confirmed',
    'order.delivered',
    'payment.received',
    'product.low_stock',
  ])
  const [formIsActive, setFormIsActive] = useState(true)

  // Delete modal state
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)

  // Test modal state
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testEvent, setTestEvent] = useState<WebhookEventType>('order.created')
  const [testPayloadText, setTestPayloadText] = useState(
    JSON.stringify(
      {
        orderId: 'ord_demo_101',
        invoiceNumber: 'SPL-8921',
        total: 3450,
        currency: 'BDT',
        shippingName: 'Customer Name',
        shippingPhone: '01700000000',
      },
      null,
      2,
    ),
  )

  // Logs filter
  const [logsEventFilter, setLogsEventFilter] = useState<string>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const endpoints = useMemo(() => webhooksQuery.data ?? [], [webhooksQuery.data])
  const activeCount = useMemo(() => endpoints.filter((e) => e.isActive).length, [endpoints])
  const syncing = webhooksQuery.isFetching || statsQuery.isFetching || logsQuery.isFetching
  const pageStatus = dcPageStatus([webhooksQuery, statsQuery, logsQuery], api.pulse)

  const refresh = () => {
    void webhooksQuery.refetch()
    void statsQuery.refetch()
    void logsQuery.refetch()
    void eventsQuery.refetch()
  }

  const openCreateModal = () => {
    setModalMode('create')
    setEditingUrl('')
    setFormUrl('')
    setFormSecret('')
    setFormEvents([
      'order.created',
      'order.confirmed',
      'order.delivered',
      'payment.received',
      'product.low_stock',
    ])
    setFormIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (endpoint: WebhookEndpoint) => {
    setModalMode('edit')
    setEditingUrl(endpoint.url)
    setFormUrl(endpoint.url)
    setFormSecret(endpoint.secret ?? '')
    setFormEvents(endpoint.events.length > 0 ? endpoint.events : ALL_EVENT_OPTIONS.map((e) => e.id))
    setFormIsActive(endpoint.isActive)
    setModalOpen(true)
  }

  const handleGenerateSecret = () => {
    const arr = new Uint8Array(24)
    crypto.getRandomValues(arr)
    const secret = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
    setFormSecret(`whsec_${secret}`)
    toastInfo('Generated new HMAC secret. Save endpoint to apply.')
  }

  const handleToggleEvent = (ev: WebhookEventType) => {
    setFormEvents((prev) =>
      prev.includes(ev) ? prev.filter((item) => item !== ev) : [...prev, ev],
    )
  }

  const handleSelectAllEvents = () => {
    setFormEvents(ALL_EVENT_OPTIONS.map((e) => e.id))
  }

  const handleSelectOrdersOnly = () => {
    setFormEvents(ALL_EVENT_OPTIONS.filter((e) => e.category === 'Orders').map((e) => e.id))
  }

  const handleSelectPaymentsOnly = () => {
    setFormEvents(ALL_EVENT_OPTIONS.filter((e) => e.category === 'Payments').map((e) => e.id))
  }

  const handleSaveEndpoint = async () => {
    const trimmedUrl = formUrl.trim()
    if (!trimmedUrl) {
      toastFail('Endpoint URL cannot be empty')
      return
    }

    try {
      new URL(trimmedUrl)
    } catch {
      toastFail('Invalid URL format. Please provide a valid HTTP/HTTPS URL.')
      return
    }

    if (formEvents.length === 0) {
      toastFail('Please select at least one event to subscribe to.')
      return
    }

    try {
      if (modalMode === 'create') {
        const createPayload: {
          url: string
          secret?: string
          events: WebhookEventType[]
          isActive?: boolean
        } = {
          url: trimmedUrl,
          events: formEvents,
          isActive: formIsActive,
        }
        if (formSecret.trim()) {
          createPayload.secret = formSecret.trim()
        }
        await createMutation.mutateAsync(createPayload)
        toastApiSaved('Webhook endpoint registered')
      } else {
        const updatePayload: {
          url: string
          newUrl?: string
          secret?: string
          events?: WebhookEventType[]
          isActive?: boolean
        } = {
          url: editingUrl,
          events: formEvents,
          isActive: formIsActive,
        }
        if (trimmedUrl !== editingUrl) {
          updatePayload.newUrl = trimmedUrl
        }
        if (formSecret.trim()) {
          updatePayload.secret = formSecret.trim()
        }
        await updateMutation.mutateAsync(updatePayload)
        toastApiSaved('Webhook endpoint updated')
      }
      setModalOpen(false)
      refresh()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to save webhook endpoint')
    }
  }

  const handleDeleteEndpoint = async () => {
    if (!deletingUrl) return
    try {
      await deleteMutation.mutateAsync(deletingUrl)
      toastOk('Webhook endpoint removed')
      setDeletingUrl(null)
      refresh()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to delete webhook endpoint')
    }
  }

  const handleToggleActive = async (endpoint: WebhookEndpoint) => {
    try {
      await updateMutation.mutateAsync({
        url: endpoint.url,
        isActive: !endpoint.isActive,
      })
      toastOk(`Webhook endpoint ${!endpoint.isActive ? 'activated' : 'paused'}`)
      refresh()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to toggle status')
    }
  }

  const handleSendTestDispatch = async () => {
    try {
      let parsedData: Record<string, unknown> = {}
      if (testPayloadText.trim()) {
        try {
          parsedData = JSON.parse(testPayloadText)
        } catch {
          toastFail('Invalid JSON payload in test data')
          return
        }
      }

      await dispatchMutation.mutateAsync({
        event: testEvent,
        data: parsedData,
      })
      toastOk(`Test event "${testEvent}" dispatched to active endpoints`)
      setTestModalOpen(false)
      void logsQuery.refetch()
      void statsQuery.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Test dispatch failed')
    }
  }

  const handleQuickTest = async (ev: WebhookEventType) => {
    try {
      await testMutation.mutateAsync(ev)
      toastOk(`Test ping sent for ${ev}`)
      void logsQuery.refetch()
      void statsQuery.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Test ping failed')
    }
  }

  const filteredLogs = useMemo(() => {
    const raw = logsQuery.data?.items ?? []
    if (logsEventFilter === 'all') return raw
    return raw.filter((l) => l.resource === logsEventFilter)
  }, [logsQuery.data?.items, logsEventFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <DcPageHead
        crumbGroup="Integrations"
        title="Webhooks"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          syncing
            ? 'syncing endpoints…'
            : `${activeCount} active · ${endpoints.length} configured`
        }
        syncing={syncing}
        onSync={refresh}
        actions={[
          {
            label: 'Test dispatch',
            icon: 'icon-send',
            variant: 'ghost',
            onClick: () => {
              setTestModalOpen(true)
            },
          },
          {
            label: 'Register endpoint',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: openCreateModal,
          },
        ]}
      />

      {webhooksQuery.isLoading ? (
        <DcLoadingState
          blocks={[
            { t: 'kpis' } as DcBlock,
            { t: 'table', w: 'full' } as DcBlock,
          ]}
        />
      ) : webhooksQuery.error ? (
        <DcErrorState
          error={`GET /admin/webhooks → ${webhooksQuery.error instanceof Error ? webhooksQuery.error.message : 'Request failed'}`}
          hint="Verify backend connection and reload."
          onRetry={refresh}
        />
      ) : (
        <>
          {/* KPI Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={capsLabel}>Configured Endpoints</div>
              <div style={{ font: `700 24px/1.2 ${FONT}`, color: 'var(--ink)', marginTop: 8 }}>
                {endpoints.length}
              </div>
              <div style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-4)', marginTop: 4 }}>
                {activeCount} active · {endpoints.length - activeCount} paused
              </div>
            </div>

            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={capsLabel}>30-Day Dispatches</div>
              <div style={{ font: `700 24px/1.2 ${FONT}`, color: 'var(--ink)', marginTop: 8 }}>
                {statsQuery.data?.totalDispatched ?? '0'}
              </div>
              <div style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-4)', marginTop: 4 }}>
                Logged delivery events
              </div>
            </div>

            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={capsLabel}>Available Event Types</div>
              <div style={{ font: `700 24px/1.2 ${FONT}`, color: 'var(--ink)', marginTop: 8 }}>
                {ALL_EVENT_OPTIONS.length}
              </div>
              <div style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-4)', marginTop: 4 }}>
                Orders, payments, stock & RMA
              </div>
            </div>

            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={capsLabel}>Security Standard</div>
              <div style={{ font: `700 20px/1.2 ${FONT}`, color: 'var(--ink)', marginTop: 8 }}>
                HMAC SHA-256
              </div>
              <div style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-4)', marginTop: 4 }}>
                Header signed verification
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid var(--line)',
              paddingBottom: 4,
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'endpoints', label: 'Registered Endpoints', icon: 'icon-webhook', count: endpoints.length },
              { id: 'logs', label: 'Delivery Logs', icon: 'icon-activity', count: logsQuery.data?.items?.length },
              { id: 'dispatch', label: 'Manual Dispatch & Test', icon: 'icon-send' },
              { id: 'docs', label: 'Signature & Verification Docs', icon: 'icon-code' },
            ].map((tab) => {
              const isCurrent = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: isCurrent ? 'var(--line-strong, rgba(255,255,255,0.08))' : 'transparent',
                    color: isCurrent ? 'var(--ink)' : 'var(--ink-3)',
                    font: `600 13px/1.2 ${FONT}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <DcIcon name={tab.icon} size={14} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: isCurrent ? 'var(--brand-primary, var(--admin-c-6366f1))' : 'var(--line)',
                        color: isCurrent ? 'var(--admin-color-white)' : 'var(--ink-3)',
                        fontSize: 11,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* TAB 1: ENDPOINTS */}
          {activeTab === 'endpoints' && (
            <div>
              {endpoints.length === 0 ? (
                <div style={{ ...card, padding: 36 }}>
                  <DcEmptyState
                    icon="icon-webhook"
                    title="No webhooks configured"
                    body="Webhooks push order, payment, stock and courier events to an external URL. Register an endpoint to start delivering real-time events."
                  />
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 18px',
                        borderRadius: 8,
                        background: 'var(--brand-primary, var(--admin-c-6366f1))',
                        color: 'var(--admin-color-white)',
                        font: `600 13px/1 ${FONT}`,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <DcIcon name="icon-plus" size={14} />
                      <span>Register First Endpoint</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {endpoints.map((endpoint) => (
                    <div
                      key={endpoint.url}
                      style={{
                        ...card,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 16,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: endpoint.isActive
                                ? 'rgba(34, 197, 94, 0.12)'
                                : 'rgba(156, 163, 175, 0.12)',
                              color: endpoint.isActive ? 'var(--tone-ok, var(--admin-c-22c55e))' : 'var(--ink-4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <DcIcon name="icon-webhook" size={18} />
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span
                                style={{
                                  font: `600 14px/1.3 ${MONO}`,
                                  color: 'var(--ink)',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {endpoint.url}
                              </span>

                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontFamily: FONT,
                                  fontWeight: 600,
                                  background: endpoint.isActive
                                    ? 'rgba(34, 197, 94, 0.15)'
                                    : 'rgba(156, 163, 175, 0.15)',
                                  color: endpoint.isActive ? 'var(--tone-ok, var(--admin-c-22c55e))' : 'var(--ink-4)',
                                }}
                              >
                                {endpoint.isActive ? 'Active' : 'Paused'}
                              </span>

                              {endpoint.secret ? (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontFamily: FONT,
                                    fontWeight: 600,
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: 'var(--admin-c-818cf8)',
                                  }}
                                >
                                  HMAC Secured
                                </span>
                              ) : (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontFamily: FONT,
                                    color: 'var(--ink-4)',
                                    background: 'var(--line)',
                                  }}
                                >
                                  No secret
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                font: `400 12px/1.4 ${FONT}`,
                                color: 'var(--ink-3)',
                                marginTop: 4,
                              }}
                            >
                              Subscribed to {endpoint.events.length} event
                              {endpoint.events.length === 1 ? '' : 's'}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleQuickTest(endpoint.events[0] ?? 'order.created')}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--line)',
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                              font: `500 12px/1 ${FONT}`,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <DcIcon name="icon-play" size={12} />
                            <span>Ping</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(endpoint)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--line)',
                              background: 'var(--surface)',
                              color: endpoint.isActive ? 'var(--ink-3)' : 'var(--tone-ok, var(--admin-c-22c55e))',
                              font: `500 12px/1 ${FONT}`,
                              cursor: 'pointer',
                            }}
                          >
                            {endpoint.isActive ? 'Pause' : 'Activate'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(endpoint)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--line)',
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                              font: `500 12px/1 ${FONT}`,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <DcIcon name="icon-pencil" size={12} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingUrl(endpoint.url)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: 'var(--tone-fail, var(--admin-danger-bright))',
                              font: `500 12px/1 ${FONT}`,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <DcIcon name="icon-trash-2" size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Event Tags */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {endpoint.events.map((ev) => (
                          <span
                            key={ev}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: 'var(--line, rgba(255,255,255,0.05))',
                              border: '1px solid var(--line)',
                              color: 'var(--ink-2)',
                              font: `500 11.5px/1 ${MONO}`,
                            }}
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DELIVERY LOGS */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: `500 13px/1 ${FONT}`, color: 'var(--ink-3)' }}>Filter Event:</span>
                  <select
                    value={logsEventFilter}
                    onChange={(e) => setLogsEventFilter(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--line)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      font: `500 12px/1 ${FONT}`,
                    }}
                  >
                    <option value="all">All Events</option>
                    {ALL_EVENT_OPTIONS.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.id}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => void logsQuery.refetch()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    font: `500 12px/1 ${FONT}`,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <DcIcon name="icon-refresh-cw" size={12} />
                  <span>Refresh Logs</span>
                </button>
              </div>

              {filteredLogs.length === 0 ? (
                <div style={{ ...card, padding: 32 }}>
                  <DcEmptyState
                    icon="icon-activity"
                    title="No delivery logs found"
                    body="Logs appear here whenever an event is dispatched to your registered webhook endpoints. You can also trigger a manual test dispatch."
                  />
                </div>
              ) : (
                <div style={{ ...card, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--line)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <th style={{ padding: '12px 16px', ...capsLabel }}>Status</th>
                        <th style={{ padding: '12px 16px', ...capsLabel }}>Event</th>
                        <th style={{ padding: '12px 16px', ...capsLabel }}>Target URL</th>
                        <th style={{ padding: '12px 16px', ...capsLabel }}>Timestamp</th>
                        <th style={{ padding: '12px 16px', ...capsLabel }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const statusNum = log.newData?.status ?? (log.newData?.ok ? 200 : 0)
                        const isOk = statusNum >= 200 && statusNum < 300
                        const isExpanded = expandedLogId === log.id

                        return (
                          <tr
                            key={log.id}
                            style={{
                              borderBottom: '1px solid var(--line)',
                              font: `400 13px/1.4 ${FONT}`,
                            }}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  font: `600 11.5px/1 ${MONO}`,
                                  background: isOk
                                    ? 'rgba(34, 197, 94, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                  color: isOk ? 'var(--tone-ok, var(--admin-c-22c55e))' : 'var(--tone-fail, var(--admin-danger-bright))',
                                }}
                              >
                                <span>{isOk ? '●' : '▲'}</span>
                                <span>{statusNum > 0 ? `HTTP ${statusNum}` : 'Error'}</span>
                              </span>
                            </td>

                            <td style={{ padding: '12px 16px', font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                              {log.resource}
                            </td>

                            <td
                              style={{
                                padding: '12px 16px',
                                font: `400 12px/1 ${MONO}`,
                                color: 'var(--ink-2)',
                                maxWidth: 280,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {log.resourceId ?? log.newData?.url ?? '—'}
                            </td>

                            <td style={{ padding: '12px 16px', color: 'var(--ink-3)', fontSize: 12 }}>
                              {new Date(log.createdAt).toLocaleTimeString()} ·{' '}
                              {new Date(log.createdAt).toLocaleDateString()}
                            </td>

                            <td style={{ padding: '12px 16px' }}>
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: '1px solid var(--line)',
                                  background: 'transparent',
                                  color: 'var(--ink-2)',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                {isExpanded ? 'Hide payload' : 'View payload'}
                              </button>

                              {isExpanded && (
                                <pre
                                  style={{
                                    marginTop: 8,
                                    padding: 10,
                                    borderRadius: 6,
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid var(--line)',
                                    color: 'var(--admin-c-38bdf8)',
                                    fontSize: 11,
                                    fontFamily: MONO,
                                    maxHeight: 180,
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {JSON.stringify(log.newData ?? {}, null, 2)}
                                </pre>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL DISPATCH & TEST */}
          {activeTab === 'dispatch' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ font: `600 16px/1.2 ${FONT}`, color: 'var(--ink)', margin: 0 }}>
                    Trigger Test Webhook
                  </h3>
                  <p style={{ font: `400 13px/1.4 ${FONT}`, color: 'var(--ink-3)', marginTop: 4 }}>
                    Send an event with custom sample JSON to all configured active endpoints.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={capsLabel}>Event Type</label>
                  <select
                    value={testEvent}
                    onChange={(e) => setTestEvent(e.target.value as WebhookEventType)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      font: `500 13px/1.2 ${FONT}`,
                    }}
                  >
                    {ALL_EVENT_OPTIONS.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.id} — {ev.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={capsLabel}>Payload (JSON)</label>
                  <textarea
                    rows={8}
                    value={testPayloadText}
                    onChange={(e) => setTestPayloadText(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--admin-c-38bdf8)',
                      font: `400 12px/1.4 ${MONO}`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendTestDispatch}
                  disabled={dispatchMutation.isPending}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    background: 'var(--brand-primary, var(--admin-c-6366f1))',
                    color: 'var(--admin-color-white)',
                    font: `600 13px/1 ${FONT}`,
                    border: 'none',
                    cursor: dispatchMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <DcIcon name="icon-send" size={14} />
                  <span>{dispatchMutation.isPending ? 'Dispatching…' : 'Send Test Dispatch'}</span>
                </button>
              </div>

              <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ font: `600 16px/1.2 ${FONT}`, color: 'var(--ink)', margin: 0 }}>
                  Quick Ping Presets
                </h3>
                <p style={{ font: `400 13px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>
                  Immediately fire standard demo events to verify your server receivers:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'order.created', label: 'Order Created', hint: 'Sample order SPL-Demo' },
                    { id: 'payment.received', label: 'Payment Received', hint: 'bKash ৳2,450' },
                    { id: 'courier.booked', label: 'Courier Booked', hint: 'Steadfast consignment' },
                    { id: 'product.low_stock', label: 'Product Low Stock', hint: 'Stock warning threshold' },
                  ].map((preset) => (
                    <div
                      key={preset.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ font: `600 13px/1.2 ${MONO}`, color: 'var(--ink)' }}>{preset.id}</div>
                        <div style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)', marginTop: 2 }}>
                          {preset.hint}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickTest(preset.id as WebhookEventType)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Ping
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DOCS & HMAC SIGNATURE */}
          {activeTab === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, padding: 22 }}>
                <h3 style={{ font: `600 17px/1.2 ${FONT}`, color: 'var(--ink)', margin: 0 }}>
                  Webhook Delivery & Security Specification
                </h3>
                <p style={{ font: `400 13.5px/1.5 ${FONT}`, color: 'var(--ink-3)', marginTop: 8 }}>
                  SPLARO dispatches HTTP POST requests with JSON body to your registered endpoints.
                  All requests include timestamp and event headers. If a secret is provided,
                  an HMAC SHA-256 signature is included in the <code>X-SPLARO-Signature</code> header.
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
                    <div style={capsLabel}>Header</div>
                    <div style={{ font: `600 13px/1.3 ${MONO}`, color: 'var(--admin-c-38bdf8)', marginTop: 4 }}>
                      X-SPLARO-Event
                    </div>
                    <div style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)', marginTop: 4 }}>
                      Event type string (e.g. order.created)
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
                    <div style={capsLabel}>Header</div>
                    <div style={{ font: `600 13px/1.3 ${MONO}`, color: 'var(--admin-c-38bdf8)', marginTop: 4 }}>
                      X-SPLARO-Timestamp
                    </div>
                    <div style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)', marginTop: 4 }}>
                      ISO-8601 UTC dispatch timestamp
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
                    <div style={capsLabel}>Header</div>
                    <div style={{ font: `600 13px/1.3 ${MONO}`, color: 'var(--admin-c-38bdf8)', marginTop: 4 }}>
                      X-SPLARO-Signature
                    </div>
                    <div style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)', marginTop: 4 }}>
                      sha256=&var(--admin-c-112233);hex_digest&var(--admin-c-112255);
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Verification Snippet */}
              <div style={{ ...card, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ font: `600 15px/1.2 ${FONT}`, color: 'var(--ink)', margin: 0 }}>
                    Verifying HMAC Signature (Node.js Example)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const code = `const crypto = require('crypto');\n\nfunction verifyWebhook(rawBody, signatureHeader, secret) {\n  if (!signatureHeader) return false;\n  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');\n  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));\n}`
                      void navigator.clipboard.writeText(code)
                      toastOk('Copied verification code to clipboard')
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--ink-2)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Copy code
                  </button>
                </div>

                <pre
                  style={{
                    marginTop: 12,
                    padding: 16,
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid var(--line)',
                    color: 'var(--admin-c-e2e8f0)',
                    fontSize: 12.5,
                    fontFamily: MONO,
                    lineHeight: 1.5,
                    overflowX: 'auto',
                  }}
                >{`const crypto = require('crypto');

function verifyWebhook(rawBodyString, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBodyString)
    .digest('hex');
  const expected = \`sha256=\${hash}\`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}`}</pre>
              </div>
            </div>
          )}
        </>
      )}

      {/* REGISTER / EDIT MODAL */}
      <DcModal
        open={modalOpen}
        title={modalMode === 'create' ? 'Register Webhook Endpoint' : 'Edit Webhook Endpoint'}
        subtitle="Events matching your selected triggers will be delivered via HTTP POST."
        confirmLabel={modalMode === 'create' ? 'Register Endpoint' : 'Save Changes'}
        busy={createMutation.isPending || updateMutation.isPending}
        busyLabel="Saving endpoint…"
        onClose={() => setModalOpen(false)}
        onConfirm={handleSaveEndpoint}
        width="min(560px, 100%)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          {/* URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={capsLabel}>Endpoint URL (HTTPS Preferred) *</label>
            <input
              type="url"
              placeholder="https://api.yourdomain.com/webhooks/splaro"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                font: `400 13px/1.2 ${MONO}`,
              }}
            />
          </div>

          {/* Secret */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={capsLabel}>HMAC Signing Secret (Optional)</label>
              <button
                type="button"
                onClick={handleGenerateSecret}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--brand-primary, var(--admin-c-6366f1))',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Generate random secret
              </button>
            </div>
            <input
              type="text"
              placeholder="whsec_..."
              value={formSecret}
              onChange={(e) => setFormSecret(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                font: `400 13px/1.2 ${MONO}`,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
              Used to sign requests in the X-SPLARO-Signature header so your receiver can verify authenticity.
            </span>
          </div>

          {/* Active status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--line)',
            }}
          >
            <div>
              <div style={{ font: `600 13px/1.2 ${FONT}`, color: 'var(--ink)' }}>Active Delivery</div>
              <div style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)', marginTop: 2 }}>
                Deliver events immediately upon trigger
              </div>
            </div>
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {/* Event selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={capsLabel}>Subscribed Events ({formEvents.length})</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={handleSelectAllEvents}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--brand-primary, var(--admin-c-6366f1))',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  All
                </button>
                <span style={{ color: 'var(--line)' }}>·</span>
                <button
                  type="button"
                  onClick={handleSelectOrdersOnly}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--brand-primary, var(--admin-c-6366f1))',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Orders
                </button>
                <span style={{ color: 'var(--line)' }}>·</span>
                <button
                  type="button"
                  onClick={handleSelectPaymentsOnly}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--brand-primary, var(--admin-c-6366f1))',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Payments
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 220,
                overflowY: 'auto',
                padding: '4px 0',
              }}
            >
              {ALL_EVENT_OPTIONS.map((item) => {
                const selected = formEvents.includes(item.id)
                return (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: selected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selected ? 'rgba(99, 102, 241, 0.3)' : 'var(--line)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ font: `600 12.5px/1.2 ${MONO}`, color: 'var(--ink)' }}>
                        {item.id}
                      </div>
                      <div style={{ font: `400 11px/1.2 ${FONT}`, color: 'var(--ink-3)', marginTop: 2 }}>
                        {item.desc}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleToggleEvent(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      </DcModal>

      {/* DELETE CONFIRM MODAL */}
      <DcModal
        open={Boolean(deletingUrl)}
        title="Delete Webhook Endpoint"
        subtitle={`Remove delivery to ${deletingUrl}? External events will stop immediately.`}
        confirmLabel="Delete Endpoint"
        danger
        busy={deleteMutation.isPending}
        busyLabel="Deleting…"
        onClose={() => setDeletingUrl(null)}
        onConfirm={handleDeleteEndpoint}
      >
        <p style={{ font: `400 13px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>
          This will permanently remove the webhook configuration. Any in-flight retries will be discarded.
        </p>
      </DcModal>

      {/* TEST DISPATCH MODAL */}
      <DcModal
        open={testModalOpen}
        title="Dispatch Test Webhook"
        subtitle="Sends a live sample event payload to all active subscribed endpoints."
        confirmLabel="Send Dispatch"
        busy={dispatchMutation.isPending}
        busyLabel="Dispatching…"
        onClose={() => setTestModalOpen(false)}
        onConfirm={handleSendTestDispatch}
        width="min(520px, 100%)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={capsLabel}>Event</label>
            <select
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value as WebhookEventType)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                font: `500 13px/1.2 ${FONT}`,
              }}
            >
              {ALL_EVENT_OPTIONS.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.id}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={capsLabel}>JSON Payload</label>
            <textarea
              rows={6}
              value={testPayloadText}
              onChange={(e) => setTestPayloadText(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'rgba(0,0,0,0.2)',
                color: 'var(--admin-c-38bdf8)',
                font: `400 12px/1.4 ${MONO}`,
              }}
            />
          </div>
        </div>
      </DcModal>
    </div>
  )
}
