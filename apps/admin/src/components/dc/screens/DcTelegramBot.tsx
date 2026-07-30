'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcConnectionChip } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO } from '@/components/dc/tokens'
import { TelegramBotConfigPanel } from '@/components/modules/TelegramBotConfigPanel'
import {
  confirmTelegramSettingsSaved,
  confirmTelegramTestSent,
} from '@/lib/admin/integration-save'
import { toastFail } from '@/lib/admin/feedback'
import { useTelegramLogs } from '@/lib/api/hooks'
import {
  useTelegramHealth,
  useTelegramIntegration,
  useTestTelegramIntegration,
  useUpdateTelegramIntegration,
} from '@/lib/api/integration-hooks'
import type { TelegramIntegration } from '@/lib/api/integrations'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

/** Design alert rows → live TelegramIntegration flags (verified PATCH). */
const ALERT_TOGGLES: Array<{
  key: keyof Pick<
    TelegramIntegration,
    | 'notifyOrders'
    | 'notifyCourier'
    | 'notifyPayments'
    | 'notifyStock'
    | 'reportDaily'
    | 'notifyCustomers'
  >
  label: string
  sub: string
}> = [
  {
    key: 'notifyOrders',
    label: 'New order',
    sub: 'to the ops group, with items and address',
  },
  {
    key: 'notifyCourier',
    label: 'Courier booked',
    sub: 'consignment number and rider details',
  },
  {
    key: 'notifyPayments',
    label: 'Payment alerts',
    sub: 'failed or declined payments to ops (no separate delivery-failed API flag)',
  },
  {
    key: 'notifyStock',
    label: 'Low stock',
    sub: 'once a day, batched digest',
  },
  {
    key: 'reportDaily',
    label: 'Daily closing summary',
    sub: 'after the closing is locked',
  },
  {
    key: 'notifyCustomers',
    label: 'Customer order updates',
    sub: 'to the customer, not the group',
  },
]

/** Real bot commands (same surface the Nest Telegram bot exposes). */
const BOT_COMMANDS: Array<{ title: string; sub: string; value: string; color: string }> = [
  { title: '/orders', sub: "today's pending orders with totals", value: 'ADMIN', color: 'var(--violet)' },
  { title: '/order SPL-1001', sub: 'order details by invoice', value: 'ADMIN', color: 'var(--violet)' },
  { title: '/confirm · /cancel', sub: 'status actions on an order', value: 'ADMIN', color: 'var(--violet)' },
  { title: '/courier SPL-1001', sub: 'book Steadfast consignment', value: 'ADMIN', color: 'var(--violet)' },
  { title: '/status', sub: 'API health + today orders summary', value: 'ADMIN', color: 'var(--violet)' },
  { title: '/login TOKEN', sub: 'link personal Telegram for OTP', value: 'STAFF', color: 'var(--info)' },
  { title: '/help · /menu', sub: 'lists commands the sender may use', value: 'PUBLIC', color: 'var(--ink-2)' },
]

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function logIcon(type: string, success: boolean): { icon: string; color: string } {
  if (!success) return { icon: 'icon-x', color: 'var(--bad)' }
  const t = type.toLowerCase()
  if (t.includes('login') || t.includes('otp') || t.includes('auth'))
    return { icon: 'icon-key', color: 'var(--info)' }
  if (t.includes('courier') || t.includes('ship'))
    return { icon: 'icon-truck', color: 'var(--info)' }
  if (t.includes('stock') || t.includes('inventory'))
    return { icon: 'icon-triangle-alert', color: 'var(--warn)' }
  if (t.includes('order')) return { icon: 'icon-shopping-bag', color: 'var(--violet)' }
  return { icon: 'icon-send', color: 'var(--violet)' }
}

/**
 * Telegram Bot — design handoff layout (KPIs · alert toggles · commands · recent sends)
 * + live integration API. Never Settings SMTP.
 */
export function DcTelegramBot() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="telegram" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcTelegramBotBody />
    </DcScreenProvider>
  )
}

function DcTelegramBotBody() {
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const [setupOpen, setSetupOpen] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const integration = useTelegramIntegration()
  const health = useTelegramHealth()
  const logsQuery = useTelegramLogs()
  const saveMutation = useUpdateTelegramIntegration()
  const testMutation = useTestTelegramIntegration()

  const data = integration.data
  const logs = useMemo(() => logsQuery.data?.logs ?? [], [logsQuery.data?.logs])
  const conn = dcConnectionChip(api.pulse)
  const apiOnline = api.pulse === 'online'
  const botConfigured = Boolean(data?.tokenConfigured && data?.chatId?.trim() && data?.isEnabled)
  const botOk = Boolean(apiOnline && botConfigured && health.data?.botRunning)
  const botHandle = health.data?.botUsername ? `@${health.data.botUsername}` : '@splaro_bot'
  const canSendTest = Boolean(botOk && !testMutation.isPending)

  const openSetup = () => {
    setSetupOpen(true)
    window.setTimeout(() => {
      document.getElementById('link')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#link' || window.location.hash === '#setup') {
      setSetupOpen(true)
      const timer = window.setTimeout(() => {
        document.getElementById('link')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 220)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [])

  const kpis = useMemo(() => {
    const day = logs.filter((l) => hoursAgo(l.createdAt) <= 24)
    const failed = day.filter((l) => !l.success)
    const logins = day.filter((l) => {
      const blob = `${l.type} ${l.command ?? ''} ${l.message}`.toLowerCase()
      return blob.includes('login') || blob.includes('otp') || blob.includes('code')
    })
    const linked = health.data?.linkedAdminCount ?? 0
    const ops = health.data?.hasLinkedAdminChat || Boolean(data?.chatId?.trim())
    return {
      messages: day.length,
      failed: failed.length,
      logins: logins.length,
      loginFail: logins.filter((l) => !l.success).length,
      linked,
      ops,
    }
  }, [logs, health.data, data?.chatId])

  const recent = useMemo(() => logs.slice(0, 8), [logs])

  const toggleAlert = async (key: (typeof ALERT_TOGGLES)[number]['key']) => {
    if (!data) {
      toastFail('Load Telegram config first — API offline or not configured.')
      return
    }
    if (!data.tokenConfigured || !data.chatId.trim()) {
      toastFail('Set bot token + chat ID in Bot setup first.')
      setSetupOpen(true)
      return
    }
    const next = !data[key]
    setSavingKey(key)
    const payload = {
      chatId: data.chatId.trim(),
      isEnabled: data.isEnabled,
      notifyOrders: data.notifyOrders,
      notifyCustomers: data.notifyCustomers,
      notifyPayments: data.notifyPayments,
      notifyCourier: data.notifyCourier,
      notifyStock: data.notifyStock,
      notifyReviews: data.notifyReviews,
      reportDaily: data.reportDaily,
      reportTime: data.reportTime || '09:00',
      [key]: next,
      requireTokenConfigured: true as const,
    }
    try {
      await confirmTelegramSettingsSaved(payload, () =>
        saveMutation.mutateAsync({
          chatId: payload.chatId,
          isEnabled: payload.isEnabled,
          notifyOrders: payload.notifyOrders,
          notifyCustomers: payload.notifyCustomers,
          notifyPayments: payload.notifyPayments,
          notifyCourier: payload.notifyCourier,
          notifyStock: payload.notifyStock,
          notifyReviews: payload.notifyReviews,
          reportDaily: payload.reportDaily,
          reportTime: payload.reportTime,
          [key]: next,
        } as never),
      )
      void integration.refetch()
    } finally {
      setSavingKey(null)
    }
  }

  const sendTest = async () => {
    const ok = await confirmTelegramTestSent(() =>
      testMutation.mutateAsync('✅ SPLARO — Telegram test from admin panel.'),
    )
    if (ok) {
      void health.refetch()
      void logsQuery.refetch()
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis', items: [] },
    { t: 'toggles', title: '', items: [] },
  ]

  const loading = integration.isLoading || logsQuery.isLoading
  const error = integration.error || logsQuery.error

  return (
    <>
      <DcPageHead
        crumbGroup="Integrations"
        title="Telegram Bot"
        statusLabel={conn?.label ?? (botOk ? 'LIVE' : 'NOT LINKED')}
        statusTone={conn?.tone ?? (botOk ? 'ok' : 'warn')}
        syncLabel={
          botOk
            ? `bot online${health.data?.transportMode ? ` · ${health.data.transportMode}` : ''}`
            : botConfigured
              ? 'token + chat saved · verify bot reachability'
              : 'configure bot token + chat'
        }
        syncing={integration.isFetching || health.isFetching}
        onSync={() => {
          void integration.refetch()
          void health.refetch()
          void logsQuery.refetch()
        }}
        onBack={() => router.push('/dashboard/all-integrations')}
        actions={[
          {
            label: 'Bot setup',
            icon: 'icon-settings',
            onClick: openSetup,
          },
          {
            label: testMutation.isPending ? 'Sending…' : canSendTest ? 'Send test' : 'Finish setup',
            icon: 'icon-send',
            onClick: canSendTest ? () => void sendTest() : openSetup,
          },
        ]}
      />

      {loading ? (
        <DcLoadingState blocks={skeleton} />
      ) : error ? (
        <DcErrorState
          error={`GET /admin/integrations/telegram → ${error instanceof Error ? error.message : 'failed'}`}
          hint="Nothing was changed — only this view failed to load."
          onRetry={() => {
            void integration.refetch()
            void logsQuery.refetch()
          }}
        />
      ) : !data?.tokenConfigured ? (
        <DcEmptyState
          icon="icon-send"
          title="Bot is not linked"
          body="Create a bot with @BotFather, paste the token in Bot setup, then link your personal chat for login codes."
          cta="Open bot setup"
          onCta={openSetup}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {/* KPIs — design row, live counts from logs + health */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Messages · 24h"
              value={String(kpis.messages)}
              sub={kpis.failed > 0 ? `${kpis.failed} failed` : 'all delivered'}
              color="var(--ok)"
            />
            <Kpi
              label="Subscribers"
              value={String(kpis.linked + (kpis.ops ? 1 : 0))}
              sub={kpis.ops ? 'ops chat + linked admins' : 'linked admins only — no ops chat'}
            />
            <Kpi
              label="Login codes sent"
              value={String(kpis.logins)}
              sub={kpis.loginFail === 0 ? 'all delivered · last 24h' : `${kpis.loginFail} failed · last 24h`}
            />
            <Kpi
              label="Failed sends"
              value={String(kpis.failed)}
              sub={kpis.failed > 0 ? 'users who blocked the bot / API error' : 'none in last 24h'}
              color={kpis.failed > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
          </div>

          {/* Alerts + Commands — design two-column */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
              gap: 16,
              alignItems: 'start',
            }}
            className="dc-telegram-split"
          >
            <section style={{ ...card, padding: '4px 0 8px', overflow: 'hidden' }}>
              <div
                style={{
                  padding: '12px 15px 8px',
                  font: `600 13px/1.3 ${FONT}`,
                  color: 'var(--ink)',
                }}
              >
                Alert types
              </div>
              {ALERT_TOGGLES.map((row) => {
                const on = Boolean(data?.[row.key])
                const busy = savingKey === row.key
                return (
                  <div
                    key={row.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 15px',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        {row.label}
                      </span>
                      <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                        {row.key === 'notifyStock' && data?.reportTime
                          ? `once a day at ${data.reportTime}, batched`
                          : row.sub}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        font: `600 11px/1 ${FONT}`,
                        letterSpacing: '.06em',
                        color: on ? 'var(--violet)' : 'var(--ink-3)',
                      }}
                    >
                      {busy ? '…' : on ? 'ON' : 'OFF'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={row.label}
                      disabled={busy || saveMutation.isPending}
                      onClick={() => void toggleAlert(row.key)}
                      style={{
                        position: 'relative',
                        display: 'block',
                        width: 38,
                        height: 21,
                        flex: 'none',
                        padding: 0,
                        border: 0,
                        cursor: busy ? 'wait' : 'pointer',
                        borderRadius: 99,
                        background: on ? 'var(--violet-solid)' : 'var(--surface-3)',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: on ? 19 : 2,
                          width: 17,
                          height: 17,
                          borderRadius: 99,
                          background: on ? 'var(--on-violet)' : 'var(--surface)',
                          transition: 'left 120ms ease',
                        }}
                      />
                    </button>
                  </div>
                )
              })}
            </section>

            <section style={{ ...card, padding: '4px 0 8px', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '12px 15px 8px',
                }}
              >
                <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>Bot commands</span>
                <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>{botHandle}</span>
              </div>
              {BOT_COMMANDS.map((cmd) => (
                <div
                  key={cmd.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '10px 15px',
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
                      background: 'var(--surface-2)',
                      color: cmd.color,
                    }}
                  >
                    <DcIcon name="icon-terminal" size={13} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ font: `600 12.5px/1.25 ${MONO}`, color: 'var(--ink)' }}>{cmd.title}</span>
                    <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{cmd.sub}</span>
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      font: `700 10px/1 ${FONT}`,
                      letterSpacing: '.06em',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {cmd.value}
                  </span>
                </div>
              ))}
            </section>
          </div>

          {/* Recent sends — live telegram logs */}
          <section style={{ ...card, padding: '4px 0 8px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 15px 8px', font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
              Recent sends
            </div>
            {recent.length === 0 ? (
              <p style={{ margin: 0, padding: '12px 15px 16px', font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                No Telegram sends logged yet. Use Send test or wait for the next order alert.
              </p>
            ) : (
              recent.map((l) => {
                const { icon, color } = logIcon(l.type, l.success)
                return (
                  <div
                    key={l.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 15px',
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
                        background: 'var(--surface-2)',
                        color,
                      }}
                    >
                      <DcIcon name={icon} size={13} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, font: `500 12.5px/1.35 ${FONT}`, color: 'var(--ink)' }}>
                      {l.message || `${l.type}${l.command ? ` ${l.command}` : ''}`}
                      {!l.success ? (
                        <span style={{ color: 'var(--bad)', fontWeight: 600 }}> · failed</span>
                      ) : null}
                    </span>
                    <span style={{ flex: 'none', font: `400 12px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                      {l.time ||
                        new Date(l.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                    </span>
                  </div>
                )
              })
            )}
          </section>

          {/* Token / chat / admin link — same verified panel, design secondary */}
          <div id="link">
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              style={{
                ...card,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 15px',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--ink)',
                font: `600 13px/1 ${FONT}`,
              }}
            >
              <DcIcon name="icon-settings" size={14} />
              <span style={{ flex: 1 }}>Bot setup · token, chat ID, admin linking</span>
              <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {setupOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {setupOpen ? (
              <div style={{ marginTop: 12 }}>
                <TelegramBotConfigPanel embedded />
              </div>
            ) : null}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .dc-telegram-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
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
    <div style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          font: `600 11px/1 ${FONT}`,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      <span style={{ font: `700 26px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}>
        {value}
      </span>
      <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
