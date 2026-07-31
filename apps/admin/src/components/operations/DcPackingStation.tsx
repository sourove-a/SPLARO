'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useOrders } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import {
  fetchFulfillmentTodayStats,
  scanFulfillment,
  type FulfillmentScanAction,
} from '@/lib/api/fulfillment'

const MODES: Array<{ id: FulfillmentScanAction; label: string; sub: string }> = [
  { id: 'pack', label: 'প্যাকিং', sub: 'Confirmed → Packed · one scan per parcel' },
  { id: 'dispatch', label: 'ডিসপ্যাচ', sub: 'Packed → Shipped · hand over to the rider' },
]

interface ScanRow {
  time: string
  id: string
  ok: boolean
  message: string
  by: string
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
  const [mode, setMode] = useState<FulfillmentScanAction>('pack')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<ScanRow[]>([])
  const [stats, setStats] = useState({ packed: 0, shipped: 0 })
  const [blocked, setBlocked] = useState<{ id: string; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  // The queue is the real order list filtered to the stage this mode consumes.
  const queueStatus = mode === 'pack' ? 'CONFIRMED' : 'PACKED'
  const orders = useOrders({ status: queueStatus, limit: 50 })
  const queue = useMemo(() => orders.data?.orders ?? [], [orders.data])

  const refreshStats = useCallback(() => {
    fetchFulfillmentTodayStats()
      .then(setStats)
      .catch(() => {
        /* The counters are informational — a failed poll must not block scanning. */
      })
  }, [])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  // The scanner is a keyboard wedge: the field must hold focus at all times.
  useEffect(() => {
    const focus = () => {
      const mobile = window.matchMedia('(max-width: 820px)').matches
      ;(mobile ? mobileInputRef.current : inputRef.current)?.focus()
    }
    focus()
    const timer = window.setInterval(focus, 1200)
    return () => window.clearInterval(timer)
  }, [])

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed || busy) return
      setBusy(true)
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      try {
        const result = await scanFulfillment(trimmed, mode)
        setHistory((h) => [
          { time, id: result.invoiceNumber || trimmed, ok: result.ok, message: result.message, by: 'you' },
          ...h,
        ])
        if (result.ok) {
          setBlocked(null)
          toast('ok', `${result.invoiceNumber} ${mode === 'pack' ? 'packed' : 'dispatched'}`, result.message)
        } else {
          setBlocked({ id: result.invoiceNumber || trimmed, message: result.message })
          toast('bad', 'Scan rejected', result.message)
        }
        refreshStats()
        void orders.refetch()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'POST /admin/fulfillment/scan failed'
        setHistory((h) => [{ time, id: trimmed, ok: false, message, by: 'you' }, ...h])
        setBlocked({ id: trimmed, message })
        toast('bad', 'Scan failed', message)
      } finally {
        setCode('')
        setBusy(false)
        inputRef.current?.focus()
        mobileInputRef.current?.focus()
      }
    },
    [busy, mode, refreshStats, orders, toast],
  )

  const done = mode === 'pack' ? stats.packed : stats.shipped
  const total = done + queue.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([orders], api.pulse)

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
          refreshStats()
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
            <span className="dc-mobile-kpi__sub">{queueStatus.toLowerCase()}</span>
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
            placeholder="Scan or type invoice…"
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

        <div className="dc-mobile-list">
          {queue.slice(0, 8).map((o) => (
            <div key={o.id} className="dc-mobile-list-card">
              <span className="dc-mobile-list-card__icon" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}>
                <DcIcon name="icon-package" size={15} />
              </span>
              <span className="dc-mobile-list-card__copy">
                <span className="dc-mobile-list-card__title">{o.invoiceNumber}</span>
                <span className="dc-mobile-list-card__sub">
                  {o.shippingName} · {formatTaka(Number(o.total))}
                </span>
              </span>
            </div>
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
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
                  <span
                    style={{
                      font: `600 13px/1 ${FONT}`,
                      color: on ? 'var(--violet)' : 'var(--ink)',
                    }}
                  >
                    {m.label}
                  </span>
                  <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    {m.sub}
                  </span>
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
              <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink)' }}>
                Today&rsquo;s queue
              </span>
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
              <span style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {queue.length} left
              </span>
            </div>

            <div
              style={{
                padding: '20px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    if (e.key === 'Escape') setCode('')
                  }}
                  placeholder="Scan or type an order ID…"
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
                <span>Scan the parcel barcode, or type an order ID and press Enter.</span>
                <div style={{ flex: 1 }} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Kbd>Esc</Kbd> clear
                </span>
              </div>
            </div>

            {history[0]?.ok ? (
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
                    <span style={{ font: `700 16px/1 ${MONO}`, color: 'var(--ink)' }}>
                      {history[0].id}
                    </span>
                    <span style={{ font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                      {history[0].message}
                    </span>
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
                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Time</th>
                    <th style={th}>Order</th>
                    <th style={th}>Result</th>
                    <th style={{ ...th, textAlign: 'right' }}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    const t = toneStyle(h.ok ? 'ok' : 'bad')
                    return (
                      <tr key={`${h.time}-${i}`} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '9px 15px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                          {h.time}
                        </td>
                        <td style={{ padding: '9px 15px', font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {h.id}
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
                            <span
                              style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }}
                            />
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

        <div
          style={{
            minWidth: 0,
            maxWidth: 380,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <PackKpi icon="icon-package-check" color="var(--ok)" label="Packed today" value={String(stats.packed)} />
            <PackKpi icon="icon-truck" color="var(--info)" label="Shipped today" value={String(stats.shipped)} />
            <PackKpi icon="icon-list-ordered" color="var(--violet)" label="In queue" value={String(queue.length)} />
            <PackKpi
              icon="icon-scan-line"
              color="var(--ink-2)"
              label="Scans this session"
              value={String(history.length)}
            />
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
              <span
                style={{ font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink)', textWrap: 'pretty' }}
              >
                <strong style={{ fontFamily: 'var(--mono)' }}>{blocked.id}</strong> — {blocked.message}
              </span>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/orders?search=${encodeURIComponent(blocked.id)}`)}
                  style={{
                    height: 30,
                    padding: '0 11px',
                    borderRadius: 8,
                    border: 0,
                    background: 'var(--violet-solid)',
                    color: 'var(--on-violet)',
                    cursor: 'pointer',
                    font: `600 11.5px/1 ${FONT}`,
                  }}
                >
                  Open the order
                </button>
                <button
                  type="button"
                  onClick={() => setBlocked(null)}
                  style={{
                    height: 30,
                    padding: '0 11px',
                    borderRadius: 8,
                    border: '1px solid var(--line-2)',
                    background: 'var(--surface)',
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                    font: `600 11.5px/1 ${FONT}`,
                  }}
                >
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
              <span style={{ flex: 1, font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Up next
              </span>
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
              queue.slice(0, 8).map((o, i) => {
                const risk = o.isCodRisk
                const flag = toneStyle(risk ? 'bad' : 'mute')
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setCode(o.invoiceNumber)}
                    className="dc-hover-surface"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '9px 14px',
                      border: 0,
                      borderBottom: '1px solid var(--line)',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{ width: 19, flex: 'none', font: `600 11px/1 ${MONO}`, color: 'var(--ink-3)' }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {o.invoiceNumber}
                        </span>
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
                      </span>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 4,
                      }}
                    >
                      <span style={{ font: `600 11.5px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                        {formatTaka(Number(o.total))}
                      </span>
                      <span style={{ font: `400 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                        {o.paymentMethod}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div
            style={{
              ...card,
              padding: '13px 15px',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
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
              value={orders.error ? 'failed' : `${queueStatus.toLowerCase()} orders`}
            />
          </div>
        </div>
      </div>
    </>
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
    <div
      style={{ ...card, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
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
      <span style={{ font: `700 22px/1 ${FONT}`, letterSpacing: '-.028em', color: 'var(--ink)' }}>
        {value}
      </span>
    </div>
  )
}

function StationRow({ tone, label, value }: { tone: DcTone; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span
        style={{ width: 7, height: 7, borderRadius: 99, background: toneStyle(tone).fg }}
      />
      <span style={{ flex: 1, font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ font: `500 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>{value}</span>
    </div>
  )
}
