'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  ScanLine,
  Ship,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminStatusBadge } from '@/components/ui/AdminStatusBadge'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import {
  fetchFulfillmentTodayStats,
  scanFulfillment,
  type FulfillmentScanAction,
  type FulfillmentScanResult,
} from '@/lib/api/fulfillment'
import { printOrderLabel } from '@/lib/admin/admin-actions'
import { cn } from '@/lib/utils/cn'

interface ScanLogEntry extends FulfillmentScanResult {
  at: string
  error?: string
}

interface QueuedScan {
  code: string
  action: FulfillmentScanAction
}

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]'
const FOCUSABLE_SELECTOR = `button, a, ${EDITABLE_SELECTOR}`
const LOG_LIMIT = 40

const SCAN_MODES: Array<{
  action: FulfillmentScanAction
  label: string
  hint: string
  icon: LucideIcon
}> = [
  { action: 'pack', label: 'Pack', hint: 'Mark order as packed', icon: Package },
  { action: 'dispatch', label: 'Dispatch', hint: 'Mark order as shipped', icon: Ship },
]

function scanTime(): string {
  return new Date().toLocaleTimeString('en-BD', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function isEditableElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches(EDITABLE_SELECTOR)
}

function isFocusableControl(target: EventTarget | null, scanInput: HTMLInputElement | null): boolean {
  return (
    target instanceof HTMLElement &&
    target !== document.body &&
    target !== scanInput &&
    target.matches(FOCUSABLE_SELECTOR)
  )
}

function failedScanEntry(scan: QueuedScan, message: string): ScanLogEntry {
  return {
    ok: false,
    action: scan.action,
    orderId: '',
    invoiceNumber: scan.code,
    customerName: '—',
    previousStatus: '—',
    status: '—',
    itemCount: 0,
    message,
    at: scanTime(),
    error: message,
  }
}

export function PackingStationPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<QueuedScan[]>([])
  const processingRef = useRef(false)
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<FulfillmentScanAction>('pack')
  const [busy, setBusy] = useState(false)
  const [queueDepth, setQueueDepth] = useState(0)
  const [last, setLast] = useState<ScanLogEntry | null>(null)
  const [log, setLog] = useState<ScanLogEntry[]>([])
  const [stats, setStats] = useState({ packed: 0, shipped: 0 })

  const focusInput = useCallback((force = false) => {
    if (!force && isFocusableControl(document.activeElement, inputRef.current)) return
    inputRef.current?.focus()
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      setStats(await fetchFulfillmentTodayStats())
    } catch {
      /* offline — keep previous */
    }
  }, [])

  const recordEntry = useCallback((entry: ScanLogEntry) => {
    setLast(entry)
    setLog((prev) => [entry, ...prev].slice(0, LOG_LIMIT))
  }, [])

  useEffect(() => {
    focusInput(true)
    void refreshStats()
  }, [focusInput, refreshStats])

  useEffect(() => {
    const captureScannerStart = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.length !== 1 ||
        document.activeElement === inputRef.current ||
        isEditableElement(event.target)
      ) {
        return
      }

      event.preventDefault()
      focusInput(true)
      setCode((current) => current + event.key)
    }

    window.addEventListener('keydown', captureScannerStart)
    return () => window.removeEventListener('keydown', captureScannerStart)
  }, [focusInput])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return

    processingRef.current = true
    setBusy(true)

    try {
      while (queueRef.current.length > 0) {
        const scan = queueRef.current.shift()
        setQueueDepth(queueRef.current.length)
        if (!scan) continue

        try {
          const result = await scanFulfillment(scan.code, scan.action)
          const entry: ScanLogEntry = { ...result, at: scanTime() }
          recordEntry(entry)

          if (result.previousStatus === result.status) {
            toastWarn(result.message, `scan-${result.invoiceNumber}`)
          } else {
            toastOk(result.message, `scan-${result.invoiceNumber}-${result.status}`)
          }
          void refreshStats()
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Scan failed — check code / status transition'
          recordEntry(failedScanEntry(scan, message))
          toastFail(message)
        }
      }
    } finally {
      processingRef.current = false
      setBusy(false)
      setQueueDepth(0)
      focusInput()
    }
  }, [focusInput, recordEntry, refreshStats])

  const enqueueScan = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) return

      queueRef.current.push({ code: trimmed, action: mode })
      setQueueDepth(queueRef.current.length)
      setCode('')
      void processQueue()
    },
    [mode, processQueue],
  )

  return (
    <div className="admin-ops-page packing-station admin-panel-page">
      <header className="admin-ops-header admin-catalog-hero admin-panel-hero !mb-4">
        <div className="admin-catalog-hero__top !mb-3">
          <div className="admin-catalog-hero__title-row">
            <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg">
              <Package strokeWidth={2} />
            </div>
            <div>
              <h1 className="admin-catalog-hero__title">Packing Station</h1>
              <p className="admin-ops-header__sub !mt-1">
                Scan an order label to pack or dispatch. Enter submits; Tab moves focus.
              </p>
            </div>
          </div>
          <div className="packing-station__header-actions">
            <AdminStatusBadge
              label={busy ? 'Processing scans' : 'Scanner ready'}
              tone={busy ? 'warning' : 'success'}
            />
            <AdminButton
              variant="secondary"
              onClick={() => void refreshStats()}
              aria-label="Refresh today’s packing statistics"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </AdminButton>
          </div>
        </div>
      </header>

      <div className="admin-kpi-grid packing-station__kpis admin-kpi-grid--catalog">
        {[
          { label: 'Packed today', value: stats.packed, accent: 'success' },
          { label: 'Dispatched today', value: stats.shipped, accent: 'gold' },
          { label: 'Waiting', value: queueDepth, accent: 'warning' },
          { label: 'Station', value: busy ? 'Active' : 'Ready', accent: 'success' },
        ].map(({ label, value, accent }) => (
          <div key={label} className={cn('admin-kpi-card', `admin-kpi-card--${accent}`)}>
            <p className="admin-kpi-card__label">{label}</p>
            <div className="admin-kpi-card__row">
              <p className="admin-kpi-card__value">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="packing-station__workspace">
        <section className="admin-ops-card packing-station__scanner">
          <div className="packing-station__section-head">
            <div>
              <p className="admin-type-label">Fulfillment mode</p>
              <h2 className="admin-type-h2">Choose the next scan action</h2>
            </div>
            <span className="packing-station__shortcut">USB · Code128</span>
          </div>

          <div className="packing-station__mode-switch" role="tablist" aria-label="Scan mode">
            {SCAN_MODES.map(({ action, label, hint, icon: Icon }) => (
              <button
                key={action}
                type="button"
                role="tab"
                aria-selected={mode === action}
                className={cn(
                  'packing-station__mode',
                  mode === action && 'packing-station__mode--active',
                )}
                onClick={() => {
                  setMode(action)
                  focusInput(true)
                }}
              >
                <span className="packing-station__mode-icon">
                  <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </button>
            ))}
          </div>

          <label className="packing-station__scan-field">
            <span className="admin-type-label">
              <ScanLine className="h-4 w-4" aria-hidden />
              Barcode or tracking code
            </span>
            <span className="packing-station__input-shell">
              <ScanLine className="packing-station__input-icon" aria-hidden />
              <input
                ref={inputRef}
                className="packing-station__input"
                value={code}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby="packing-scan-help"
                placeholder={mode === 'pack' ? 'Scan to mark PACKED' : 'Scan to mark SHIPPED'}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    enqueueScan(code)
                  }
                  // Tab passes through so focus can leave the scan field
                }}
              />
              <span className="packing-station__input-state">
                {busy ? `${queueDepth} waiting` : 'Ready'}
              </span>
            </span>
            <span id="packing-scan-help" className="packing-station__help">
              Accepts SPL invoice number, courier tracking code, or consignment ID.
            </span>
          </label>

          <div className="packing-station__actions">
            <AdminButton
              variant="primary"
              loading={busy}
              onClick={() => enqueueScan(code)}
              disabled={!code.trim()}
              size="lg"
            >
              <ScanLine className="h-4 w-4" aria-hidden />
              {mode === 'pack' ? 'Process as packed' : 'Process as dispatched'}
            </AdminButton>
            {last?.ok && last.orderId ? (
              <AdminButton
                variant="secondary"
                size="lg"
                onClick={() => void printOrderLabel(last.invoiceNumber || last.orderId)}
              >
                Reprint label
              </AdminButton>
            ) : null}
          </div>

          {last ? (
            <div
              className={cn(
                'packing-station__result',
                last.error
                  ? 'packing-station__result--error'
                  : last.previousStatus === last.status
                    ? 'packing-station__result--warn'
                    : 'packing-station__result--success',
              )}
              role="status"
            >
              <span className="packing-station__result-icon">
                {last.error ? (
                  <XCircle aria-hidden />
                ) : last.previousStatus === last.status ? (
                  <AlertTriangle aria-hidden />
                ) : (
                  <CheckCircle2 aria-hidden />
                )}
              </span>
              <div>
                <p className="admin-type-label">Last scan · {last.at}</p>
                <h3>{last.invoiceNumber}</h3>
                <p>{last.customerName}</p>
                <strong>
                  {last.error
                    ? last.error
                    : last.previousStatus === last.status
                      ? last.message
                      : `${last.previousStatus} → ${last.status} · ${last.itemCount} unit(s)`}
                </strong>
              </div>
            </div>
          ) : (
            <div className="packing-station__idle">
              <span><ScanLine aria-hidden /></span>
              <div>
                <strong>Waiting for the first scan</strong>
                <p>Point the scanner at the Code128 barcode on a shipping label.</p>
              </div>
            </div>
          )}
        </section>

        <section className="admin-ops-card packing-station__history">
          <div className="packing-station__section-head">
            <div>
              <p className="admin-type-label">Session activity</p>
              <h2 className="admin-type-h2">Recent scans</h2>
            </div>
            <span className="packing-station__history-count">{log.length}</span>
          </div>
          <ul className="packing-station__history-list" aria-label="Recent barcode scans">
            {log.length === 0 ? (
              <li className="admin-empty-state">
                <span className="admin-empty-state__icon"><Clock3 aria-hidden /></span>
                <p className="admin-empty-state__title">No scans yet</p>
                <p className="admin-empty-state__text">Completed and failed scans will appear here.</p>
              </li>
            ) : (
              log.map((row, i) => (
                <li
                  key={`${row.invoiceNumber}-${row.at}-${i}`}
                  className={cn(
                    'packing-station__history-row',
                    row.error && 'packing-station__history-row--error',
                  )}
                >
                  <span className="packing-station__history-icon">
                    {row.error ? <XCircle aria-hidden /> : <CheckCircle2 aria-hidden />}
                  </span>
                  <div className="packing-station__history-copy">
                    <div>
                      <strong>{row.invoiceNumber}</strong>
                      <time>{row.at}</time>
                    </div>
                    <p>
                      {row.error ?? `${row.action.toUpperCase()} · ${row.previousStatus} → ${row.status}`}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
