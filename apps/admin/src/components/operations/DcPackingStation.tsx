'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { printBulkOrderLabels, printInvoice, printOrderLabel, printOrderSticker } from '@/lib/admin/admin-actions'
import { toastCourierResult, toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { useBookCourier, useFulfillmentTodayStats, useOrders } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import type { CourierProvider } from '@/lib/api/orders'
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
  { id: 'pack', label: 'Pack', sub: 'Confirmed / Processing → Packed · 1-scan pack' },
  { id: 'dispatch', label: 'Dispatch', sub: 'Packed → Shipped · label + courier handoff' },
]

const PACK_QUEUE = 'CONFIRMED,PROCESSING,COURIER_BOOKED'
const HISTORY_KEY = 'splaro.packing.session-history'
const AUDIO_MUTE_KEY = 'splaro.packing.audio-muted'
const GOAL_KEY = 'splaro.packing.daily-goal'
const SESSION_START_KEY = 'splaro.packing.session-started'
const DIAG_OPEN_KEY = 'splaro.packing.diagnostics-open'
const DEFAULT_GOAL = 50

function formatSessionElapsed(startedAt: number, now: number) {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

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

const shortcutChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  font: `600 11.5px/1 ${FONT}`,
  color: 'var(--ink-2)',
}

const th = {
  textAlign: 'left' as const,
  padding: '8px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
}

function playStationSound(type: 'success' | 'item' | 'error', muted: boolean) {
  if (muted || typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (type === 'item') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(659.25, now) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.05) // G5
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.12)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, now)
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.start(now)
      osc.stop(now + 0.3)
    }
  } catch {
    /* ignore audio error */
  }
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
  const [soundMuted, setSoundMuted] = useState(false)
  const [scanFlash, setScanFlash] = useState<'ok' | 'bad' | null>(null)
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL)
  const [diagOpen, setDiagOpen] = useState(false)
  const [hoverQueueId, setHoverQueueId] = useState<string | null>(null)
  const [sessionNow, setSessionNow] = useState(() => Date.now())
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)

  // Modals
  const [courierModalOpen, setCourierModalOpen] = useState(false)
  const [selectedCourierProvider, setSelectedCourierProvider] = useState<CourierProvider>('STEADFAST')

  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const flashTimerRef = useRef<number | undefined>(undefined)

  const flashScan = useCallback((kind: 'ok' | 'bad') => {
    setScanFlash(kind)
    window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => setScanFlash(null), 700)
  }, [])

  const queueStatus = mode === 'pack' ? PACK_QUEUE : 'PACKED'
  const orders = useOrders({ status: queueStatus, limit: 50 })
  const queue = useMemo(() => orders.data?.orders ?? [], [orders.data])
  const todayStats = useFulfillmentTodayStats()
  const stats = todayStats.data ?? { packed: 0, shipped: 0 }

  useEffect(() => {
    setHistory(readHistory())
    const muted = localStorage.getItem(AUDIO_MUTE_KEY) === 'true'
    setSoundMuted(muted)
    const storedGoal = Number(localStorage.getItem(GOAL_KEY))
    if (Number.isFinite(storedGoal) && storedGoal > 0) setDailyGoal(Math.round(storedGoal))
    setDiagOpen(localStorage.getItem(DIAG_OPEN_KEY) === 'true')
    let started = Number(sessionStorage.getItem(SESSION_START_KEY))
    if (!Number.isFinite(started) || started <= 0) {
      started = Date.now()
      sessionStorage.setItem(SESSION_START_KEY, String(started))
    }
    setSessionStartedAt(started)
    return () => window.clearTimeout(flashTimerRef.current)
  }, [])

  useEffect(() => {
    const tick = window.setInterval(() => setSessionNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    writeHistory(history)
  }, [history])

  const toggleSound = () => {
    const next = !soundMuted
    setSoundMuted(next)
    localStorage.setItem(AUDIO_MUTE_KEY, String(next))
    if (!next) playStationSound('success', false)
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault()
        setMode((m) => (m === 'pack' ? 'dispatch' : 'pack'))
      } else if (e.key === 'F2') {
        if (active) {
          e.preventDefault()
          void printOrderLabel(active.invoiceNumber)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active])

  // Focus lock
  useEffect(() => {
    const focus = () => {
      const mobile = window.matchMedia('(max-width: 820px)').matches
      ;(mobile ? mobileInputRef.current : inputRef.current)?.focus()
    }
    focus()
    const timer = window.setInterval(focus, 1800)
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
        playStationSound('item', soundMuted)
        flashScan('ok')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lookup failed'
        setBlocked({ id: trimmed, message })
        playStationSound('error', soundMuted)
        flashScan('bad')
        toast('bad', 'Not found', message)
      } finally {
        setBusy(false)
        inputRef.current?.focus()
        mobileInputRef.current?.focus()
      }
    },
    [busy, flashScan, soundMuted, toast],
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
          playStationSound(allDone ? 'success' : 'item', soundMuted)
          flashScan('ok')
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
          playStationSound('success', soundMuted)
          flashScan('ok')
          toast('ok', `${result.invoiceNumber} ${mode === 'pack' ? 'packed' : 'dispatched'}`, result.message)
          if (autoPrint && mode === 'pack' && result.previousStatus !== result.status) {
            void printOrderLabel(result.invoiceNumber)
          }
        } else {
          setBlocked({ id: result.invoiceNumber || trimmed, message: result.message })
          playStationSound('error', soundMuted)
          flashScan('bad')
          toast('bad', 'Scan rejected', result.message)
        }
        void todayStats.refetch()
        void orders.refetch()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'POST /admin/fulfillment/scan failed'
        pushHistory({ time, id: trimmed, ok: false, message, by: 'you' })
        setBlocked({ id: trimmed, message })
        playStationSound('error', soundMuted)
        flashScan('bad')
        toast('bad', 'Scan failed', message)
      } finally {
        setCode('')
        setBusy(false)
        inputRef.current?.focus()
        mobileInputRef.current?.focus()
      }
    },
    [active, autoPrint, busy, checked, flashScan, mode, orders, pushHistory, soundMuted, todayStats, toast],
  )

  const handleBookCourier = async () => {
    if (!active) return
    try {
      const res = await bookCourier.mutateAsync({ id: active.invoiceNumber, provider: selectedCourierProvider })
      toastCourierResult(res, active.invoiceNumber)
      setCourierModalOpen(false)
      const refreshed = await lookupFulfillment(active.invoiceNumber)
      setActive(refreshed)
      void orders.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Courier booking failed')
    }
  }

  const handleBulkPrintLabels = async () => {
    if (queue.length === 0) {
      toastWarn('Queue is empty')
      return
    }
    const ids = queue.slice(0, 30).map((o) => o.invoiceNumber)
    await printBulkOrderLabels(ids)
  }

  const clearHistory = () => {
    setHistory([])
    sessionStorage.removeItem(HISTORY_KEY)
    toastOk('Scan history cleared')
  }

  const exportHistoryCsv = () => {
    if (history.length === 0) {
      toastWarn('No history to export')
      return
    }
    const lines = ['Time,Identifier,Status,Message,By,ItemCount']
    for (const h of history) {
      lines.push(`"${h.time}","${h.id}","${h.ok ? 'SUCCESS' : 'FAILED'}","${h.message.replace(/"/g, '""')}","${h.by}","${h.itemCount ?? ''}"`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `splaro-packing-session-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toastOk('Session history CSV exported')
  }

  const allChecked =
    Boolean(active?.items.length) && active!.items.every((item) => checked[item.id])
  const done = mode === 'pack' ? stats.packed : stats.shipped
  const total = done + queue.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const goalSafe = Math.max(1, dailyGoal)
  const goalCount = mode === 'pack' ? stats.packed : stats.shipped
  const goalPct = Math.min(100, Math.round((goalCount / goalSafe) * 100))
  const sessionLabel = sessionStartedAt
    ? `Session ${formatSessionElapsed(sessionStartedAt, sessionNow)}`
    : 'Session --:--:--'
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([orders], api.pulse)
  const canActOnActive =
    active &&
    (mode === 'pack'
      ? ['CONFIRMED', 'PROCESSING', 'COURIER_BOOKED', 'PENDING'].includes(active.status)
      : active.status === 'PACKED')

  const persistGoal = (value: number) => {
    const next = Math.max(1, Math.min(9999, Math.round(value) || DEFAULT_GOAL))
    setDailyGoal(next)
    localStorage.setItem(GOAL_KEY, String(next))
  }

  const toggleDiag = () => {
    const next = !diagOpen
    setDiagOpen(next)
    localStorage.setItem(DIAG_OPEN_KEY, String(next))
  }

  const endSession = () => {
    sessionStorage.removeItem(SESSION_START_KEY)
    router.push('/dashboard/operations')
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Operations · Packing Station"
        title="Packing Station"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={`${sessionLabel} · ${queue.length} in queue`}
        syncing={orders.isFetching}
        onSync={() => {
          void orders.refetch()
          void todayStats.refetch()
        }}
        actions={[
          {
            label: 'Bulk Labels',
            icon: 'icon-printer',
            onClick: handleBulkPrintLabels,
          },
          {
            label: 'End session',
            icon: 'icon-log-out',
            onClick: endSession,
          },
        ]}
      />

      {/* ── MOBILE PACKING VIEW ──────────────────────────────── */}
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
              {done}/{total || 0} · goal {goalPct}%
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
            onToggle={(id) => {
              setChecked((c) => {
                const next = { ...c, [id]: !c[id] }
                playStationSound('item', soundMuted)
                return next
              })
            }}
            allChecked={allChecked}
            canAct={Boolean(canActOnActive)}
            busy={busy || bookCourier.isPending}
            onPack={() => void submit(active.invoiceNumber)}
            onPrintLabel={() => void printOrderLabel(active.invoiceNumber)}
            onPrintSticker={() => void printOrderSticker(active.invoiceNumber)}
            onPrintInvoice={() => void printInvoice(active.invoiceNumber)}
            onBookCourier={() => setCourierModalOpen(true)}
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

      {/* ── DESKTOP PACKING STATION VIEW ────────────────────── */}
      <div className="dc-desktop-route-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }} className="dc-pack-kpi-row">
          <PackKpi icon="icon-package-check" color="var(--ok)" label="Packed today" value={String(stats.packed)} />
          <PackKpi icon="icon-truck" color="var(--info)" label="Shipped today" value={String(stats.shipped)} />
          <PackKpi icon="icon-list-ordered" color="var(--violet)" label="In queue" value={String(queue.length)} />
          <PackKpi icon="icon-scan-line" color="var(--ink-2)" label="Scans session" value={String(history.length)} />
        </div>

        <div style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink)' }}>Today&rsquo;s fulfillment</span>
            <span style={{ font: `700 18px/1 ${MONO}`, color: 'var(--ok)' }}>{pct}%</span>
            <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
              {done} / {total || 0}
            </span>
            <span style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>{queue.length} in queue</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <DcIcon name="icon-target" size={13} color="var(--violet)" />
              <span style={{ font: `600 10.5px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                Daily goal
              </span>
              <input
                type="number"
                min={1}
                max={9999}
                value={dailyGoal}
                onChange={(e) => persistGoal(Number(e.target.value))}
                aria-label="Daily packing goal"
                style={{
                  width: 64,
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 7,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  font: `600 12.5px/1 ${MONO}`,
                }}
              />
              <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>{goalPct}%</span>
            </span>
          </div>
          <span style={{ display: 'block', height: 10, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${goalPct}%`, height: '100%', borderRadius: 99, background: 'var(--ok)', transition: 'width 320ms ease' }} />
          </span>
          <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            {goalCount} of {goalSafe} {mode === 'pack' ? 'packed' : 'shipped'} toward today&rsquo;s goal
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {MODES.map((m) => {
            const on = m.id === mode
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
                  background: on ? 'var(--violet-soft)' : 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `700 14px/1 ${FONT}`, color: on ? 'var(--violet)' : 'var(--ink)' }}>{m.label}</span>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: on ? 'var(--violet)' : 'var(--line-2)' }} />
                </div>
                <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: on ? 'var(--ink-2)' : 'var(--ink-3)' }}>{m.sub}</span>
              </button>
            )
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: diagOpen
              ? 'minmax(0, 560px) minmax(280px, 1fr) 260px'
              : 'minmax(0, 560px) minmax(300px, 1fr) 48px',
            gap: 14,
            alignItems: 'start',
          }}
        >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Scanner Input Station Card */}
          <div
            data-scan-flash={scanFlash ?? undefined}
            style={{
              position: 'relative',
              border: `1px solid ${scanFlash === 'bad' ? 'var(--bad-bd)' : scanFlash === 'ok' ? 'var(--ok-bd)' : 'var(--violet-bd)'}`,
              borderRadius: 14,
              background: 'var(--surface)',
              overflow: 'hidden',
              boxShadow: scanFlash === 'ok'
                ? '0 0 0 3px var(--ok-soft)'
                : scanFlash === 'bad'
                  ? '0 0 0 3px var(--bad-soft)'
                  : undefined,
              transition: 'border-color 180ms ease, box-shadow 180ms ease',
            }}
          >
            {scanFlash ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 14,
                  zIndex: 2,
                  display: 'grid',
                  placeItems: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 99,
                  background: scanFlash === 'ok' ? 'var(--ok)' : 'var(--bad)',
                  color: 'var(--surface)',
                  animation: 'dc-pack-flash-pop 700ms ease',
                }}
              >
                <DcIcon name={scanFlash === 'ok' ? 'icon-check' : 'icon-x'} size={18} />
              </span>
            ) : null}

            <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: busy ? 'var(--warn)' : 'var(--ok)',
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
                  {busy ? 'Processing…' : 'Scanner ready'}
                </span>
                <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  USB HID · Keyboard wedge · Focus locked
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={toggleSound}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: `1px solid ${soundMuted ? 'var(--line)' : 'var(--ok-bd)'}`,
                      background: soundMuted ? 'var(--surface-2)' : 'var(--ok-soft)',
                      color: soundMuted ? 'var(--ink-3)' : 'var(--ok)',
                      cursor: 'pointer',
                      font: `600 11.5px/1 ${FONT}`,
                    }}
                  >
                    <DcIcon name={soundMuted ? 'icon-volume-x' : 'icon-volume-2'} size={13} />
                    {soundMuted ? 'Muted' : 'Audio On'}
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
                    Auto-print label on pack
                  </label>
                </div>
              </div>

              {/* Main Scanner Input Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  height: 52,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '2px solid var(--violet)',
                  background: 'var(--surface-2)',
                  maxWidth: 520,
                }}
              >
                <DcIcon name="icon-scan-line" size={18} color="var(--violet)" />
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
                    font: `600 16px/1 ${MONO}`,
                    color: 'var(--ink)',
                    letterSpacing: '.02em',
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !code.trim()}
                  onClick={() => void loadPreview(code)}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    cursor: busy || !code.trim() ? 'not-allowed' : 'pointer',
                    font: `600 12.5px/1 ${FONT}`,
                  }}
                >
                  Preview
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                  Scan invoice to preview ➔ scan item barcodes to tick pick list ➔ scan invoice again to {mode === 'pack' ? 'Pack' : 'Dispatch'}.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...shortcutChip }}>
                    <Kbd>F4</Kbd> Mode
                  </span>
                  <span style={{ ...shortcutChip }}>
                    <Kbd>F2</Kbd> Label
                  </span>
                  <span style={{ ...shortcutChip }}>
                    <Kbd>Esc</Kbd> Clear
                  </span>
                </div>
              </div>
            </div>

            {/* Active Order Card View */}
            {active ? (
              <div style={{ borderTop: '1px solid var(--line)', padding: 18 }}>
                <ActiveOrderCard
                  order={active}
                  mode={mode}
                  checked={checked}
                  onToggle={(id) => {
                    setChecked((c) => {
                      const next = { ...c, [id]: !c[id] }
                      playStationSound('item', soundMuted)
                      return next
                    })
                  }}
                  allChecked={allChecked}
                  canAct={Boolean(canActOnActive)}
                  busy={busy || bookCourier.isPending}
                  onPack={() => void submit(active.invoiceNumber)}
                  onPrintLabel={() => void printOrderLabel(active.invoiceNumber)}
                  onPrintSticker={() => void printOrderSticker(active.invoiceNumber)}
                  onPrintInvoice={() => void printInvoice(active.invoiceNumber)}
                  onBookCourier={() => setCourierModalOpen(true)}
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
                    color: 'var(--surface)',
                  }}
                >
                  <DcIcon name="icon-check" size={19} />
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ font: `700 16px/1 ${MONO}`, color: 'var(--ink)' }}>{history[0].id}</span>
                    <span style={{ font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>{history[0].message}</span>
                  </div>
                  <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    Handled at {history[0].time} · ready for next scan
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Session History Table */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>Scanned this session</span>
                <span style={{ font: `600 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>({history.length})</span>
              </div>
              {history.length > 0 ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={exportHistoryCsv}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                      padding: '3px 8px',
                      font: `600 11px/1 ${FONT}`,
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                      padding: '3px 8px',
                      font: `600 11px/1 ${FONT}`,
                      color: 'var(--ink-3)',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
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
                Nothing scanned in this session yet. The first parcel appears here instantly.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Time</th>
                      <th style={th}>Order / SKU</th>
                      <th style={th}>Items</th>
                      <th style={th}>Result</th>
                      <th style={{ ...th, textAlign: 'right' }}>Handler</th>
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
                                color: 'var(--violet)',
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

        {/* ── QUEUE ─────────────────────────────────────────── */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {blocked ? (
            <div
              style={{
                border: '1px solid var(--bad-bd)',
                borderRadius: 14,
                background: 'var(--bad-soft)',
                padding: '14px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DcIcon name="icon-triangle-alert" size={14} color="var(--bad)" />
                <span
                  style={{
                    flex: 1,
                    font: `700 10.5px/1 ${FONT}`,
                    letterSpacing: '.09em',
                    textTransform: 'uppercase',
                    color: 'var(--bad)',
                  }}
                >
                  Scan Blocked · Action required
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
                  Open Order
                </button>
                <button type="button" onClick={() => setBlocked(null)} style={btnGhost}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ ...card, overflow: 'visible' }}>
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>Up next in queue</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  font: `600 10.5px/1 ${MONO}`,
                  color: 'var(--ink-3)',
                }}
              >
                {queue.length} waiting
              </span>
            </div>
            {queue.length === 0 ? (
              <div
                style={{
                  padding: '30px 14px',
                  textAlign: 'center',
                  font: `400 12px/1.5 ${FONT}`,
                  color: 'var(--ink-3)',
                }}
              >
                Queue is clear. Nothing waiting to be {mode === 'pack' ? 'packed' : 'dispatched'}.
              </div>
            ) : (
              queue.slice(0, 15).map((o, i) => {
                const risk = o.isCodRisk
                const flag = toneStyle(risk ? 'bad' : 'mute')
                const pcs = o.items?.reduce((n, item) => n + item.quantity, 0) ?? 0
                const isSelected = active?.invoiceNumber === o.invoiceNumber
                return (
                  <div
                    key={o.id}
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setHoverQueueId(o.id)}
                    onMouseLeave={() => setHoverQueueId(null)}
                  >
                    <button
                      type="button"
                      onClick={() => void loadPreview(o.invoiceNumber)}
                      className="dc-hover-surface"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '10px 14px',
                        border: 0,
                        borderBottom: '1px solid var(--line)',
                        background: isSelected ? 'var(--violet-soft)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ width: 18, flex: 'none', font: `600 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ font: `600 12px/1 ${MONO}`, color: isSelected ? 'var(--violet)' : 'var(--ink)' }}>
                            {o.invoiceNumber}
                          </span>
                          {risk ? (
                            <span
                              style={{
                                padding: '2px 5px',
                                borderRadius: 4,
                                border: `1px solid ${flag.bd}`,
                                background: flag.bg,
                                font: `700 9px/1 ${FONT}`,
                                letterSpacing: '.06em',
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
                          {o.shippingName} · {o.shippingCity || 'City'}
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
                    {hoverQueueId === o.id ? (
                      <QueuePeek
                        invoice={o.invoiceNumber}
                        customer={o.shippingName}
                        city={o.shippingCity}
                        pcs={pcs}
                        total={Number(o.total)}
                        status={o.status}
                      />
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {diagOpen ? (
          <div style={{ ...card, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span
                style={{
                  font: `600 10.5px/1 ${FONT}`,
                  letterSpacing: '.09em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Station Diagnostics
              </span>
              <button
                type="button"
                onClick={toggleDiag}
                title="Collapse diagnostics"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                }}
              >
                <DcIcon name="icon-chevron-right" size={13} />
              </button>
            </div>
            <StationRow tone="ok" label="Scanner Input" value="Focus Locked" />
            <StationRow tone={busy ? 'warn' : 'ok'} label="Scan Endpoint" value="/admin/fulfillment/scan" />
            <StationRow
              tone={orders.error ? 'bad' : 'ok'}
              label="Queue Feed"
              value={orders.error ? 'Failed' : mode === 'pack' ? 'Confirmed / Processing' : 'Packed'}
            />
            <StationRow tone={autoPrint ? 'ok' : 'mute'} label="Auto Label" value={autoPrint ? 'On Pack' : 'Off'} />
            <StationRow tone={soundMuted ? 'mute' : 'ok'} label="Audio Feedback" value={soundMuted ? 'Muted' : 'Active'} />
            <StationRow tone="info" label="Session" value={sessionLabel.replace('Session ', '')} />
          </div>
        ) : (
          <div
            style={{
              ...card,
              padding: '8px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={toggleDiag}
              title="Open diagnostics"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 32,
                height: 32,
                border: 0,
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              <DcIcon name="icon-panel-right" size={16} />
            </button>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: busy ? 'var(--warn)' : 'var(--ok)' }} title="Scanner" />
            <span style={{ width: 8, height: 8, borderRadius: 99, background: orders.error ? 'var(--bad)' : 'var(--ok)' }} title="Queue feed" />
            <span style={{ width: 8, height: 8, borderRadius: 99, background: soundMuted ? 'var(--ink-3)' : 'var(--ok)' }} title="Audio" />
            <span style={{ width: 8, height: 8, borderRadius: 99, background: autoPrint ? 'var(--ok)' : 'var(--ink-3)' }} title="Auto-print" />
          </div>
        )}
        </div>
      </div>

      <style>{`
        @keyframes dc-pack-flash-pop {
          0% { transform: scale(0.6); opacity: 0; }
          35% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 1100px) {
          .dc-pack-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (hover: none) {
          .dc-pack-queue-peek { display: none !important; }
        }
      `}</style>


      {/* ── COURIER BOOKING MODAL ────────────────────────────── */}
      <DcModal
        open={courierModalOpen}
        title={`Book Courier for ${active?.invoiceNumber ?? ''}`}
        subtitle="Select courier provider to dispatch this parcel"
        confirmLabel="Book Courier"
        busy={bookCourier.isPending}
        onClose={() => setCourierModalOpen(false)}
        onConfirm={() => void handleBookCourier()}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Courier Provider</span>
          <select
            value={selectedCourierProvider}
            onChange={(e) => setSelectedCourierProvider(e.target.value as CourierProvider)}
            style={{
              minHeight: 36,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `400 12px/1.4 ${FONT}`,
            }}
          >
            <option value="STEADFAST">Steadfast Courier (Recommended)</option>
            <option value="PATHAO">Pathao Courier</option>
            <option value="REDX">REDX</option>
            <option value="PAPERFLY">Paperfly</option>
          </select>
        </label>
      </DcModal>
    </>
  )
}

const btnPrimary: CSSProperties = {
  height: 32,
  padding: '0 12px',
  borderRadius: 8,
  border: 0,
  background: 'var(--violet-solid)',
  color: 'var(--on-violet)',
  cursor: 'pointer',
  font: `600 11.5px/1 ${FONT}`,
}

const btnGhost: CSSProperties = {
  height: 32,
  padding: '0 12px',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ font: `700 19px/1 ${MONO}`, color: 'var(--ink)' }}>{order.invoiceNumber}</span>
            <span style={{ font: `600 11.5px/1 ${FONT}`, color: 'var(--violet)', background: 'var(--violet-soft)', padding: '2px 7px', borderRadius: 5 }}>
              {order.status}
            </span>
            {order.isCodRisk ? (
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 5,
                  border: `1px solid ${risk.bd}`,
                  background: risk.bg,
                  font: `700 9.5px/1 ${FONT}`,
                  letterSpacing: '.07em',
                  color: risk.fg,
                }}
              >
                COD RISK
              </span>
            ) : null}
          </div>
          <p style={{ margin: '7px 0 0', font: `500 13px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
            <strong>{order.customerName}</strong>
            {' · '}
            <a href={telHref(order.customerPhone)} style={{ color: 'inherit' }}>
              {formatBdPhone(order.customerPhone)}
            </a>
          </p>
          <p style={{ margin: '4px 0 0', font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            {order.address || [order.city, order.district].filter(Boolean).join(', ')}
          </p>
          <p style={{ margin: '5px 0 0', font: `500 12px/1.4 ${MONO}`, color: 'var(--ink-2)' }}>
            {order.paymentMethod.replace(/_/g, ' ')} · {formatTaka(order.total)} · {order.itemCount} pcs
            {booked ? ` · ${order.courier?.provider} ${order.courier?.consignmentId}` : ''}
          </p>
        </div>
      </div>

      {/* Pick List Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            Pick List Items ({order.items.filter((i) => checked[i.id]).length}/{order.items.length})
          </span>
          {allChecked ? (
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ok)' }}>All Items Verified</span>
          ) : null}
        </div>
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
                gap: 12,
                width: '100%',
                padding: compact ? 9 : 11,
                borderRadius: 10,
                border: `1px solid ${on ? 'var(--ok-bd)' : 'var(--line)'}`,
                background: on ? 'var(--ok-soft)' : 'var(--surface-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: compact ? 38 : 46,
                  height: compact ? 38 : 46,
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
                  <DcIcon name="icon-package" size={16} />
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                  {item.quantity}× {item.name}
                </span>
                <span style={{ font: `500 11.5px/1.35 ${MONO}`, color: 'var(--ink-3)' }}>
                  {item.productCode ? `Code: ${item.productCode} · ` : ''}
                  SKU: {item.sku}
                  {item.barcode ? ` · BC: ${item.barcode}` : ''}
                  {item.size !== '—' ? ` · ${item.size}` : ''}
                  {item.color !== '—' ? ` · ${item.color}` : ''}
                </span>
              </span>
              <DcIcon name={on ? 'icon-check' : 'icon-circle'} size={18} color={on ? 'var(--ok)' : 'var(--ink-3)'} />
            </button>
          )
        })}
      </div>

      {/* Primary Actions Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {canAct ? (
          <button
            type="button"
            disabled={busy}
            onClick={onPack}
            style={{
              ...btnPrimary,
              height: 36,
              padding: '0 16px',
              fontSize: '12.5px',
              background: allChecked ? 'var(--ok)' : 'var(--violet-solid)',
            }}
          >
            {mode === 'pack' ? `Pack Order${allChecked ? ' (Verified)' : ' anyway'}` : `Dispatch${allChecked ? ' (Verified)' : ' anyway'}`}
          </button>
        ) : (
          <span style={{ ...btnGhost, height: 36, display: 'inline-flex', alignItems: 'center' }}>
            Status: {order.status}
          </span>
        )}
        <button type="button" onClick={onPrintLabel} style={{ ...btnGhost, height: 36 }}>
          Shipping Label
        </button>
        <button type="button" onClick={onPrintSticker} style={{ ...btnGhost, height: 36 }}>
          Stickers
        </button>
        <button type="button" onClick={onPrintInvoice} style={{ ...btnGhost, height: 36 }}>
          Invoice
        </button>
        <button type="button" disabled={busy || booked} onClick={onBookCourier} style={{ ...btnGhost, height: 36 }}>
          {booked ? 'Courier Booked' : 'Book Courier'}
        </button>
        <button type="button" onClick={onOpen} style={{ ...btnGhost, height: 36 }}>
          Open Order ↗
        </button>
      </div>
    </div>
  )
}

function QueuePeek({
  invoice,
  customer,
  city,
  pcs,
  total,
  status,
}: {
  invoice: string
  customer: string
  city?: string | null
  pcs: number
  total: number
  status: string
}) {
  return (
    <div
      className="dc-pack-queue-peek"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        top: '100%',
        zIndex: 8,
        marginTop: 6,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        backgroundImage: 'var(--card-sheen)',
        boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        pointerEvents: 'none',
      }}
    >
      <span style={{ font: `700 12px/1 ${MONO}`, color: 'var(--violet)' }}>{invoice}</span>
      <span style={{ font: `600 12px/1.35 ${FONT}`, color: 'var(--ink)' }}>{customer || 'Customer'}</span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
        {city || '—'} · {pcs} pcs · {formatTaka(total)}
      </span>
      <span style={{ font: `600 10.5px/1 ${FONT}`, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        {status}
      </span>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        padding: '3px 7px',
        borderRadius: 5,
        border: '1px solid var(--line)',
        font: `600 11px/1 ${MONO}`,
        color: 'var(--ink-2)',
        background: 'var(--surface-3)',
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
    <div style={{ ...card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
