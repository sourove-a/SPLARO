'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import {
  useTelegramIntegration,
  useTelegramHealth,
  useTelegramLinkedAdmins,
  useGenerateTelegramLinkToken,
  useUnlinkTelegramAdmin,
  useTestTelegramIntegration,
  useUpdateTelegramIntegration,
} from '@/lib/api/integration-hooks'
import {
  Bot, Bell, MessageSquare, Package, Truck, BarChart2, Star,
  Save, Eye, EyeOff, Send, Loader2, AlertTriangle, CheckCircle2, ChevronDown, Link2, Copy, Unlink,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { useTelegramLogs } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'
import { cn } from '@/lib/utils/cn'

const COMMANDS = [
  ['/start · /menu', 'Open control panel with buttons'],
  ['/login TOKEN', 'Link your Telegram admin account (from link token below)'],
  ['/login', 'Get admin panel login token (after linked)'],
  ['/status', 'API health + today orders summary'],
  ['/orders', 'Latest 10 orders'],
  ['/order SPL-1001', 'Order details'],
  ['/confirm SPL-1001', 'Confirm order'],
  ['/cancel SPL-1001', 'Cancel order'],
  ['/courier SPL-1001', 'Book courier'],
  ['/link_group', 'Link team group for notifications (super admin)'],
  ['/group_info', 'Show chat ID for admin panel setup'],
]

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors duration-200',
        on ? 'tg-bot-toggle-track--on' : 'tg-bot-toggle-track',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 dark:bg-zinc-200',
          on ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function CollapsibleSection({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: React.ElementType
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ai-command-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        <Icon className="tg-bot-icon h-4 w-4 shrink-0" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-[var(--admin-text-strong)]">{title}</h3>
          {!open && summary ? (
            <p className="tg-bot-muted mt-0.5 truncate text-[11px] font-semibold">{summary}</p>
          ) : null}
        </div>
        <ChevronDown className={cn('tg-bot-muted h-4 w-4 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="tg-bot-divider">{children}</div> : null}
    </div>
  )
}

type TelegramBotConfigPanelProps = {
  /** Compact layout for Settings → Notifications (single source of truth). */
  embedded?: boolean
}

export function TelegramBotConfigPanel({ embedded = false }: TelegramBotConfigPanelProps) {
  const [showToken, setShowToken] = useState(false)
  const [botTokenInput, setBotTokenInput] = useState('')
  const [config, setConfig] = useState({
    chatId: '',
    isEnabled: true,
    notifyOrders: true,
    notifyCustomers: true,
    notifyPayments: true,
    notifyCourier: true,
    notifyStock: true,
    notifyReviews: true,
    reportDaily: true,
    reportTime: '09:00',
  })

  const [linkToken, setLinkToken] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useTelegramIntegration()
  const { data: health, refetch: refetchHealth } = useTelegramHealth()
  const { data: linkedData, refetch: refetchLinked } = useTelegramLinkedAdmins()
  const saveMutation = useUpdateTelegramIntegration()
  const testMutation = useTestTelegramIntegration()
  const linkTokenMutation = useGenerateTelegramLinkToken()
  const unlinkMutation = useUnlinkTelegramAdmin()
  const { data: tgData } = useTelegramLogs()
  const recentLogs = tgData?.logs.slice(0, 8) ?? []

  useEffect(() => {
    if (!data) return
    setConfig({
      chatId: data.chatId ?? '',
      isEnabled: data.isEnabled ?? true,
      notifyOrders: data.notifyOrders ?? true,
      notifyCustomers: data.notifyCustomers ?? true,
      notifyPayments: data.notifyPayments ?? true,
      notifyCourier: data.notifyCourier ?? true,
      notifyStock: data.notifyStock ?? true,
      notifyReviews: data.notifyReviews ?? true,
      reportDaily: data.reportDaily ?? true,
      reportTime: data.reportTime ?? '09:00',
    })
    setBotTokenInput('')
  }, [data])

  const handleSave = async () => {
    try {
      const payload: Record<string, unknown> = { ...config }
      if (botTokenInput.trim()) payload.botToken = botTokenInput.trim()
      else if (!data?.tokenConfigured) {
        toastFail('Bot token is required.', 'tg-missing-token')
        return
      }
      if (!config.chatId.trim()) {
        toastFail('Chat ID is required.', 'tg-missing-chat')
        return
      }
      await saveMutation.mutateAsync(payload as never)
      const fresh = await refetch()
      if (!fresh.data?.chatId) {
        toastFail('Save did not persist — check API connection.', 'tg-save-verify-fail')
        return
      }
      toastOk('Telegram settings saved to database.', 'tg-save-ok')
      setBotTokenInput('')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Save failed', 'tg-save-fail')
    }
  }

  const handleTest = async () => {
    try {
      const result = await testMutation.mutateAsync('✅ SPLARO — Telegram test from admin panel.')
      if (!result.ok) {
        toastFail(result.message || 'Telegram test failed', 'tg-test-fail')
        return
      }
      toastOk(result.message || 'Telegram connected successfully', 'tg-test-ok')
      void refetchHealth()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Telegram test failed', 'tg-test-fail')
    }
  }

  const handleGenerateLinkToken = async () => {
    try {
      const result = await linkTokenMutation.mutateAsync()
      setLinkToken(result.code)
      toastOk('Link token generated — send /login TOKEN in your bot within 5 minutes.', 'tg-link-ok')
      void refetchLinked()
      void refetchHealth()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not generate link token', 'tg-link-fail')
    }
  }

  const handleCopyLinkToken = async () => {
    if (!linkToken) return
    try {
      await navigator.clipboard.writeText(`/login ${linkToken}`)
      toastOk('Copied /login command to clipboard', 'tg-copy-ok')
    } catch {
      toastFail('Could not copy — select and copy manually', 'tg-copy-fail')
    }
  }

  const handleUnlink = async (id: string) => {
    try {
      await unlinkMutation.mutateAsync(id)
      toastOk('Telegram admin unlinked', 'tg-unlink-ok')
      void refetchLinked()
      void refetchHealth()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Unlink failed', 'tg-unlink-fail')
    }
  }

  const toggle = (key: keyof typeof config) => {
    const val = config[key]
    if (typeof val === 'boolean') {
      setConfig((prev) => ({ ...prev, [key]: !val }))
    }
  }

  if (isLoading) {
    return (
      <div className="tg-bot-muted flex items-center gap-3 py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-semibold">Loading Telegram settings from database…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="tg-bot-error">
        {error instanceof Error ? error.message : 'Failed to load Telegram integration'}
      </div>
    )
  }

  const tokenConfigured = data?.tokenConfigured ?? false
  const connected = tokenConfigured && Boolean(config.chatId) && config.isEnabled

  const notifications = [
    { key: 'notifyOrders' as const, icon: MessageSquare, label: 'New Orders', desc: 'Alert on every new order' },
    { key: 'notifyCustomers' as const, icon: Bell, label: 'New Customer Signup', desc: 'Alert when a customer registers' },
    { key: 'notifyPayments' as const, icon: Bell, label: 'Payment Received', desc: 'Successful payments & refunds' },
    { key: 'notifyCourier' as const, icon: Truck, label: 'Courier Booking Failed', desc: 'Courier API failures' },
    { key: 'notifyStock' as const, icon: Package, label: 'Low Stock', desc: 'Variants at or below threshold' },
    { key: 'notifyReviews' as const, icon: Star, label: 'New Product Reviews', desc: 'Customer review submitted — pending approval' },
    { key: 'reportDaily' as const, icon: BarChart2, label: 'Daily Report', desc: 'Scheduled summary' },
  ]

  return (
    <div
      id={embedded ? 'telegram' : undefined}
      className={cn('space-y-4', embedded ? 'pb-2' : 'mx-auto max-w-3xl pb-8')}
    >
      {!embedded ? (
        <section className="ai-command-hero">
          <p className="ai-command-eyebrow">Integrations</p>
          <h2 className="ai-command-title">Telegram Bot</h2>
          <p className="ai-command-sub">Saved in PostgreSQL (encrypted token). Reload-safe.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={cn('ai-command-pill', connected ? 'ai-command-pill--ok' : 'ai-command-pill--warn')}>
              {connected ? 'Connected' : tokenConfigured ? 'Configured — enable bot' : 'Not configured'}
            </span>
            {data?.lastTestedAt ? (
              <span className="ai-command-pill">Last test: {formatRelativeTime(data.lastTestedAt)}</span>
            ) : null}
            <Link href="/dashboard/ai-agent" className="ai-command-pill ai-command-pill--ok hover:opacity-90">
              AI keys → Command Brain
            </Link>
          </div>
          {data?.lastTestStatus === 'failed' && data.lastTestMessage ? (
            <p className="tg-bot-status-fail mt-2 text-xs font-semibold">Last test error: {data.lastTestMessage}</p>
          ) : null}
          {health?.lastDeliveryStatus === 'failed' && health.lastDeliveryError ? (
            <p className="tg-bot-status-fail mt-2 text-xs font-semibold">Last delivery error: {health.lastDeliveryError}</p>
          ) : null}
        </section>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <span className={cn('ai-command-pill text-[11px]', connected ? 'ai-command-pill--ok' : 'ai-command-pill--warn')}>
            {connected ? 'Connected' : tokenConfigured ? 'Token saved — add chat ID & enable' : 'Not configured'}
          </span>
          {data?.lastTestedAt ? (
            <span className="ai-command-pill text-[11px]">Last test: {formatRelativeTime(data.lastTestedAt)}</span>
          ) : null}
          {data?.lastTestStatus === 'failed' && data.lastTestMessage ? (
            <span className="tg-bot-status-fail text-[11px] font-semibold">{data.lastTestMessage}</span>
          ) : null}
        </div>
      )}

      <CollapsibleSection
        title="Connection Health"
        icon={BarChart2}
        defaultOpen
        summary={
          health?.botRunning
            ? `@${health.botUsername ?? 'bot'} · ${health.transportMode}`
            : 'Diagnostics from API'
        }
      >
        <div className="grid gap-2 text-[11px] font-semibold sm:grid-cols-2">
          <HealthRow label="Bot token" ok={health?.botTokenConfigured} detail={health?.botTokenSource ?? 'unknown'} />
          <HealthRow label="Bot running" ok={health?.botRunning} detail={health?.botUsername ? `@${health.botUsername}` : 'not reachable'} />
          <HealthRow label="Transport" ok={health?.transportMode !== 'disabled'} detail={health?.transportMode ?? '—'} />
          <HealthRow
            label="Webhook"
            ok={!health?.webhookUrl || health.webhookRegistered}
            detail={health?.webhookUrl ? (health.webhookRegistered ? 'registered' : 'mismatch') : 'polling / send-only'}
          />
          <HealthRow label="Linked admins" ok={(health?.linkedAdminCount ?? 0) > 0} detail={`${health?.linkedAdminCount ?? 0} linked`} />
          <HealthRow label="Store chat ID" ok={Boolean(health?.configChatIdMasked)} detail={health?.configChatIdMasked ?? 'not set'} />
          <HealthRow
            label="Last delivery"
            ok={health?.lastDeliveryStatus === 'success'}
            detail={
              health?.lastDeliveryStatus === 'none'
                ? 'no attempts yet'
                : health?.lastDeliveryStatus === 'success'
                  ? 'ok'
                  : health?.lastDeliveryError ?? 'failed'
            }
          />
          <HealthRow
            label="Network check"
            ok={health?.networkVerified}
            detail={health?.networkVerified ? 'Telegram API reachable' : 'not verified against Telegram network'}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Admin Linking"
        icon={Link2}
        defaultOpen
        summary={
          (linkedData?.linked.length ?? 0) > 0
            ? `${linkedData?.linked.length} linked admin(s)`
            : 'Generate link token → /login in bot'
        }
      >
        <div className="space-y-3">
          <p className="tg-bot-muted text-[11px] leading-relaxed">
            First-time setup: generate a link token, open your SPLARO bot, send{' '}
            <code className="tg-bot-code">/login XXXX-XXXX</code>.
            After linking, admin login tokens are delivered automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <AdminButton loading={linkTokenMutation.isPending} onClick={() => void handleGenerateLinkToken()} disabled={!tokenConfigured || !config.isEnabled}>
              <Link2 className="h-4 w-4" />
              Generate link token
            </AdminButton>
            {linkToken ? (
              <AdminButton variant="ghost" onClick={() => void handleCopyLinkToken()}>
                <Copy className="h-4 w-4" />
                Copy /login {linkToken}
              </AdminButton>
            ) : null}
          </div>
          {linkToken ? (
            <div className="tg-bot-warn">
              Send in Telegram: <code className="font-mono">/login {linkToken}</code> · expires in 5 min · one-time for web login
            </div>
          ) : null}
          {(linkedData?.linked.length ?? 0) > 0 ? (
            <div className="space-y-1.5">
              {linkedData?.linked.map((admin) => (
                <div key={admin.id} className="tg-bot-row flex items-center justify-between px-3 py-2.5 text-[11px]">
                  <div>
                    <p className="font-black text-[var(--admin-text-strong)]">{admin.username ? `@${admin.username}` : admin.telegramIdMasked}</p>
                    <p className="tg-bot-muted">{admin.role.replace(/_/g, ' ')} · ID {admin.telegramIdMasked}</p>
                  </div>
                  <AdminButton variant="ghost" loading={unlinkMutation.isPending} onClick={() => void handleUnlink(admin.id)}>
                    <Unlink className="h-3.5 w-3.5" />
                    Unlink
                  </AdminButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="tg-bot-empty-hint">No linked admin Telegram accounts yet.</p>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Bot Connection"
        icon={Bot}
        defaultOpen
        summary={
          tokenConfigured && config.chatId
            ? `Chat ${config.chatId} · ${config.isEnabled ? 'Enabled' : 'Disabled'}`
            : 'Token & chat ID required'
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="admin-field block space-y-1.5">
              <span className="tg-bot-label">Bot Token</span>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  placeholder={
                    tokenConfigured
                      ? `Saved (${data?.botToken ?? '••••'}) — leave blank to keep`
                      : '123456789:ABCdefGHIjklMNO...'
                  }
                  className="admin-input pr-10"
                />
                <button type="button" onClick={() => setShowToken((v) => !v)} className="tg-bot-muted absolute right-3 top-1/2 -translate-y-1/2">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {tokenConfigured ? (
                <p className="tg-bot-status-ok flex items-center gap-1 text-[11px] font-bold">
                  <CheckCircle2 className="h-3 w-3" /> Token saved (encrypted)
                </p>
              ) : null}
            </label>
            <label className="admin-field block space-y-1.5">
              <span className="tg-bot-label">Chat ID</span>
              <input
                type="text"
                value={config.chatId}
                onChange={(e) => setConfig((p) => ({ ...p, chatId: e.target.value }))}
                placeholder="-1001234567890 (group) or personal ID"
                className="admin-input"
              />
              <p className="tg-bot-muted text-[11px] font-semibold leading-relaxed">
                <strong className="text-[var(--admin-text-strong)]">Personal group:</strong> Add bot to your SPLARO team group → send{' '}
                <code className="tg-bot-code">/link_group</code>{' '}
                as super admin. In BotFather run <code className="tg-bot-code">/setprivacy</code> → Disable so the bot reads messages in groups.
              </p>
            </label>
          </div>
          <div className="tg-bot-row tg-bot-row--soft flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-black text-[var(--admin-text-strong)]">Enable Bot</p>
              <p className="tg-bot-muted text-[11px]">Notifications when active</p>
            </div>
            <Toggle on={config.isEnabled} onToggle={() => toggle('isEnabled')} />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Notification Types"
        icon={Bell}
        summary={`${notifications.filter((n) => Boolean(config[n.key])).length} of ${notifications.length} active`}
      >
        <div className="space-y-2">
          {notifications.map(({ key, icon: Icon, label, desc }) => (
            <div key={key} className="tg-bot-row flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon className="tg-bot-accent h-4 w-4" />
                <div>
                  <p className="text-sm font-black text-[var(--admin-text-strong)]">{label}</p>
                  <p className="tg-bot-muted text-[11px]">{desc}</p>
                </div>
              </div>
              <Toggle on={Boolean(config[key])} onToggle={() => toggle(key)} />
            </div>
          ))}
          {config.reportDaily && (
            <label className="admin-field mt-2 block space-y-1.5">
              <span className="tg-bot-label !normal-case !tracking-normal">Daily report time</span>
              <input
                type="time"
                value={config.reportTime}
                onChange={(e) => setConfig((p) => ({ ...p, reportTime: e.target.value }))}
                className="admin-input w-auto py-2.5"
              />
            </label>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Bot Commands" icon={Send} summary={`${COMMANDS.length} commands`}>
        <div className="space-y-1.5">
          {COMMANDS.map(([cmd, desc]) => (
            <div key={cmd} className="tg-bot-row px-3 py-2.5">
              <code className="tg-bot-accent text-[11px] font-black">{cmd}</code>
              <p className="tg-bot-muted mt-0.5 text-[11px]">{desc}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <div className="flex flex-wrap gap-2">
        <AdminButton variant="gold" loading={saveMutation.isPending} onClick={() => void handleSave()}>
          <Save className="h-4 w-4" />
          Save to database
        </AdminButton>
        <AdminButton loading={testMutation.isPending} onClick={() => void handleTest()} disabled={!tokenConfigured || !config.chatId}>
          <Send className="h-4 w-4" />
          Test connection
        </AdminButton>
        {!tokenConfigured || !config.chatId ? (
          <span className="tg-bot-warn-inline">
            <AlertTriangle className="h-3 w-3" />
            Save token + chat ID before test
          </span>
        ) : null}
        <AdminNavLink href="/dashboard/system/telegram-logs" className="admin-btn px-4 py-2 text-xs font-black">
          View logs
        </AdminNavLink>
      </div>

      {recentLogs.length > 0 && (
        <CollapsibleSection title="Recent Activity" icon={BarChart2} summary={`${recentLogs.length} recent events`}>
          <div className="space-y-1.5">
            {recentLogs.map((log) => (
              <div key={log.id} className="tg-bot-row flex items-center justify-between px-3 py-2.5 text-[11px]">
                <span className="font-bold text-[var(--admin-text-strong)]">{log.command ?? log.type}</span>
                <span className={cn('font-black', log.success ? 'tg-bot-status-ok' : 'tg-bot-status-fail')}>
                  {log.success ? 'ok' : 'fail'} · {formatRelativeTime(log.createdAt ?? log.time)}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

function HealthRow({ label, ok, detail }: { label: string; ok?: boolean | undefined; detail: string }) {
  return (
    <div className="tg-bot-row flex items-start justify-between gap-2 px-3 py-2">
      <span className="font-black text-[var(--admin-text-strong)]">{label}</span>
      <span className={cn('text-right', ok ? 'tg-bot-status-ok' : ok === false ? 'tg-bot-status-fail' : 'tg-bot-muted')}>
        {detail}
      </span>
    </div>
  )
}
