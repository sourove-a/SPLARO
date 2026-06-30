'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import {
  useTelegramIntegration,
  useTestTelegramIntegration,
  useUpdateTelegramIntegration,
} from '@/lib/api/integration-hooks'
import {
  Bot, Bell, MessageSquare, Package, Truck, BarChart2,
  Save, Eye, EyeOff, Send, Loader2, AlertTriangle, CheckCircle2, ChevronDown,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { useTelegramLogs } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'
import { cn } from '@/lib/utils/cn'

const COMMANDS = [
  ['Ask anything', 'Send normal text — authorized users chat with SPLARO AI agent'],
  ['SPL-1001', 'Track order — send only the order number'],
  ['/today_orders', "Today's order count"],
  ['/today_sales', "Today's revenue"],
  ['/pending_orders', 'Pending orders count'],
  ['/low_stock', 'Low stock variants'],
  ['/order SPL-1001', 'Order details by invoice'],
]

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors duration-200',
        on ? 'bg-emerald-500' : 'bg-[rgba(17,17,17,0.18)]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
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
        <Icon className="h-4 w-4 shrink-0 text-[#5E7CFF]" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black">{title}</h3>
          {!open && summary ? (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6B6B6B]">{summary}</p>
          ) : null}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#9B9B9B] transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="mt-4 border-t border-[rgba(17,17,17,0.06)] pt-4">{children}</div> : null}
    </div>
  )
}

export function TelegramBotConfigPanel() {
  const [showToken, setShowToken] = useState(false)
  const [botTokenInput, setBotTokenInput] = useState('')
  const [config, setConfig] = useState({
    chatId: '',
    isEnabled: false,
    notifyOrders: true,
    notifyCustomers: true,
    notifyPayments: true,
    notifyCourier: true,
    notifyStock: true,
    reportDaily: true,
    reportTime: '09:00',
  })

  const { data, isLoading, isError, error, refetch } = useTelegramIntegration()
  const saveMutation = useUpdateTelegramIntegration()
  const testMutation = useTestTelegramIntegration()
  const { data: tgData } = useTelegramLogs()
  const recentLogs = tgData?.logs.slice(0, 8) ?? []

  useEffect(() => {
    if (!data) return
    setConfig({
      chatId: data.chatId ?? '',
      isEnabled: data.isEnabled ?? false,
      notifyOrders: data.notifyOrders ?? true,
      notifyCustomers: data.notifyCustomers ?? true,
      notifyPayments: data.notifyPayments ?? true,
      notifyCourier: data.notifyCourier ?? true,
      notifyStock: data.notifyStock ?? true,
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
      toastOk(result.message || 'Telegram connected successfully', 'tg-test-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Telegram test failed', 'tg-test-fail')
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
      <div className="flex items-center gap-3 py-12 text-[#6B6B6B]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-semibold">Loading Telegram settings from database…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
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
    { key: 'reportDaily' as const, icon: BarChart2, label: 'Daily Report', desc: 'Scheduled summary' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="ai-command-hero">
        <p className="ai-command-eyebrow">Integrations</p>
        <h1 className="ai-command-title">Telegram Bot</h1>
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
          <p className="mt-2 text-xs font-semibold text-red-600">Last error: {data.lastTestMessage}</p>
        ) : null}
      </section>

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
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B6B6B]">Bot Token</span>
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
                  className="w-full rounded-xl border border-[rgba(17,17,17,0.12)] bg-[#f9f8f6] px-4 py-3 pr-10 text-sm font-semibold outline-none focus:border-[#5E7CFF] focus:bg-white"
                />
                <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B]">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {tokenConfigured ? (
                <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Token saved (encrypted)
                </p>
              ) : null}
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B6B6B]">Chat ID</span>
              <input
                type="text"
                value={config.chatId}
                onChange={(e) => setConfig((p) => ({ ...p, chatId: e.target.value }))}
                placeholder="-1001234567890"
                className="w-full rounded-xl border border-[rgba(17,17,17,0.12)] bg-[#f9f8f6] px-4 py-3 text-sm font-semibold outline-none focus:border-[#5E7CFF] focus:bg-white"
              />
            </label>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#f7f6f4] px-4 py-3">
            <div>
              <p className="text-sm font-black">Enable Bot</p>
              <p className="text-[11px] text-[#6B6B6B]">Notifications when active</p>
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
            <div key={key} className="flex items-center justify-between rounded-xl border border-[rgba(17,17,17,0.07)] bg-[#f9f8f6] px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-[#b8872a]" />
                <div>
                  <p className="text-sm font-black">{label}</p>
                  <p className="text-[11px] text-[#6B6B6B]">{desc}</p>
                </div>
              </div>
              <Toggle on={Boolean(config[key])} onToggle={() => toggle(key)} />
            </div>
          ))}
          {config.reportDaily && (
            <label className="mt-2 block space-y-1.5">
              <span className="text-[11px] font-black uppercase text-[#6B6B6B]">Daily report time</span>
              <input
                type="time"
                value={config.reportTime}
                onChange={(e) => setConfig((p) => ({ ...p, reportTime: e.target.value }))}
                className="rounded-xl border px-4 py-2.5 text-sm font-bold"
              />
            </label>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Bot Commands" icon={Send} summary={`${COMMANDS.length} commands`}>
        <div className="space-y-1.5">
          {COMMANDS.map(([cmd, desc]) => (
            <div key={cmd} className="rounded-xl border bg-[#f9f8f6] px-3 py-2.5">
              <code className="text-[11px] font-black text-[#b8872a]">{cmd}</code>
              <p className="mt-0.5 text-[11px] text-[#6B6B6B]">{desc}</p>
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
          <span className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
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
              <div key={log.id} className="flex items-center justify-between rounded-xl border bg-[#f9f8f6] px-3 py-2.5 text-[11px]">
                <span className="font-bold">{log.command ?? log.type}</span>
                <span className={cn('font-black', log.success ? 'text-emerald-600' : 'text-red-500')}>
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
