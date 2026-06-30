'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Bot, CheckCircle2, Globe, LineChart, Play, RefreshCw, Send, Settings, WifiOff } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { AIProductAgentPanel } from '@/components/finance/AIProductAgentPanel'
import { useAutomationRules, useExecutiveDashboard, useProducts, useSeoOverview, useTelegramLogs } from '@/lib/api/hooks'
import { useTelegramIntegration, useTestTelegramIntegration } from '@/lib/api/integration-hooks'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { ApiOfflineHint, StorefrontLiveBar } from '@/components/modules/PlatformUi'
import { fetchSheetsDashboard, syncAllSheets, syncSheet, type SheetsDashboardData } from '@/lib/api/finance'
import { formatRelativeTime } from '@/lib/api/orders'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

// ─── Design tokens ───────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.4)' }

function StatusPill({ value }: { value: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    active:    { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
    success:   { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
    completed: { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
    paused:    { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
    pending:   { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
    failed:    { bg: 'rgba(239,68,68,0.10)',   text: '#B91C1C', border: 'rgba(239,68,68,0.30)' },
  }
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = map[value.toLowerCase()] ?? fallback
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{value}</span>
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px' }}>
      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function ErrorBanner({ msg, onRetry }: { msg?: string; onRetry?: () => void }) {
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '14px 16px', borderLeft: '3px solid #EF4444' }}>
      <p style={{ color: '#B91C1C', fontSize: 13, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <WifiOff style={{ width: 16, height: 16, flexShrink: 0 }} />
        {msg ?? 'API offline — run pnpm dev:stack (web :3000, admin :3001, api :4000)'}
      </p>
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="settings-card admin-panel-glass-subtle" style={{ padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Retry
          </button>
        ) : null}
        <AdminNavLink href="/dashboard/api-health" className="automation-error-link">
          API Health →
        </AdminNavLink>
        <AdminNavLink href="/dashboard/telegram-bot" className="automation-error-link">
          Telegram Bot setup →
        </AdminNavLink>
      </div>
    </div>
  )
}

function GlassTable({ icon: Icon, title, children, footer }: { icon: React.ElementType; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 13, height: 13, color: GOLD }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', flex: 1, margin: 0 }}>{title}</p>
        {footer}
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
}

// ─── Panels ───────────────────────────────────────────────────────────────────
export function TelegramNotificationsPanelLive() {
  const { data: tgIntegration, isLoading: tgLoading, isError: tgIntError, refetch: refetchTg } = useTelegramIntegration()
  const testTelegram = useTestTelegramIntegration()
  const { data: tgLogs, isError: logsError, isLoading: logsLoading, refetch: refetchLogs } = useTelegramLogs()
  const { data: rules = [], isError: rulesError, refetch: refetchRules } = useAutomationRules()
  const [query, setQuery] = useState('')

  const telegramRules = rules.filter((r) => r.trigger.toLowerCase().includes('telegram') || r.name.toLowerCase().includes('telegram'))
  const rows = telegramRules.length > 0 ? telegramRules : rules.slice(0, 8)
  const filtered = useMemo(() => rows.filter((r) => !query || r.name.toLowerCase().includes(query.toLowerCase())), [query, rows])

  const apiFullyDown = tgIntError && logsError
  const tgConnected = Boolean(tgIntegration?.isEnabled && tgIntegration?.tokenConfigured && tgIntegration?.chatId)
  const logs = tgLogs?.logs ?? []

  const refreshAll = () => {
    void refetchTg()
    void refetchLogs()
    void refetchRules()
  }

  if (apiFullyDown && !tgLoading && !logsLoading) {
    return <ErrorBanner msg="Telegram API offline — start full stack with pnpm dev:stack" onRetry={refreshAll} />
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(tgIntError || logsError) && !apiFullyDown ? (
        <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #F59E0B', color: '#B45309', fontSize: 13, fontWeight: 700 }}>
          <AlertTriangle style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Partial API issue — some data may be stale. Run <code style={{ fontSize: 12 }}>pnpm dev:stack</code> if backend is down.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Bot status" value={tgLoading ? '…' : tgConnected ? 'Connected' : 'Not set up'} />
        <KpiCard label="Telegram logs" value={logsLoading ? '…' : logs.length} />
        <KpiCard label="Automation rules" value={rulesError ? '—' : rows.length} />
        <KpiCard label="Active rules" value={rulesError ? '—' : rows.filter((r) => r.isActive).length} />
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot style={{ width: 20, height: 20, color: GOLD }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>Telegram Business Notifications</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>
              Orders · customers · courier · payments → your Telegram chat
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <AdminNavLink href="/dashboard/telegram-bot">
              <AdminButton variant="ghost"><Settings style={{ width: 14, height: 14 }} /> Configure bot</AdminButton>
            </AdminNavLink>
            <AdminButton
              variant="gold"
              loading={testTelegram.isPending}
              onClick={() => testTelegram.mutate(undefined, {
                onSuccess: () => toastOk('Test message sent to Telegram.'),
                onError: (e) => toastFail(e instanceof Error ? e.message : 'Test failed — check bot token & chat ID.'),
              })}
            >
              <Send style={{ width: 14, height: 14 }} /> Send test
            </AdminButton>
            <AdminButton onClick={refreshAll}><RefreshCw style={{ width: 14, height: 14 }} /> Refresh</AdminButton>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {[
            ['Orders', tgIntegration?.notifyOrders ?? true],
            ['Customers', tgIntegration?.notifyCustomers ?? true],
            ['Payments', tgIntegration?.notifyPayments ?? true],
            ['Courier', tgIntegration?.notifyCourier ?? true],
            ['Stock', tgIntegration?.notifyStock ?? true],
            ['Daily report', tgIntegration?.reportDaily ?? true],
          ].map(([label, on]) => (
            <div key={String(label)} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-text-secondary)' }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: on ? '#15803D' : 'var(--admin-text-muted)' }}>{on ? 'ON' : 'OFF'}</span>
            </div>
          ))}
        </div>

        {!tgConnected && !tgLoading ? (
          <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12, fontWeight: 700, color: '#B45309' }}>
            Bot not connected — open Configure bot, add token + chat ID, enable notifications.
          </p>
        ) : null}
      </div>

      <GlassTable icon={Send} title={`Activity log · ${logs.length}`} footer={
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Live from TelegramLog table</span>
      }>
        {logsLoading ? (
          <p style={{ padding: 20, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading Telegram activity…</p>
        ) : logsError ? (
          <p style={{ padding: 20, fontSize: 13, fontWeight: 600, color: '#B91C1C' }}>Could not load logs — is API running on :4000?</p>
        ) : logs.length === 0 ? (
          <p style={{ padding: 20, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No Telegram activity yet. Send a test message or place an order after bot setup.</p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {logs.slice(0, 30).map((log) => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                <StatusPill value={log.success ? 'success' : 'failed'} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
                    {log.command ? `${log.command}: ` : ''}{log.message.slice(0, 120)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>{log.time} · {log.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassTable>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="settings-card admin-panel-glass-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', flex: 1, maxWidth: 360 }}>
          <Send style={{ width: 13, height: 13, color: 'var(--admin-text-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search automation rule…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)' }} />
        </div>
        {!rulesError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 12, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#15803D' }}>
            <CheckCircle2 style={{ width: 14, height: 14 }} /> Automation rules API live
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#B45309' }}>
            <AlertTriangle style={{ width: 14, height: 14 }} /> Rules API unavailable
          </div>
        )}
        <AdminNavLink href="/dashboard/automation-rules">
          <button type="button" style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914', borderRadius: 12, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Manage rules</button>
        </AdminNavLink>
      </div>

      <GlassTable icon={Send} title={`Automation rules · ${filtered.length}`} footer={<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Rules that can send Telegram actions</span>}>
        {rulesError ? (
          <p style={{ padding: 20, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
            Automation rules could not load — Telegram notifications still work via bot config above.
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 20, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No automation rules yet — create in Automation Rules.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Rule', 'Trigger', 'Runs', 'Status', 'Last run', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{r.name}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{r.trigger}</td>
                  <td style={TD}>{r.runCount}</td>
                  <td style={TD}><StatusPill value={r.isActive ? 'active' : 'paused'} /></td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{r.lastRunAt ? formatRelativeTime(r.lastRunAt) : '—'}</td>
                  <td style={TD}><RowActionsMenu recordName={r.name} moduleHref="/dashboard/automation/telegram-notifications" recordId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

export function GoogleSheetsSyncPanelLive() {
  const [data, setData] = useState<SheetsDashboardData | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [syncingType, setSyncingType] = useState<string | null>(null)

  const load = () => {
    fetchSheetsDashboard()
      .then((res) => { setData(res); setIsOffline(false) })
      .catch(() => { setIsOffline(true); setData(null) })
  }

  useEffect(() => { load() }, [])

  const sheets = data?.sheets ?? []
  const connection = data?.connection
  const filtered = useMemo(() => sheets.filter((s) => !query || s.sheetType.toLowerCase().includes(query.toLowerCase())), [query, sheets])

  const hasFailed = sheets.some((s) => s.lastStatus === 'FAILED')
  const configuredCount = data?.stats?.configured ?? sheets.filter((s) => s.configured).length

  const runSyncAll = async () => {
    setBusy(true)
    try {
      await syncAllSheets('admin')
      load()
      toast.success('Sheet sync queued.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed — check Google Workspace setup.')
    } finally {
      setBusy(false)
    }
  }

  const runSyncOne = async (sheetType: string) => {
    setSyncingType(sheetType)
    try {
      await syncSheet(sheetType, 'admin')
      load()
      toast.success(`${sheetType} sync queued.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to sync ${sheetType}.`)
    } finally {
      setSyncingType(null)
    }
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StorefrontLiveBar
        onRefresh={load}
        refreshing={busy}
        items={[
          {
            label: 'Google account',
            value: connection?.workspaceConnected ? (connection.googleEmail ?? 'Connected') : 'Not connected',
            ok: Boolean(connection?.workspaceConnected),
            ...(connection?.workspaceConnected ? {} : { hint: 'Connect via Google Workspace' }),
          },
          {
            label: 'Spreadsheet',
            value: connection?.spreadsheetLinked ? 'Linked' : 'Not linked',
            ok: Boolean(connection?.spreadsheetLinked),
            ...(connection?.spreadsheetLinked ? {} : { hint: 'Create or link a spreadsheet' }),
          },
          {
            label: 'Configured',
            value: `${configuredCount}/${sheets.length || data?.stats?.total || 12}`,
            ok: configuredCount > 0,
          },
          {
            label: 'Auto sync',
            value: connection?.autoSyncEnabled ? 'On' : 'Off',
            ok: Boolean(connection?.autoSyncEnabled),
          },
        ]}
      />

      {isOffline ? (
        <ApiOfflineHint message="Google Sheets API offline — run pnpm dev:stack and refresh." />
      ) : null}

      {!connection?.spreadsheetLinked && !isOffline ? (
        <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #F59E0B' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#B45309' }}>
            Google spreadsheet এখনো link করা নেই।{' '}
            <AdminNavLink href="/dashboard/google-workspace/sheets-sync" className="automation-error-link">
              Google Workspace → Sheets Sync
            </AdminNavLink>{' '}
            থেকে connect করুন, অথবা .env এ GOOGLE_SHEETS_*_ID সেট করুন।
          </p>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Sheets" value={data?.stats?.total ?? sheets.length} />
        <KpiCard label="Synced" value={data?.stats?.completed ?? 0} />
        <KpiCard label="Failed" value={data?.stats?.failed ?? 0} />
        <KpiCard label="Pending" value={data?.stats?.pending ?? 0} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="settings-card admin-panel-glass-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', flex: 1, maxWidth: 360 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sheet…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)' }} />
        </div>
        {hasFailed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#B45309' }}>
            <AlertTriangle style={{ width: 14, height: 14 }} /> Some sheet syncs failed
          </div>
        )}
        <button type="button" disabled={busy || isOffline} onClick={() => void runSyncAll()} style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914', borderRadius: 12, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: busy || isOffline ? 'not-allowed' : 'pointer', opacity: busy || isOffline ? 0.6 : 1 }}>Sync all</button>
        <button type="button" onClick={load} className="settings-card admin-panel-glass-subtle" style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, color: 'var(--admin-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
        </button>
      </div>
      <GlassTable icon={RefreshCw} title={`Google Sheets · ${filtered.length}`} footer={<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Live from finance sheets dashboard</span>}>
        {filtered.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No Google Sheets configured yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Sheet', 'Configured', 'Status', 'Last sync', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((s) => {
                const statusKey = s.lastStatus === 'COMPLETED' ? 'completed' : s.lastStatus === 'FAILED' ? 'failed' : 'pending'
                const rowBusy = syncingType === s.sheetType
                return (
                  <tr key={s.sheetType}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                      {s.sheetType}
                      {s.lastError ? (
                        <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 600, color: '#B91C1C' }} title={s.lastError}>
                          {s.lastError.slice(0, 60)}{s.lastError.length > 60 ? '…' : ''}
                        </p>
                      ) : null}
                    </td>
                    <td style={TD}>
                      {s.configured ? (
                        <span title={s.configuredVia ?? undefined}>Yes{s.configuredVia ? ` (${s.configuredVia})` : ''}</span>
                      ) : 'No'}
                    </td>
                    <td style={TD}><StatusPill value={statusKey} /></td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{s.lastSync ? formatRelativeTime(s.lastSync) : '—'}</td>
                    <td style={TD}>
                      <AdminButton
                        className="!px-2 !py-1 !text-xs"
                        disabled={busy || isOffline || rowBusy || !s.configured}
                        onClick={() => void runSyncOne(s.sheetType)}
                      >
                        <Play style={{ width: 12, height: 12 }} /> {rowBusy ? '…' : 'Sync'}
                      </AdminButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

export function AiSeoAgentPanelLive() {
  const { data, isError, refetch } = useSeoOverview()
  const audits = data?.productAudits ?? []
  const needsWork = audits.filter((p) => p.score < 80)

  if (isError) return <ErrorBanner msg="SEO API offline." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Products" value={audits.length} />
        <KpiCard label="Needs SEO" value={needsWork.length} />
        <KpiCard label="Ready" value={audits.filter((p) => p.score >= 80).length} />
        <KpiCard label="Avg score" value={data?.summary.avgScore ?? 0} />
      </div>
      <GlassTable icon={Globe} title="AI SEO agent queue" footer={<button type="button" onClick={() => void refetch()} className="settings-card admin-panel-glass-subtle" style={{ padding: '6px 14px', fontSize: 12, fontWeight: 800, color: 'var(--admin-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw style={{ width: 11, height: 11 }} /> Run batch SEO</button>}>
        {needsWork.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>All products pass SEO threshold.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Product', 'Score', 'Meta title', 'Meta desc', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {needsWork.slice(0, 25).map((p) => (
                <tr key={p.id}>
                  <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{p.name}</td>
                  <td style={{ ...TD, fontWeight: 900 }}>{p.score}</td>
                  <td style={TD}>{p.hasMetaTitle ? '✓' : '✗'}</td>
                  <td style={TD}>{p.hasMetaDescription ? '✓' : '✗'}</td>
                  <td style={TD}>
                    <AdminButton className="!px-2 !py-1 !text-xs" onClick={() => toast.error('This action is not available yet — feature pending.')}>Review</AdminButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

export function AiSalesInsightsPanelLive() {
  const { data, isError, refetch } = useExecutiveDashboard()
  const kpis = data?.kpis

  if (isError) return <ErrorBanner msg="Sales insights API offline." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Revenue MTD" value={kpis?.revenue ?? 0} />
        <KpiCard label="Orders" value={kpis?.orders ?? 0} />
        <KpiCard label="Growth" value={`${kpis?.growth ?? 0}%`} />
        <KpiCard label="Customers" value={kpis?.customers ?? 0} />
      </div>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LineChart style={{ width: 15, height: 15, color: GOLD }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>AI Sales Insights</p>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data?.aiInsights ?? []).length === 0 ? (
            <li style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Insights build as order volume grows.</li>
          ) : (
            data!.aiInsights.map((item, i) => (
              <li key={item.id ?? i} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)' }}>• {item.insight}</li>
            ))
          )}
        </ul>
        <AdminButton variant="gold" className="mt-4" onClick={() => void refetch()}>
          <LineChart style={{ width: 16, height: 16 }} /> Refresh analysis
        </AdminButton>
      </div>
    </div>
  )
}

export function AiProductAgentAutomationPanelLive() {
  const { data } = useProducts({ limit: 100, status: 'published' })
  const products = data?.products ?? []
  const draft = products.filter((p) => !(p.images?.length)).length

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Catalog" value={products.length} />
        <KpiCard label="Needs copy" value={draft} />
        <KpiCard label="Published" value={products.length} />
        <KpiCard label="API" value="Live" />
      </div>
      <AIProductAgentPanel />
    </div>
  )
}

const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/automation/telegram-notifications': TelegramNotificationsPanelLive,
  '/dashboard/automation/google-sheets-sync': GoogleSheetsSyncPanelLive,
  '/dashboard/automation/ai-product-agent': AiProductAgentAutomationPanelLive,
  '/dashboard/automation/ai-seo-agent': AiSeoAgentPanelLive,
  '/dashboard/automation/ai-sales-insights': AiSalesInsightsPanelLive,
}

export function AutomationModulePanel(props: ModuleContextProps) {
  const Panel = PANELS[props.moduleHref]
  return renderModuleSubPanel(Panel, props)
}
