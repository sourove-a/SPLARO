'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import type { ProcurementOrder } from '@/lib/api/commerce-os'
import {
  useCreatePurchaseOrder,
  useCreateSupplier,
  useProcurementOverview,
  useReceiveGoodsGrn,
} from '@/lib/api/hooks'
import { formatBdPhone, telHref } from '@/lib/format/bd-phone'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { downloadCsv } from '@/lib/admin/admin-actions'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const th = {
  textAlign: 'left' as const,
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const PO_TONE: Record<string, DcTone> = {
  DRAFT: 'mute',
  PENDING: 'warn',
  ORDERED: 'info',
  PARTIAL: 'warn',
  RECEIVED: 'ok',
  CANCELLED: 'bad',
}

const CLOSED = ['RECEIVED', 'CANCELLED']

interface PoLine {
  productName: string
  sku: string
  quantity: string
  unitCost: string
}

const EMPTY_LINE: PoLine = { productName: '', sku: '', quantity: '', unitCost: '' }

/**
 * One procurement surface. The nav lists Procurement Hub / Suppliers /
 * Purchase Orders / Goods Received separately, but they all read the single
 * `/commerce-os/procurement/overview` payload, so they share this screen and
 * differ only in the title.
 */
export function DcPurchaseOrders({ title = 'Procurement' }: { title?: string }) {
  const router = useRouter()
  return (
    <DcScreenProvider screen="procurement" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPurchaseOrdersBody title={title} />
    </DcScreenProvider>
  )
}

function DcPurchaseOrdersBody({ title }: { title: string }) {
  const router = useRouter()
  const { toast } = useDcScreen()
  const proc = useProcurementOverview()
  const createPo = useCreatePurchaseOrder()
  const createSupplier = useCreateSupplier()
  const receiveGrn = useReceiveGoodsGrn()
  const { api } = useAdminConnection(25_000)

  const [poOpen, setPoOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [confirmGrn, setConfirmGrn] = useState<ProcurementOrder | null>(null)
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '' })
  const [poForm, setPoForm] = useState<{ supplierId: string; notes: string; lines: PoLine[] }>({
    supplierId: '',
    notes: '',
    lines: [{ ...EMPTY_LINE }],
  })

  const d = proc.data
  const suppliers = useMemo(() => d?.suppliers ?? [], [d])
  const orders = useMemo(() => d?.orders ?? [], [d])
  const grns = useMemo(() => d?.grns ?? [], [d])

  const open = useMemo(
    () => orders.filter((o) => !CLOSED.includes(o.status.toUpperCase())),
    [orders],
  )
  const openValue = open.reduce((s, o) => s + Number(o.total || 0), 0)
  const owed = suppliers.reduce((s, x) => s + Number(x.dueAmount || 0), 0)
  const received = orders.filter((o) => o.status.toUpperCase() === 'RECEIVED').length

  /**
   * The PO payload carries only `supplier.name`, so the phone number for the
   * "Call supplier" action has to come back off the supplier list by name.
   */
  const phoneByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of suppliers) {
      if (s.phone) map.set(s.name.trim().toLowerCase(), s.phone)
    }
    return map
  }, [suppliers])

  /** Open POs and lifetime spend per supplier — both derivable, unlike lead time. */
  const supplierStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of open) {
      const key = o.supplier.name.trim().toLowerCase()
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [open])

  const pageStatus = dcPageStatus([proc], api.pulse, { label: 'BETA', tone: 'warn' })
  const poTotal = poForm.lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
    0,
  )

  const resetPo = () =>
    setPoForm({ supplierId: '', notes: '', lines: [{ ...EMPTY_LINE }] })

  const runCreatePo = () => {
    const items = poForm.lines
      .filter((l) => l.productName.trim() && Number(l.quantity) > 0)
      .map((l) => ({
        productName: l.productName.trim(),
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost) || 0,
        ...(l.sku.trim() ? { sku: l.sku.trim() } : {}),
      }))

    if (!poForm.supplierId) {
      toast('warn', 'Pick a supplier', 'A purchase order has to be raised against one supplier.')
      return
    }
    if (items.length === 0) {
      toast('warn', 'Add at least one line', 'Each line needs a product name and a quantity above 0.')
      return
    }

    createPo.mutate(
      {
        supplierId: poForm.supplierId,
        items,
        ...(poForm.notes.trim() ? { notes: poForm.notes.trim() } : {}),
      },
      {
        onSuccess: (res) => {
          setPoOpen(false)
          resetPo()
          toast(
            'ok',
            `${res.poNumber} raised`,
            'Cash is committed. File the goods-received note when stock lands.',
          )
        },
        onError: (err) =>
          toast(
            'bad',
            'Could not raise the PO',
            err instanceof Error
              ? err.message
              : 'POST /admin/hub/procurement/purchase-orders failed',
          ),
      },
    )
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
    { t: 'list', w: 'side', title: '', items: [] } as DcBlock,
  ]

  const exportCsv = () => {
    if (orders.length === 0 && suppliers.length === 0) {
      toast('warn', 'Nothing to export', 'No purchase orders or suppliers on file.')
      return
    }
    const headers = [
      'PO Number',
      'Supplier',
      'Items Count',
      'Total Amount (BDT)',
      'Status',
      'Created Date',
    ]
    const csvRows = [
      headers,
      ...orders.map((o) => [
        o.poNumber,
        o.supplier.name,
        String(o.items?.length ?? 0),
        String(o.total ?? 0),
        o.status,
        new Date(o.createdAt).toISOString().slice(0, 10),
      ]),
      [],
      ['GRN Number', 'PO Number', 'Supplier', 'Received Date', 'Notes'],
      ...grns.map((g) => [
        g.grnNumber,
        g.purchaseOrder?.poNumber || '—',
        g.purchaseOrder?.supplier?.name || '—',
        new Date(g.receivedAt).toISOString().slice(0, 10),
        g.notes || '',
      ]),
      [],
      ['Supplier Name', 'Phone', 'Email', 'Due Amount (BDT)', 'Paid Amount (BDT)'],
      ...suppliers.map((s) => [
        s.name,
        s.phone || '—',
        s.email || '—',
        String(s.dueAmount ?? 0),
        String(s.paidAmount ?? 0),
      ]),
    ]
    downloadCsv(
      `splaro-${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
      csvRows,
    )
    toast('ok', 'Export complete', `Exported ${orders.length} POs, ${grns.length} GRNs, and ${suppliers.length} suppliers.`)
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Operations"
        title={title}
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          proc.isFetching
            ? 'syncing…'
            : `${orders.length} PO${orders.length === 1 ? '' : 's'} · ${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}`
        }
        syncing={proc.isFetching}
        onSync={() => void proc.refetch()}
        actions={[
          {
            label: 'New supplier',
            icon: 'icon-users',
            onClick: () => {
              setSupplierForm({ name: '', phone: '', email: '' })
              setSupplierOpen(true)
            },
          },
          {
            label: 'New PO',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => {
              if (suppliers.length === 0) {
                toast(
                  'warn',
                  'Add a supplier first',
                  'A purchase order is raised against a supplier — there are none on file yet.',
                )
                return
              }
              resetPo()
              setPoOpen(true)
            },
          },
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      <p
        style={{
          margin: '0 0 12px',
          font: `400 12.5px/1.45 ${FONT}`,
          color: 'var(--ink-3)',
        }}
      >
        One procurement hub — purchase orders, suppliers, and goods received share this screen.
      </p>

      {proc.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : proc.error ? (
        <DcErrorState
          error={`GET /commerce-os/procurement/overview → ${proc.error instanceof Error ? proc.error.message : '500 Internal Server Error'}`}
          hint="Existing purchase orders are unaffected — only this view failed to load."
          onRetry={() => void proc.refetch()}
        />
      ) : orders.length === 0 && suppliers.length === 0 ? (
        <DcEmptyState
          icon="icon-clipboard-list"
          title="No suppliers or purchase orders yet"
          body="A purchase order commits cash against a supplier and, once received, adds the stock. Start by adding the supplier you buy from."
          cta="Add supplier"
          onCta={() => {
            setSupplierForm({ name: '', phone: '', email: '' })
            setSupplierOpen(true)
          }}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi label="Open POs" value={String(open.length)} sub="not yet fully received" />
            <Kpi
              label="Open value"
              value={formatTaka(openValue)}
              sub="committed but not delivered"
            />
            <Kpi
              label="Owed to suppliers"
              value={formatTaka(owed)}
              sub="across every supplier"
              color={owed > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Received"
              value={String(received)}
              sub={`${grns.length} GRN${grns.length === 1 ? '' : 's'} filed`}
              color="var(--ok)"
            />
          </div>

          {open.length > 0 ? (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '13px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 9,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  POs that need you
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 60,
                    font: `400 11.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  an open PO is cash committed with nothing on the shelf yet
                </span>
              </div>
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(330px, 100%), 1fr))',
                  gap: 10,
                }}
              >
                {open.slice(0, 8).map((o) => {
                  const tone = toneStyle(PO_TONE[o.status.toUpperCase()] ?? 'warn')
                  const lines = o.items?.length ?? 0
                  const age = Math.max(
                    0,
                    Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 86_400_000),
                  )
                  const phone = phoneByName.get(o.supplier.name.trim().toLowerCase())
                  return (
                    <div
                      key={o.id}
                      style={{
                        border: '1px solid var(--line)',
                        borderLeft: `3px solid ${tone.fg}`,
                        borderRadius: 11,
                        background: 'var(--surface-2)',
                        padding: '12px 13px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            font: `600 13px/1.35 ${FONT}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {o.supplier.name}
                        </span>
                        <span
                          style={{
                            flex: 'none',
                            font: `400 10.5px/1.5 ${MONO}`,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {o.poNumber}
                        </span>
                      </div>
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          font: `700 9.5px/1.3 ${FONT}`,
                          letterSpacing: '.07em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {o.status} · {o.items?.length ?? 0} line
                        {(o.items?.length ?? 0) === 1 ? '' : 's'}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 7,
                          flexWrap: 'wrap',
                          padding: '9px 10px',
                          border: '1px solid var(--line)',
                          borderRadius: 9,
                          background: 'var(--surface)',
                        }}
                      >
                        <span style={{ font: `700 14.5px/1.3 ${MONO}`, color: 'var(--ink)' }}>
                          {formatTaka(Number(o.total || 0))}
                        </span>
                        <span style={{ font: `500 11px/1.4 ${FONT}`, color: tone.fg }}>
                          raised{' '}
                          {new Date(o.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      {/* Prototype's stats strip — the three facts you decide on. */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: 1,
                          border: '1px solid var(--line)',
                          borderRadius: 9,
                          overflow: 'hidden',
                          background: 'var(--line)',
                        }}
                      >
                        {[
                          ['Lines', `${lines}`],
                          ['Value', formatTaka(Number(o.total || 0))],
                          ['Age', `${age}d`],
                        ].map(([k, v]) => (
                          <span
                            key={k}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                              padding: '7px 9px',
                              background: 'var(--surface)',
                            }}
                          >
                            <span
                              style={{
                                font: `600 9.5px/1 ${FONT}`,
                                letterSpacing: '.08em',
                                textTransform: 'uppercase',
                                color: 'var(--ink-3)',
                              }}
                            >
                              {k}
                            </span>
                            <span style={{ font: `600 12px/1.2 ${MONO}`, color: 'var(--ink)' }}>
                              {v}
                            </span>
                          </span>
                        ))}
                      </div>
                      <span
                        style={{
                          font: `400 11.5px/1.55 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        File the goods-received note the moment stock lands, or the ledger and the
                        shelf disagree.
                      </span>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingTop: 2 }}>
                        <button
                          type="button"
                          disabled={receiveGrn.isPending}
                          onClick={() => setConfirmGrn(o)}
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid var(--violet-solid)',
                            background: 'var(--violet-solid)',
                            color: 'var(--on-violet)',
                            cursor: receiveGrn.isPending ? 'not-allowed' : 'pointer',
                            font: `600 11.5px/1 ${FONT}`,
                          }}
                        >
                          File GRN
                        </button>
                        {phone ? (
                          <a
                            href={telHref(phone)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              height: 30,
                              padding: '0 11px',
                              borderRadius: 8,
                              border: '1px solid var(--line-2)',
                              color: 'var(--ink-2)',
                              font: `600 11.5px/1 ${FONT}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <DcIcon name="icon-phone" size={12} />
                            <span>Call {formatBdPhone(phone)}</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <div
              style={{
                flex: '1 1 56%',
                minWidth: 340,
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ ...card, overflow: 'auto' }}>
                <SectionHead title="Purchase orders" meta={`${orders.length} in the window`} />
                {orders.length === 0 ? (
                  <Note text="No purchase orders raised yet." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>PO</th>
                        <th style={th}>Supplier</th>
                        <th style={{ ...th, textAlign: 'right' }}>Lines</th>
                        <th style={{ ...th, textAlign: 'right' }}>Total</th>
                        <th style={th}>Raised</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '10px 15px', font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {o.poNumber}
                          </td>
                          <td style={{ padding: '10px 15px', font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                            {o.supplier.name}
                          </td>
                          <td style={{ padding: '10px 15px', textAlign: 'right', font: `600 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {o.items?.length ?? 0}
                          </td>
                          <td style={{ padding: '10px 15px', textAlign: 'right', font: `600 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {formatTaka(Number(o.total || 0))}
                          </td>
                          <td style={{ padding: '10px 15px', font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                            {new Date(o.createdAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </td>
                          <td style={{ padding: '10px 15px' }}>
                            <Chip
                              tone={toneStyle(PO_TONE[o.status.toUpperCase()] ?? 'mute')}
                              label={o.status}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ ...card, overflow: 'auto' }}>
                <SectionHead
                  title="Suppliers"
                  meta="lead time is not stored yet — Inventory reorder maths uses a flat assumption"
                />
                {suppliers.length === 0 ? (
                  <Note text="No suppliers on file." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Supplier</th>
                        <th style={th}>Phone</th>
                        <th style={{ ...th, textAlign: 'right' }}>Open POs</th>
                        <th style={{ ...th, textAlign: 'right' }}>Spend</th>
                        <th style={{ ...th, textAlign: 'right' }}>Due</th>
                        <th style={th}>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((s) => {
                        const openCount = supplierStats.get(s.name.trim().toLowerCase()) ?? 0
                        const spend = Number(s.paidAmount || 0) + Number(s.dueAmount || 0)
                        return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '10px 15px', font: `500 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                            {s.name}
                          </td>
                          <td style={{ padding: '10px 15px' }}>
                            {s.phone ? (
                              <a
                                href={telHref(s.phone)}
                                style={{
                                  font: `500 12px/1 ${MONO}`,
                                  color: 'var(--ink-2)',
                                  borderBottom: '1px solid var(--line-2)',
                                }}
                              >
                                {formatBdPhone(s.phone)}
                              </a>
                            ) : (
                              <span style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                                —
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: '10px 15px',
                              textAlign: 'right',
                              font: `600 13px/1 ${MONO}`,
                              color: openCount > 0 ? 'var(--ink)' : 'var(--ink-3)',
                            }}
                          >
                            {openCount}
                          </td>
                          <td style={{ padding: '10px 15px', textAlign: 'right', font: `600 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {formatTaka(spend)}
                          </td>
                          <td
                            style={{
                              padding: '10px 15px',
                              textAlign: 'right',
                              font: `600 13px/1 ${MONO}`,
                              color: Number(s.dueAmount || 0) > 0 ? 'var(--warn)' : 'var(--ink)',
                            }}
                          >
                            {formatTaka(Number(s.dueAmount || 0))}
                          </td>
                          <td style={{ padding: '10px 15px' }}>
                            <Chip
                              tone={toneStyle(s.isActive ? 'ok' : 'mute')}
                              label={s.isActive ? 'Active' : 'Archived'}
                            />
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

            <div style={{ flex: '1 1 28%', minWidth: 290, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 8px' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0 9px' }}
                >
                  <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                    Goods received
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    {grns.length} note{grns.length === 1 ? '' : 's'}
                  </span>
                </div>
                {grns.length === 0 ? (
                  <div
                    style={{
                      padding: '26px 0',
                      textAlign: 'center',
                      font: `400 12.5px/1.55 ${FONT}`,
                      color: 'var(--ink-3)',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    No GRN filed yet. Stock only enters the ledger once one is.
                  </div>
                ) : (
                  grns.slice(0, 10).map((g) => (
                    <div
                      key={g.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        padding: '10px 0',
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <span
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 28,
                          height: 28,
                          flex: 'none',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--surface-2)',
                          color: 'var(--ok)',
                        }}
                      >
                        <DcIcon name="icon-package-check" size={13} />
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <span style={{ font: `500 12.5px/1.3 ${MONO}`, color: 'var(--ink)' }}>
                          {g.grnNumber} · {g.purchaseOrder.poNumber}
                        </span>
                        <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                          {g.purchaseOrder.supplier.name}
                          {g.notes ? ` · ${g.notes}` : ' · stock added to the ledger'}
                        </span>
                      </span>
                      <span
                        style={{
                          flex: 'none',
                          font: `500 11px/1 ${MONO}`,
                          color: 'var(--ink-3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {new Date(g.receivedAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Prototype's "Where this connects" — the same three links, but each
                  one states the write it actually performs. */}
              <div style={{ ...card, padding: '6px 16px 10px', marginTop: 16 }}>
                <div style={{ padding: '11px 0 9px' }}>
                  <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                    Where this connects
                  </span>
                </div>
                {[
                  {
                    icon: 'icon-archive',
                    title: 'Inventory',
                    sub: 'low-stock decisions are what start a purchase order',
                    href: '/dashboard/inventory',
                  },
                  {
                    icon: 'icon-warehouse',
                    title: 'Warehouse & Stock',
                    sub: 'a filed GRN writes PURCHASE rows into the movement ledger',
                    href: '/dashboard/wms/overview',
                  },
                  {
                    icon: 'icon-chart-no-axes-combined',
                    title: 'Profit & Loss',
                    sub: 'received PO value lands in product cost, not when it was raised',
                    href: '/dashboard/finance/profit-loss',
                  },
                ].map((l) => (
                  <button
                    key={l.href}
                    type="button"
                    onClick={() => router.push(l.href)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      width: '100%',
                      padding: '10px 0',
                      border: 'none',
                      borderTop: '1px solid var(--line)',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 28,
                        height: 28,
                        flex: 'none',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--violet-ink)',
                      }}
                    >
                      <DcIcon name={l.icon} size={13} />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        {l.title}
                      </span>
                      <span
                        style={{
                          font: `400 11.5px/1.4 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {l.sub}
                      </span>
                    </span>
                    <DcIcon name="icon-arrow-right" size={13} color="var(--ink-3)" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── new supplier ─────────────────────────────────────────── */}
      <DcModal
        open={supplierOpen}
        title="Add supplier"
        subtitle="Purchase orders are raised against a supplier, so this comes first."
        confirmLabel="Add supplier"
        busy={createSupplier.isPending}
        onClose={() => setSupplierOpen(false)}
        onConfirm={() => {
          if (!supplierForm.name.trim()) {
            toast('warn', 'Name is required', 'A supplier needs a name before it can be saved.')
            return
          }
          createSupplier.mutate(
            {
              name: supplierForm.name.trim(),
              ...(supplierForm.phone.trim() ? { phone: supplierForm.phone.trim() } : {}),
              ...(supplierForm.email.trim() ? { email: supplierForm.email.trim() } : {}),
            },
            {
              onSuccess: () => {
                setSupplierOpen(false)
                toast('ok', 'Supplier added', 'You can raise a purchase order against it now.')
              },
              onError: (err) =>
                toast(
                  'bad',
                  'Could not add the supplier',
                  err instanceof Error
                    ? err.message
                    : 'POST /admin/hub/procurement/suppliers failed',
                ),
            },
          )
        }}
      >
        <DcField
          label="Name"
          value={supplierForm.name}
          onChange={(v) => setSupplierForm((f) => ({ ...f, name: v }))}
          placeholder="Islampur Fabrics"
        />
        <DcField
          label="Phone"
          value={supplierForm.phone}
          onChange={(v) => setSupplierForm((f) => ({ ...f, phone: v }))}
          placeholder="01905-010205"
          mono
        />
        <DcField
          label="Email"
          value={supplierForm.email}
          onChange={(v) => setSupplierForm((f) => ({ ...f, email: v }))}
          mono
        />
      </DcModal>

      {/* ── new purchase order ───────────────────────────────────── */}
      <DcModal
        open={poOpen}
        title="Raise a purchase order"
        subtitle="This commits cash against the supplier. Stock only appears once a GRN is filed."
        confirmLabel={`Raise PO · ${formatTaka(poTotal)}`}
        busy={createPo.isPending}
        onClose={() => setPoOpen(false)}
        onConfirm={runCreatePo}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: `600 11px/1 ${FONT}`,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Supplier
          </span>
          <select
            value={poForm.supplierId}
            onChange={(e) => setPoForm((f) => ({ ...f, supplierId: e.target.value }))}
            style={{
              height: 40,
              padding: '0 10px',
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `400 12.5px/1 ${FONT}`,
              outline: 'none',
            }}
          >
            <option value="">Choose a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              font: `600 11px/1 ${FONT}`,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Lines
          </span>
          {poForm.lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: '11px 12px',
                border: '1px solid var(--line)',
                borderRadius: 10,
                background: 'var(--surface-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    font: `600 11px/1 ${MONO}`,
                    color: 'var(--ink-3)',
                    width: 18,
                  }}
                >
                  {i + 1}
                </span>
                <input
                  value={l.productName}
                  onChange={(e) =>
                    setPoForm((f) => ({
                      ...f,
                      lines: f.lines.map((x, idx) =>
                        idx === i ? { ...x, productName: e.target.value } : x,
                      ),
                    }))
                  }
                  placeholder="Product name"
                  style={inputStyle}
                />
                {poForm.lines.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Remove line"
                    title="Remove line"
                    onClick={() =>
                      setPoForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))
                    }
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 28,
                      height: 28,
                      flex: 'none',
                      borderRadius: 8,
                      border: '1px solid var(--bad-bd)',
                      background: 'var(--bad-soft)',
                      color: 'var(--bad)',
                      cursor: 'pointer',
                    }}
                  >
                    <DcIcon name="icon-x" size={12} />
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={l.sku}
                  onChange={(e) =>
                    setPoForm((f) => ({
                      ...f,
                      lines: f.lines.map((x, idx) => (idx === i ? { ...x, sku: e.target.value } : x)),
                    }))
                  }
                  placeholder="SKU (optional)"
                  style={{ ...inputStyle, fontFamily: 'var(--mono)', flex: '1 1 130px' }}
                />
                <input
                  value={l.quantity}
                  onChange={(e) =>
                    setPoForm((f) => ({
                      ...f,
                      lines: f.lines.map((x, idx) =>
                        idx === i ? { ...x, quantity: e.target.value } : x,
                      ),
                    }))
                  }
                  placeholder="Qty"
                  inputMode="numeric"
                  style={{ ...inputStyle, fontFamily: 'var(--mono)', flex: '0 1 80px' }}
                />
                <input
                  value={l.unitCost}
                  onChange={(e) =>
                    setPoForm((f) => ({
                      ...f,
                      lines: f.lines.map((x, idx) =>
                        idx === i ? { ...x, unitCost: e.target.value } : x,
                      ),
                    }))
                  }
                  placeholder="Unit cost"
                  inputMode="numeric"
                  style={{ ...inputStyle, fontFamily: 'var(--mono)', flex: '0 1 110px' }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPoForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}
            className="dc-hover-violet"
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 31,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px dashed var(--line-2)',
              background: 'transparent',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              font: `600 12px/1 ${FONT}`,
            }}
          >
            <DcIcon name="icon-plus" size={13} />
            <span>Add line</span>
          </button>
        </div>

        <DcField
          label="Notes"
          value={poForm.notes}
          onChange={(v) => setPoForm((f) => ({ ...f, notes: v }))}
          area
        />
      </DcModal>

      {/* ── file GRN ─────────────────────────────────────────────── */}
      <DcModal
        open={confirmGrn !== null}
        title={confirmGrn ? `File GRN for ${confirmGrn.poNumber}?` : 'File goods received'}
        subtitle="This records the stock as received and adds it to the ledger. It cannot be undone here."
        confirmLabel="File GRN"
        busy={receiveGrn.isPending}
        onClose={() => setConfirmGrn(null)}
        onConfirm={() =>
          confirmGrn &&
          receiveGrn.mutate(
            { purchaseOrderId: confirmGrn.id },
            {
              onSuccess: (res) => {
                setConfirmGrn(null)
                toast(
                  'ok',
                  `${res.grn.grnNumber} filed`,
                  `${confirmGrn.poNumber} is now ${res.purchaseOrder.status.toLowerCase()}.`,
                )
              },
              onError: (err) => {
                setConfirmGrn(null)
                toast(
                  'bad',
                  'Could not file the GRN',
                  err instanceof Error
                    ? err.message
                    : 'POST /admin/hub/procurement/goods-received failed',
                )
              },
            },
          )
        }
      />
    </>
  )
}

const inputStyle = {
  flex: 1,
  minWidth: 0,
  height: 34,
  padding: '0 11px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  outline: 'none',
  color: 'var(--ink)',
  font: `400 12.5px/1 ${FONT}`,
} as const

function SectionHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '12px 15px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span style={{ flex: 1, minWidth: 140, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
        {title}
      </span>
      <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{meta}</span>
    </div>
  )
}

function Chip({ tone, label }: { tone: { bg: string; fg: string; bd: string }; label: string }) {
  return (
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
      {label}
    </span>
  )
}

function Note({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '40px 15px',
        textAlign: 'center',
        font: `400 12.5px/1.55 ${FONT}`,
        color: 'var(--ink-3)',
      }}
    >
      {text}
    </div>
  )
}

function Kpi({
  label,
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
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
