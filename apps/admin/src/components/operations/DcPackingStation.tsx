'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { printInvoice, printOrderLabel, printOrderSticker } from '@/lib/admin/admin-actions'
import { toastCourierResult, toastFail } from '@/lib/admin/feedback'
import { useBookCourier, useFulfillmentTodayStats, useOrders } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import {
  lookupFulfillment,
  scanFulfillment,
  type FulfillmentScanAction,
  type FulfillmentStationOrder,
} from '@/lib/api/fulfillment'
import { formatBdPhone, telHref } from '@/lib/format/bd-phone'
import { resolveMediaUrl } from '@/lib/media-url'
import { matchStationItem } from '@/lib/scan/match-sku'

const MODES: Array<{ id: FulfillmentScanAction; label: string; sub: string }> = [
  { id: 'pack', label: 'প্যাকিং', sub: 'Confirmed / Processing → Packed · one scan per parcel' },
  { id: 'dispatch', label: 'ডিসপ্যাচ', sub: 'Packed → Shipped · label + rider handoff' },
]

const PACK_QUEUE = 'CONFIRMED,PROCESSING,COURIER_BOOKED'
const HISTORY_KEY = 'splaro.packing.session-history'

interface ScanRow {
  time: string
  id: string
  ok: boolean
  message: string
  by: string
  itemCount?: number
}

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const th = {
  textAlign: 'left' as const,
  padding: '8px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
}

function readHistory(): ScanRow[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ScanRow[]
    return Array.isArray(parsed) ? parsed.slice(0, 40) : []
  } catch {
    return []
  }
}

function writeHistory(rows: ScanRow[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 40)))
  } catch {
    /* ignore quota */
  }
}

export function DcPackingStation() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="packing" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPackingBody />
    </DcScreenProvider>
  )
}

function DcPackingBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const bookCourier = useBookCourier()
  const [mode, setMode] = useState<FulfillmentScanAction>('pack')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<ScanRow[]>([])
  const [blocked, setBlocked] = useState<{ id: string; message: string } | null>(null)
  const [active, setActive] = useState<FulfillmentStationOrder | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [autoPrint, setAutoPrint] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  const queueStatus = mode === 'pack' ? PACK_QUEUE : 'PACKED'
  const orders = useOrders({ status: queueStatus, limit: 50 })
  const queue = useMemo(() => orders.data?.orders ?? [], [orders.data])
  const todayStats = useFulfillmentTodayStats()
  const stats = todayStats.data ?? { packed: 0, shipped: 0 }

  useEffect(() => {
    setHistory(readHistory())
  }, [])

  useEffect(() => {
    writeHistory(history)
  }, [history])

  useEffect(() => {
    const focus = () => {
      const mobile = window.matchMedia('(max-width: 820px)').matches
      ;(mobile ? mobileInputRef.current : inputRef.current)?.focus()
    }
    focus()
    const timer = window.setInterval(focus, 1200)
    return () => window.clearInterval(timer)
  }, [])

  const pushHistory = useCallback((row: ScanRow) => {
    setHistory((h) => [row, ...h].slice(0, 40))
  }, [])

  const loadPreview = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed || busy) return
      setBusy(true)
      try {
        const order = await lookupFulfillment(trimmed)
        setActive(order)
        setChecked({})
        setCode(order.invoiceNumber)
        setBlocked(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lookup failed'
        setBlocked({ id: trimmed, message })
        toast('bad', 'Not found', message)
      } finally {
        setBusy(false)
        inputRef.current?.focus()
        mobileInputRef.current?.focus()
      }
    },
    [busy, toast],
  )

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed || busy) return

      if (active) {
        const hit = matchStationItem(active.items, trimmed)
        if (hit) {
          const already = Boolean(checked[hit.id])
          const next = { ...checked, [hit.id]: true }
          setChecked(next)
          setCode('')
          const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          const label = hit.sku !== '—' ? hit.sku : hit.barcode || trimmed
          const allDone = active.items.every((item) => next[item.id])
          pushHistory({
            time,
            id: label,
            ok: true,
            message: already ? `Already checked · ${hit.name}` : `Verified ${hit.name}`,
            by: 'you',
          })
          toast(
            'ok',
            allDone ? 'Pick list complete' : label,
            allDone
              ? 'Scan invoice again or tap Pack'
              : already
                ? 'Already checked'
                : 'Item verified',
          )
          inputRef.current?.focus()
          mobileInputRef.current?.focus()
          return
        }
      }

      setBusy(true)
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      try {
        const result = await scanFulfillment(trimmed, mode)
        setActive(result)
        setChecked({})
        pushHistory({
          time,
          id: result.invoiceNumber || trimmed,
          ok: result.ok,
          message: result.message,
          by: 'you',
          itemCount: result.itemCount,
        })
        if (result.ok) {
          setBlocked(null)
          toast('ok', `${result.invoiceNumber} ${mode === 'pack' ? 'packed' : 'dispatched'}`, result.message)
          if (autoPrint && mode === 'pack' && result.previousStatus !== result.status) {
            void printOrderLabel(result.invoiceNumber)
          }
        } else {
          setBlocked({ id: result.invoiceNumber || trimmed, message: result.message })
          toast('bad', 'Scan rejected', result.message)
        }
        void todayStats.refetch()
        void orders.refetch()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'POST /admin/fulfillment/scan failed'
        pushHistory({ time, id: trimmed, ok: false, message, by: 'you' })
        setBlocked({ id: trimmed, message })
        toast('bad', 'Scan failed', message)
      } finally {
        setCode('')
        setBusy(false)
        inputRef.current?.focus()
        mobileInputRef.current?.focus()
      }
    },
    [active, autoPrint, busy, checked, mode, orders, pushHistory, todayStats, toast],
  )

  const handleBookCourier = async () => {
    if (!active) return
    try {
      const res = await bookCourier.mutateAsync({ id: active.invoiceNumber })
      toastCourierResult(res, active.invoiceNumber)
      const refreshed = await lookupFulfillment(active.invoiceNumber)
      setActive(refreshed)
      void orders.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Courier booking failed')
    }
  }

  const allChecked =
    Boolean(active?.items.length) && active!.items.every((item) => checked[item.id])
  const done = mode === 'pack' ? stats.packed : stats.shipped
  const total = done + queue.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([orders], api.pulse)
  const canActOnActive =
    active &&
    (mode === 'pack'
      ? ['CONFIRMED', 'PROCESSING', 'COURIER_BOOKED', 'PENDING'].includes(active.status)
      : active.status === 'PACKED')

  return (
    <>
      <DcPageHead
        crumbGroup="Operations · Packing Station"
        title="প্যাকিং স্টেশন"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={`${queue.length} in queue`}
        syncing={orders.isFetching}
        onSync={() => {
          void orders.refetch()
          void todayStats.refetch()
        }}
        actions={[
          {
            label: 'End session',
            icon: 'icon-log-out',
            onClick: () => router.push('/dashboard/operations'),
          },
        ]}
      />

      <div className="dc-mobile-route-panel" aria-label="Packing station">
        <div className="dc-mobile-kpi-grid">
          <div className="dc-mobile-kpi">
            <span className="dc-mobile-kpi__label">Packed</span>
            <span className="dc-mobile-kpi__value">{stats.packed}</span>
            <span className="dc-mobile-kpi__sub">today</span>
          </div>
          <div className="dc-mobile-kpi">
            <span className="dc-mobile-kpi__label">Shipped</span>
            <span className="dc-mobile-kpi__value">{stats.shipped}</span>
            <span className="dc-mobile-kpi__sub">today</span>
          </div>
          <div className="dc-mobile-kpi" data-warn={queue.length > 0 ? 'true' : 'false'}>
            <span className="dc-mobile-kpi__label">Queue</span>
            <span className="dc-mobile-kpi__value">{queue.length}</span>
            <span className="dc-mobile-kpi__sub">{mode === 'pack' ? 'to pack' : 'to ship'}</span>
          </div>
          <div className="dc-mobile-kpi">
            <span className="dc-mobile-kpi__label">Progress</span>
            <span className="dc-mobile-kpi__value">{pct}%</span>
            <span className="dc-mobile-kpi__sub">
              {done}/{total || 0}
            </span>
          </div>
        </div>

        <div className="dc-mobile-chips" role="tablist" aria-label="Pack mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="dc-mobile-chip"
              data-on={mode === m.id ? 'true' : 'false'}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form
          className="dc-mobile-scan"
          onSubmit={(e) => {
            e.preventDefault()
            void submit(code)
          }}
        >
          <input
            ref={mobileInputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invoice, then item SKU / barcode…"
            aria-label="Scan invoice"
            autoComplete="off"
            inputMode="text"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !code.trim()}>
            {busy ? '…' : mode === 'pack' ? 'Pack' : 'Ship'}
          </button>
        </form>

        {blocked ? (
          <div className="dc-mobile-list-card" style={{ borderColor: 'var(--bad-bd)', background: 'var(--bad-soft)' }}>
            <span className="dc-mobile-list-card__copy">
              <span className="dc-mobile-list-card__title">{blocked.id}</span>
              <span className="dc-mobile-list-card__sub">{blocked.message}</span>
            </span>
          </div>
        ) : null}

        {active ? (
          <ActiveOrderCard
            order={active}
            mode={mode}
            checked={checked}
            onToggle={(id) => setChecked((c) => ({ ...c, [id]: !c[id] }))}
            allChecked={allChecked}
            canAct={Boolean(canActOnActive)}
            busy={busy || bookCourier.isPending}
            onPack={() => void submit(active.invoiceNumber)}
            onPrintLabel={() => void printOrderLabel(active.invoiceNumber)}
            onPrintSticker={() => void printOrderSticker(active.invoiceNumber)}
            onPrintInvoice={() => void printInvoice(active.invoiceNumber)}
            onBookCourier={() => void handleBookCourier()}
            onOpen={() => router.push(`/dashboard/orders?search=${encodeURIComponent(active.invoiceNumber)}`)}
            compact
          />
        ) : null}

        <div className="dc-mobile-list">
          {queue.slice(0, 12).map((o) => (
            <button
              key={o.id}
              type="button"
              className="dc-mobile-list-card"
              onClick={() => void loadPreview(o.invoiceNumber)}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="dc-mobile-list-card__icon" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}>
                <DcIcon name="icon-package" size={15} />
              </span>
              <span className="dc-mobile-list-card__copy">
                <span className="dc-mobile-list-card__title">{o.invoiceNumber}</span>
                <span className="dc-mobile-list-card__sub">
                  {o.shippingName} · {o.items?.reduce((n, i) => n + i.quantity, 0) || 0} pcs · {formatTaka(Number(o.total))}
                </span>
              </span>
            </button>
          ))}
          {queue.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--ink-3)',
                font: `500 12.5px/1.45 ${FONT}`,
                border: '1px solid var(--line)',
                borderRadius: 12,
                background: 'var(--surface)',
              }}
            >
              Queue empty for {mode === 'pack' ? 'packing' : 'dispatch'}.
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="dc-desktop-route-panel"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 380px)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MODES.map((m) => {
              const on = m.id === mode
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  style={{
                    flex: 1,
                    minWidth: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    padding: '11px 13px',
                    borderRadius: 11,
                    border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
                    background: on ? 'var(--violet-soft)' : 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ font: `600 13px/1 ${FONT}`, color: on ? 'var(--violet)' : 'var(--ink)' }}>
                    {m.label}
                  </span>
                  <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{m.sub}</span>
                </button>
              )
            })}
          </div>

          <div
            style={{
              border: '1px solid var(--violet-bd)',
              borderRadius: 14,
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '13px 18px',
                borderBottom: '1px solid var(--line)',
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink)' }}>Today&rsquo;s queue</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 120,
                  height: 6,
                  borderRadius: 99,
                  background: 'var(--surface-3)',
                  overflow: 'hidden',
                  display: 'block',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 99,
                    background: 'var(--ok)',
                  }}
                />
              </span>
              <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                {done} / {total}
              </span>
              <span style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>{queue.length} left</span>
            </div>

            <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: busy ? 'var(--warn)' : 'var(--ok)',
                    animation: 'dc-pulse 1.8s infinite',
                  }}
                />
                <span
                  style={{
                    font: `600 11px/1 ${FONT}`,
                    letterSpacing: '.09em',
                    textTransform: 'uppercase',
                    color: busy ? 'var(--warn)' : 'var(--ok)',
                  }}
                >
                  {busy ? 'Working…' : 'Scanner ready'}
                </span>
                <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  USB HID · keyboard wedge · focus locked
                </span>
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
                  Auto-print label on pack
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  height: 64,
                  padding: '0 18px',
                  borderRadius: 11,
                  border: '2px solid var(--violet)',
                  background: 'var(--surface-2)',
                }}
              >
                <DcIcon name="icon-scan-line" size={22} color="var(--violet)" />
                <input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit(code)
                    if (e.key === 'Escape') {
                      setCode('')
                      setActive(null)
                    }
                  }}
                  placeholder="Scan invoice, then item SKU / barcode…"
                  aria-label="Scan parcel"
                  style={{
                    flex: 1,
                    border: 0,
                    background: 'transparent',
                    outline: 'none',
                    font: `600 21px/1 ${MONO}`,
                    color: 'var(--ink)',
                    letterSpacing: '.02em',
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !code.trim()}
                  onClick={() => void loadPreview(code)}
                  style={{
                    height: 34,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink-2)',
                    cursor: busy || !code.trim() ? 'not-allowed' : 'pointer',
                    font: `600 12px/1 ${FONT}`,
                  }}
                >
                  Preview
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  font: `400 12px/1 ${FONT}`,
                  color: 'var(--ink-3)',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  Preview invoice → scan each item barcode to tick pick list → scan invoice again to
                  pack. Preview never changes status.
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Kbd>Esc</Kbd> clear
                </span>
              </div>
            </div>

            {active ? (
              <div style={{ borderTop: '1px solid var(--line)', padding: 16 }}>
                <ActiveOrderCard
                  order={active}
                  mode={mode}
                  checked={checked}
                  onToggle={(id) => setChecked((c) => ({ ...c, [id]: !c[id] }))}
                  allChecked={allChecked}
                  canAct={Boolean(canActOnActive)}
                  busy={busy || bookCourier.isPending}
                  onPack={() => void submit(active.invoiceNumber)}
                  onPrintLabel={() => void printOrderLabel(active.invoiceNumber)}
                  onPrintSticker={() => void printOrderSticker(active.invoiceNumber)}
                  onPrintInvoice={() => void printInvoice(active.invoiceNumber)}
                  onBookCourier={() => void handleBookCourier()}
                  onOpen={() => router.push(`/dashboard/orders?search=${encodeURIComponent(active.invoiceNumber)}`)}
                />
              </div>
            ) : history[0]?.ok ? (
              <div
                style={{
                  borderTop: '1px solid var(--line)',
                  background: 'var(--ok-soft)',
                  padding: '15px 18px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 36,
                    height: 36,
                    flex: 'none',
                    borderRadius: 10,
                    background: 'var(--ok)',
                    color: 'var(--admin-c-04100a)',
                  }}
                >
                  <DcIcon name="icon-check" size={19} />
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ font: `700 16px/1 ${MONO}`, color: 'var(--ink)' }}>{history[0].id}</span>
                    <span style={{ font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>{history[0].message}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
                font: `600 13px/1 ${FONT}`,
                color: 'var(--ink)',
              }}
            >
              Scanned this session
            </div>
            {history.length === 0 ? (
              <div
                style={{
                  padding: '34px 15px',
                  textAlign: 'center',
                  font: `400 12.5px/1.5 ${FONT}`,
                  color: 'var(--ink-3)',
                }}
              >
                Nothing scanned yet. The first parcel appears here the moment it goes through.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Time</th>
                      <th style={th}>Order</th>
                      <th style={th}>Items</th>
                      <th style={th}>Result</th>
                      <th style={{ ...th, textAlign: 'right' }}>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => {
                      const t = toneStyle(h.ok ? 'ok' : 'bad')
                      return (
                        <tr key={`${h.time}-${h.id}-${i}`} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '9px 15px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                            {h.time}
                          </td>
                          <td style={{ padding: '9px 15px' }}>
                            <button
                              type="button"
                              onClick={() => void loadPreview(h.id)}
                              style={{
                                border: 0,
                                background: 'transparent',
                                cursor: 'pointer',
                                font: `600 12.5px/1 ${MONO}`,
                                color: 'var(--ink)',
                                padding: 0,
                              }}
                            >
                              {h.id}
                            </button>
                          </td>
                          <td style={{ padding: '9px 15px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                            {h.itemCount ?? '—'}
                          </td>
                          <td style={{ padding: '9px 15px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '3px 8px',
                                borderRadius: 6,
                                font: `600 11px/1 ${FONT}`,
                                border: `1px solid ${t.bd}`,
                                background: t.bg,
                                color: t.fg,
                              }}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                              {h.message}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '9px 15px',
                              textAlign: 'right',
                              font: `400 12px/1 ${FONT}`,
                              color: 'var(--ink-3)',
                            }}
                          >
                            {h.by}
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

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <PackKpi icon="icon-package-check" color="var(--ok)" label="Packed today" value={String(stats.packed)} />
            <PackKpi icon="icon-truck" color="var(--info)" label="Shipped today" value={String(stats.shipped)} />
            <PackKpi icon="icon-list-ordered" color="var(--violet)" label="In queue" value={String(queue.length)} />
            <PackKpi icon="icon-scan-line" color="var(--ink-2)" label="Scans this session" value={String(history.length)} />
          </div>

          {blocked ? (
            <div
              style={{
                border: '1px solid var(--bad-bd)',
                borderRadius: 14,
                background: 'var(--bad-soft)',
                padding: '13px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DcIcon name="icon-triangle-alert" size={13} color="var(--bad)" />
                <span
                  style={{
                    flex: 1,
                    font: `700 10px/1 ${FONT}`,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: 'var(--bad)',
                  }}
                >
                  Blocked · needs a decision
                </span>
              </span>
              <span style={{ font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink)', textWrap: 'pretty' }}>
                <strong style={{ fontFamily: 'var(--mono)' }}>{blocked.id}</strong> — {blocked.message}
              </span>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/orders?search=${encodeURIComponent(blocked.id)}`)}
                  style={btnPrimary}
                >
                  Open the order
                </button>
                <button type="button" onClick={() => setBlocked(null)} style={btnGhost}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                padding: '11px 14px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ flex: 1, font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>Up next</span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  font: `600 10.5px/1 ${MONO}`,
                  color: 'var(--ink-3)',
                }}
              >
                {queue.length} queued
              </span>
            </div>
            {queue.length === 0 ? (
              <div
                style={{
                  padding: '28px 14px',
                  textAlign: 'center',
                  font: `400 12px/1.5 ${FONT}`,
                  color: 'var(--ink-3)',
                }}
              >
                Queue is clear. Nothing waiting to be {mode === 'pack' ? 'packed' : 'dispatched'}.
              </div>
            ) : (
              queue.slice(0, 12).map((o, i) => {
                const risk = o.isCodRisk
                const flag = toneStyle(risk ? 'bad' : 'mute')
                const pcs = o.items?.reduce((n, item) => n + item.quantity, 0) ?? 0
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => void loadPreview(o.invoiceNumber)}
                    className="dc-hover-surface"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '9px 14px',
                      border: 0,
                      borderBottom: '1px solid var(--line)',
                      background: active?.invoiceNumber === o.invoiceNumber ? 'var(--violet-soft)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 19, flex: 'none', font: `600 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>{o.invoiceNumber}</span>
                        {risk ? (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 5,
                              border: `1px solid ${flag.bd}`,
                              background: flag.bg,
                              font: `700 9px/1 ${FONT}`,
                              letterSpacing: '.07em',
                              color: flag.fg,
                            }}
                          >
                            COD RISK
                          </span>
                        ) : null}
                      </span>
                      <span
                        style={{
                          font: `400 11px/1.3 ${FONT}`,
                          color: 'var(--ink-3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {o.shippingName} · {o.shippingCity}
                        {pcs ? ` · ${pcs} pcs` : ''}
                      </span>
                    </span>
                    <span style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ font: `600 11.5px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                        {formatTaka(Number(o.total))}
                      </span>
                      <span style={{ font: `400 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{o.status}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span
              style={{
                font: `600 10.5px/1 ${FONT}`,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              Station
            </span>
            <StationRow tone="ok" label="Scanner input" value="focus locked" />
            <StationRow tone={busy ? 'warn' : 'ok'} label="Scan endpoint" value="/admin/fulfillment/scan" />
            <StationRow
              tone={orders.error ? 'bad' : 'ok'}
              label="Queue feed"
              value={orders.error ? 'failed' : mode === 'pack' ? 'confirmed + processing' : 'packed'}
            />
            <StationRow tone={autoPrint ? 'ok' : 'mute'} label="Auto label" value={autoPrint ? 'on pack' : 'off'} />
          </div>
        </div>
      </div>
    </>
  )
}

const btnPrimary: CSSProperties = {
  height: 30,
  padding: '0 11px',
  borderRadius: 8,
  border: 0,
  background: 'var(--violet-solid)',
  color: 'var(--on-violet)',
  cursor: 'pointer',
  font: `600 11.5px/1 ${FONT}`,
}

const btnGhost: CSSProperties = {
  height: 30,
  padding: '0 11px',
  borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
  font: `600 11.5px/1 ${FONT}`,
}

function ActiveOrderCard({
  order,
  mode,
  checked,
  onToggle,
  allChecked,
  canAct,
  busy,
  onPack,
  onPrintLabel,
  onPrintSticker,
  onPrintInvoice,
  onBookCourier,
  onOpen,
  compact = false,
}: {
  order: FulfillmentStationOrder
  mode: FulfillmentScanAction
  checked: Record<string, boolean>
  onToggle: (id: string) => void
  allChecked: boolean
  canAct: boolean
  busy: boolean
  onPack: () => void
  onPrintLabel: () => void
  onPrintSticker: () => void
  onPrintInvoice: () => void
  onBookCourier: () => void
  onOpen: () => void
  compact?: boolean
}) {
  const risk = toneStyle(order.isCodRisk ? 'bad' : 'mute')
  const booked = Boolean(order.courier?.consignmentId)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ font: `700 18px/1 ${MONO}`, color: 'var(--ink)' }}>{order.invoiceNumber}</span>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--violet)' }}>{order.status}</span>
            {order.isCodRisk ? (
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 5,
                  border: `1px solid ${risk.bd}`,
                  background: risk.bg,
                  font: `700 9px/1 ${FONT}`,
                  color: risk.fg,
                }}
              >
                COD RISK
              </span>
            ) : null}
          </div>
          <p style={{ margin: '6px 0 0', font: `500 13px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
            {order.customerName}
            {' · '}
            <a href={telHref(order.customerPhone)} style={{ color: 'inherit' }}>
              {formatBdPhone(order.customerPhone)}
            </a>
          </p>
          <p style={{ margin: '4px 0 0', font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            {order.address || [order.city, order.district].filter(Boolean).join(', ')}
          </p>
          <p style={{ margin: '4px 0 0', font: `500 12px/1.4 ${MONO}`, color: 'var(--ink-2)' }}>
            {order.paymentMethod.replace(/_/g, ' ')} · {formatTaka(order.total)} · {order.itemCount} pcs
            {booked ? ` · ${order.courier?.provider} ${order.courier?.consignmentId}` : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {order.items.map((item) => {
          const on = Boolean(checked[item.id])
          const src = item.image ? resolveMediaUrl(item.image) : ''
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: compact ? 8 : 10,
                borderRadius: 10,
                border: `1px solid ${on ? 'var(--ok-bd)' : 'var(--line)'}`,
                background: on ? 'var(--ok-soft)' : 'var(--surface-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: compact ? 36 : 44,
                  height: compact ? 36 : 44,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  flex: 'none',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <DcIcon name="icon-package" size={14} />
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                  {item.quantity}× {item.name}
                </span>
                <span style={{ font: `500 11.5px/1.35 ${MONO}`, color: 'var(--ink-3)' }}>
                  {item.sku}
                  {item.barcode ? ` · BC ${item.barcode}` : ''}
                  {item.size !== '—' ? ` · ${item.size}` : ''}
                  {item.color !== '—' ? ` · ${item.color}` : ''}
                </span>
              </span>
              <DcIcon name={on ? 'icon-check' : 'icon-circle'} size={16} color={on ? 'var(--ok)' : 'var(--ink-3)'} />
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {canAct ? (
          <button type="button" disabled={busy} onClick={onPack} style={{ ...btnPrimary, height: 34, opacity: busy ? 0.6 : 1 }}>
            {mode === 'pack' ? `Pack${allChecked ? '' : ' anyway'}` : `Dispatch${allChecked ? '' : ' anyway'}`}
          </button>
        ) : (
          <span style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center' }}>Already {order.status}</span>
        )}
        <button type="button" onClick={onPrintLabel} style={btnGhost}>
          Shipping label
        </button>
        <button type="button" onClick={onPrintSticker} style={btnGhost}>
          Stickers
        </button>
        <button type="button" onClick={onPrintInvoice} style={btnGhost}>
          Invoice
        </button>
        <button type="button" disabled={busy || booked} onClick={onBookCourier} style={btnGhost}>
          {booked ? 'Courier booked' : 'Book courier'}
        </button>
        <button type="button" onClick={onOpen} style={btnGhost}>
          Open order
        </button>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        padding: '2px 6px',
        borderRadius: 5,
        border: '1px solid var(--line)',
        font: `600 10.5px/1 ${MONO}`,
        color: 'var(--ink-2)',
      }}
    >
      {children}
    </kbd>
  )
}

function PackKpi({
  icon,
  color,
  label,
  value,
}: {
  icon: string
  color: string
  label: string
  value: string
}) {
  return (
    <div style={{ ...card, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <DcIcon name={icon} size={13} color={color} />
        <span
          style={{
            flex: 1,
            font: `600 9.5px/1.2 ${FONT}`,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          {label}
        </span>
      </span>
      <span style={{ font: `700 22px/1 ${FONT}`, letterSpacing: '-.028em', color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function StationRow({ tone, label, value }: { tone: DcTone; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: toneStyle(tone).fg }} />
      <span style={{ flex: 1, font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ font: `500 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>{value}</span>
    </div>
  )
}
