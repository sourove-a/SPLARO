'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcSaveBar } from '@/components/dc/DcSaveBar'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import type { WmsTransfer, WmsWarehouse } from '@/lib/api/commerce-os'
import {
  useReceiveStockTransfer,
  useRecordStockMovement,
  useShipStockTransfer,
  useWmsOverview,
} from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

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

/** The nine StockMovementReason values, each toned. */
const REASONS = [
  'PURCHASE',
  'SALE',
  'TRANSFER',
  'ADJUSTMENT',
  'DAMAGE',
  'RETURN',
  'PRODUCTION',
  'AUDIT',
  'RESERVATION',
] as const

const REASON_TONE: Record<string, DcTone> = {
  PURCHASE: 'ok',
  SALE: 'info',
  TRANSFER: 'info',
  ADJUSTMENT: 'warn',
  DAMAGE: 'bad',
  RETURN: 'ok',
  PRODUCTION: 'ok',
  AUDIT: 'mute',
  RESERVATION: 'info',
}

/** The guards the API enforces — surfaced as inline errors, not silent failures. */
const GUARDS = [
  'delta must be a non-zero integer',
  'Insufficient stock (N available)',
  'Transfer is pending, not in transit',
  'Source and destination warehouse must differ',
]

function binCount(w: WmsWarehouse) {
  return (w.zones ?? []).reduce(
    (r, zone) => r + (zone.racks ?? []).reduce((rr, rack) => rr + (rack.bins?.length ?? 0), 0),
    0,
  )
}

export function DcWarehouseStock() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="wms" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcWarehouseStockBody />
    </DcScreenProvider>
  )
}

function DcWarehouseStockBody() {
  const { toast } = useDcScreen()
  const wms = useWmsOverview()
  const record = useRecordStockMovement()
  const ship = useShipStockTransfer()
  const receive = useReceiveStockTransfer()
  const { api } = useAdminConnection(25_000)

  const [form, setForm] = useState({ sku: '', delta: '', reason: 'ADJUSTMENT', note: '' })
  const [confirmMove, setConfirmMove] = useState(false)
  const [confirmShip, setConfirmShip] = useState<WmsTransfer | null>(null)
  const [confirmReceive, setConfirmReceive] = useState<WmsTransfer | null>(null)

  const d = wms.data
  const warehouses = useMemo(() => d?.warehouses ?? [], [d])
  const movements = useMemo(() => d?.movements ?? [], [d])
  const transfers = useMemo(() => d?.transfers ?? [], [d])
  const summary = d?.stockSummary ?? { available: 0, reserved: 0, damaged: 0 }

  const bins = useMemo(() => warehouses.reduce((t, w) => t + binCount(w), 0), [warehouses])
  const pending = transfers.filter((t) => t.status.toUpperCase() === 'PENDING')
  const inTransit = transfers.filter((t) => t.status.toUpperCase() === 'IN_TRANSIT')

  const pageStatus = dcPageStatus([wms], api.pulse)
  const n = (v: number) => v.toLocaleString('en-IN')

  const deltaNum = Number(form.delta)
  const deltaValid = Number.isInteger(deltaNum) && deltaNum !== 0
  const formDirty = form.sku.trim() !== '' || form.delta.trim() !== '' || form.note.trim() !== ''

  const runRecord = () => {
    if (!form.sku.trim()) {
      toast('warn', 'SKU is required', 'The API rejects a movement without a SKU or variant id.')
      return
    }
    if (!deltaValid) {
      // Exactly the guard the API enforces.
      toast('warn', 'delta must be a non-zero integer', '0 and decimals are rejected server-side.')
      return
    }
    setConfirmMove(true)
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
    { t: 'form', w: 'side', title: '', fields: [] } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Operations"
        title="Warehouse & Stock"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          wms.isFetching
            ? 'syncing…'
            : `${warehouses.length} warehouse${warehouses.length === 1 ? '' : 's'} · ${n(summary.available)} available`
        }
        syncing={wms.isFetching}
        onSync={() => void wms.refetch()}
      />

      {wms.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : wms.error ? (
        <DcErrorState
          error={`GET /commerce-os/wms/overview → ${wms.error instanceof Error ? wms.error.message : '500 Internal Server Error'}`}
          hint="Stock in the bins is unaffected — only this view failed to load."
          onRetry={() => void wms.refetch()}
        />
      ) : warehouses.length === 0 && movements.length === 0 ? (
        <DcEmptyState
          icon="icon-warehouse"
          title="No stock movements yet"
          body="Nothing received, reserved or written off. Counts here update the moment a parcel is packed or a movement is recorded."
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
            <Kpi label="Available" value={n(summary.available)} sub="sellable across every bin" />
            <Kpi
              label="Reserved"
              value={n(summary.reserved)}
              sub="held against open orders"
              color={summary.reserved > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Damaged"
              value={n(summary.damaged)}
              sub="written off, not sellable"
              color={summary.damaged > 0 ? 'var(--bad)' : 'var(--ink)'}
            />
            <Kpi
              label="Bins in use"
              value={n(bins)}
              sub={`across ${warehouses.length} warehouse${warehouses.length === 1 ? '' : 's'}`}
            />
          </div>

          {pending.length + inTransit.length > 0 ? (
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
                  Transfers waiting on you
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 60,
                    font: `400 11.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  a transfer only moves stock when someone ships and someone receives
                </span>
              </div>
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                  gap: 10,
                }}
              >
                {[...pending, ...inTransit].map((t) => {
                  const isPending = t.status.toUpperCase() === 'PENDING'
                  const tone = toneStyle(isPending ? 'warn' : 'info')
                  return (
                    <div
                      key={t.id}
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
                      <span
                        style={{ font: `600 13px/1.35 ${FONT}`, color: 'var(--ink)' }}
                      >
                        {t.fromWarehouse.name} → {t.toWarehouse.name}
                      </span>
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          font: '700 9.5px/1.3 Inter, sans-serif',
                          letterSpacing: '.07em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isPending ? 'Pending · not shipped' : 'In transit · not received'}
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
                          {isPending ? 'Ship this transfer' : 'Receive at destination'}
                        </span>
                        <span style={{ font: `500 11px/1.4 ${FONT}`, color: tone.fg }}>
                          raised{' '}
                          {new Date(t.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                        <Stat k="Items" v={String(t.items?.length ?? 0)} />
                        <Stat k="Status" v={t.status.replace(/_/g, ' ')} />
                        <Stat
                          k="Raised"
                          v={new Date(t.createdAt).toLocaleDateString('en-GB')}
                        />
                      </div>
                      <span
                        style={{
                          font: `400 11.5px/1.55 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {t.notes ??
                          (isPending
                            ? 'Stock stays counted at the source warehouse until it ships.'
                            : 'Neither warehouse can sell this stock until it is received.')}
                      </span>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingTop: 2 }}>
                        <button
                          type="button"
                          disabled={ship.isPending || receive.isPending}
                          onClick={() =>
                            isPending ? setConfirmShip(t) : setConfirmReceive(t)
                          }
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid var(--violet-solid)',
                            background: 'var(--violet-solid)',
                            color: 'var(--on-violet)',
                            cursor: ship.isPending || receive.isPending ? 'not-allowed' : 'pointer',
                            font: `600 11.5px/1 ${FONT}`,
                          }}
                        >
                          {isPending ? 'Ship transfer' : 'Receive transfer'}
                        </button>
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
                <SectionHead title="Warehouses" meta={`${warehouses.length} on file`} />
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Warehouse</th>
                      <th style={th}>Code</th>
                      <th style={th}>City</th>
                      <th style={{ ...th, textAlign: 'right' }}>Zones</th>
                      <th style={{ ...th, textAlign: 'right' }}>Bins</th>
                      <th style={th}>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((w) => {
                      const tone = toneStyle(w.isActive ? 'ok' : 'mute')
                      return (
                        <tr key={w.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '10px 15px', font: `500 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                            {w.name}
                          </td>
                          <td style={{ padding: '10px 15px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                            {w.code}
                          </td>
                          <td style={{ padding: '10px 15px', font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                            {w.city ?? '—'}
                          </td>
                          <td style={{ padding: '10px 15px', textAlign: 'right', font: `600 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {w.zones?.length ?? 0}
                          </td>
                          <td style={{ padding: '10px 15px', textAlign: 'right', font: `600 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {binCount(w)}
                          </td>
                          <td style={{ padding: '10px 15px' }}>
                            <Chip tone={tone} label={w.isActive ? 'Active' : 'Archived'} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ ...card, overflow: 'auto' }}>
                <SectionHead
                  title="Stock movement ledger"
                  meta="every write, who made it and why — this is the audit trail"
                />
                {movements.length === 0 ? (
                  <Note text="No movements recorded yet." />
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>When</th>
                        <th style={th}>SKU</th>
                        <th style={th}>Reason</th>
                        <th style={th}>Before → After</th>
                        <th style={{ ...th, textAlign: 'right' }}>Delta</th>
                        <th style={th}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.slice(0, 25).map((m) => {
                        const tone = toneStyle(REASON_TONE[m.reason?.toUpperCase() ?? ''] ?? 'mute')
                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '10px 15px', font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                              {new Date(m.createdAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td style={{ padding: '10px 15px', font: `500 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                              {m.sku ?? '—'}
                            </td>
                            <td style={{ padding: '10px 15px' }}>
                              <Chip tone={tone} label={m.reason} />
                            </td>
                            <td style={{ padding: '10px 15px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                              {m.quantityBefore} → {m.quantityAfter}
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                textAlign: 'right',
                                font: `600 13px/1 ${MONO}`,
                                color: m.delta < 0 ? 'var(--bad)' : 'var(--ok)',
                              }}
                            >
                              {m.delta > 0 ? `+${m.delta}` : m.delta}
                            </td>
                            <td style={{ padding: '10px 15px', font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                              {m.note ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div
              style={{
                flex: '1 1 28%',
                minWidth: 290,
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  ...card,
                  padding: '15px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 13,
                }}
              >
                <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Record a movement
                </span>
                <DcField
                  label="SKU"
                  value={form.sku}
                  onChange={(v) => setForm((f) => ({ ...f, sku: v }))}
                  placeholder="SPL-KRT-337"
                  mono
                  hint="Must exist in this store — the API rejects unknown SKUs."
                />
                <DcField
                  label="Delta"
                  value={form.delta}
                  onChange={(v) => setForm((f) => ({ ...f, delta: v }))}
                  placeholder="-2"
                  mono
                  hint="Non-zero integer. A negative that takes stock below 0 is refused."
                />
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span
                    style={{
                      font: `600 11px/1 ${FONT}`,
                      letterSpacing: '.07em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                    }}
                  >
                    Reason
                  </span>
                  <select
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    style={{
                      height: 40,
                      padding: '0 10px',
                      borderRadius: 9,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      color: 'var(--ink)',
                      font: `400 12.5px/1 ${MONO}`,
                      outline: 'none',
                    }}
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <DcField
                  label="Note"
                  value={form.note}
                  onChange={(v) => setForm((f) => ({ ...f, note: v }))}
                  area
                  hint="Optional, but an unexplained adjustment is what an audit flags first."
                />
                <DcSaveBar
                  dirty={formDirty}
                  saving={record.isPending}
                  hint="This writes a StockMovementLog row and changes sellable stock."
                  cleanNote="Fill the form to record a movement."
                  onReset={() => setForm({ sku: '', delta: '', reason: 'ADJUSTMENT', note: '' })}
                  onSave={runRecord}
                />
              </div>

              <div style={{ ...card, padding: '6px 16px 8px' }}>
                <SectionHead title="Guards the API enforces" meta="you see these as errors" />
                {GUARDS.map((g) => (
                  <div
                    key={g}
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
                        color: 'var(--ink-2)',
                      }}
                    >
                      <DcIcon name="icon-shield" size={13} />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        font: `500 12px/1.4 ${MONO}`,
                        color: 'var(--ink-2)',
                        textWrap: 'pretty',
                      }}
                    >
                      {g}
                    </span>
                    <span style={{ font: `600 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>400</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <DcModal
        open={confirmMove}
        title={`Record ${form.delta} on ${form.sku.trim() || 'this SKU'}?`}
        subtitle="This changes sellable stock immediately and writes an audit row that cannot be deleted."
        confirmLabel="Record movement"
        danger={deltaNum < 0}
        busy={record.isPending}
        onClose={() => setConfirmMove(false)}
        onConfirm={() =>
          record.mutate(
            {
              sku: form.sku.trim(),
              delta: deltaNum,
              reason: form.reason,
              ...(form.note.trim() ? { note: form.note.trim() } : {}),
            },
            {
              onSuccess: () => {
                setConfirmMove(false)
                setForm({ sku: '', delta: '', reason: 'ADJUSTMENT', note: '' })
                toast('ok', 'Movement recorded', 'The ledger and the bin counts both updated.')
              },
              onError: (err) => {
                setConfirmMove(false)
                toast(
                  'bad',
                  'Movement refused',
                  err instanceof Error
                    ? err.message
                    : 'POST /commerce-os/wms/movements failed',
                )
              },
            },
          )
        }
      />

      <DcModal
        open={confirmShip !== null}
        title={
          confirmShip
            ? `Ship ${confirmShip.fromWarehouse.name} → ${confirmShip.toWarehouse.name}?`
            : 'Ship transfer'
        }
        subtitle="Stock leaves the source warehouse and is unsellable at both ends until it is received."
        confirmLabel="Ship transfer"
        busy={ship.isPending}
        onClose={() => setConfirmShip(null)}
        onConfirm={() =>
          confirmShip &&
          ship.mutate(confirmShip.id, {
            onSuccess: () => {
              setConfirmShip(null)
              toast('ok', 'Transfer shipped', 'It is now in transit and waiting to be received.')
            },
            onError: (err) => {
              setConfirmShip(null)
              toast(
                'bad',
                'Could not ship the transfer',
                err instanceof Error
                  ? err.message
                  : `POST /commerce-os/wms/transfers/${confirmShip.id}/ship failed`,
              )
            },
          })
        }
      />

      <DcModal
        open={confirmReceive !== null}
        title={
          confirmReceive
            ? `Receive at ${confirmReceive.toWarehouse.name}?`
            : 'Receive transfer'
        }
        subtitle="Stock becomes sellable at the destination and the transfer closes."
        confirmLabel="Receive transfer"
        busy={receive.isPending}
        onClose={() => setConfirmReceive(null)}
        onConfirm={() =>
          confirmReceive &&
          receive.mutate(confirmReceive.id, {
            onSuccess: () => {
              setConfirmReceive(null)
              toast('ok', 'Transfer received', 'Stock is sellable at the destination now.')
            },
            onError: (err) => {
              setConfirmReceive(null)
              toast(
                'bad',
                'Could not receive the transfer',
                err instanceof Error
                  ? err.message
                  : `POST /commerce-os/wms/transfers/${confirmReceive.id}/receive failed`,
              )
            },
          })
        }
      />
    </>
  )
}

/* ── small parts ─────────────────────────────────────────────────── */

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

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span
        style={{
          font: '600 9px/1.3 Inter, sans-serif',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {k}
      </span>
      <span style={{ font: `600 11.5px/1.3 ${MONO}`, color: 'var(--ink-2)' }}>{v}</span>
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
