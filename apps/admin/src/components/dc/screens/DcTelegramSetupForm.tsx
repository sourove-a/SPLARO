'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Eye, EyeOff, Link2, Unlink } from 'lucide-react'

import { AdminButton } from '@/components/ui/AdminButton'
import { DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO } from '@/components/dc/tokens'
import {
  confirmTelegramAdminUnlinked,
  confirmTelegramSettingsSaved,
  confirmTelegramTestSent,
} from '@/lib/admin/integration-save'
import { confirmTelegramLinkTokenGenerated } from '@/lib/admin/security-save'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import {
  useGenerateTelegramLinkToken,
  useTelegramHealth,
  useTelegramIntegration,
  useTelegramLinkedAdmins,
  useTestTelegramIntegration,
  useUnlinkTelegramAdmin,
  useUpdateTelegramIntegration,
} from '@/lib/api/integration-hooks'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

/**
 * Pure DC Telegram bot setup — token, chat, enable, admin link, save/test.
 * Used by DcTelegramBot (live sidebar). Settings Notifications can keep the old panel.
 */
export function DcTelegramSetupForm() {
  const [showToken, setShowToken] = useState(false)
  const [botTokenInput, setBotTokenInput] = useState('')
  const [chatId, setChatId] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [linkToken, setLinkToken] = useState<string | null>(null)

  const { data, refetch } = useTelegramIntegration()
  const { data: health, refetch: refetchHealth } = useTelegramHealth()
  const { data: linkedData, refetch: refetchLinked } = useTelegramLinkedAdmins()
  const saveMutation = useUpdateTelegramIntegration()
  const testMutation = useTestTelegramIntegration()
  const linkTokenMutation = useGenerateTelegramLinkToken()
  const unlinkMutation = useUnlinkTelegramAdmin()

  useEffect(() => {
    if (!data) return
    setChatId(data.chatId ?? '')
    setIsEnabled(data.isEnabled ?? true)
    setBotTokenInput('')
  }, [data])

  const tokenConfigured = Boolean(data?.tokenConfigured)
  const connected = Boolean(tokenConfigured && chatId.trim() && isEnabled && health?.botRunning)

  const handleSave = async () => {
    if (botTokenInput.trim() === '' && !tokenConfigured) {
      toastFail('Bot token is required.', 'tg-missing-token')
      return
    }
    if (!chatId.trim()) {
      toastFail('Chat ID is required.', 'tg-missing-chat')
      return
    }
    const expected = {
      chatId: chatId.trim(),
      isEnabled,
      notifyOrders: data?.notifyOrders ?? true,
      notifyCustomers: data?.notifyCustomers ?? true,
      notifyPayments: data?.notifyPayments ?? true,
      notifyCourier: data?.notifyCourier ?? true,
      notifyStock: data?.notifyStock ?? true,
      notifyReviews: data?.notifyReviews ?? true,
      reportDaily: data?.reportDaily ?? true,
      reportTime: data?.reportTime ?? '09:00',
      requireTokenConfigured: true as const,
    }
    const ok = await confirmTelegramSettingsSaved(expected, () => {
      const payload: Record<string, unknown> = {
        chatId: expected.chatId,
        isEnabled,
        notifyOrders: expected.notifyOrders,
        notifyCustomers: expected.notifyCustomers,
        notifyPayments: expected.notifyPayments,
        notifyCourier: expected.notifyCourier,
        notifyStock: expected.notifyStock,
        notifyReviews: expected.notifyReviews,
        reportDaily: expected.reportDaily,
        reportTime: expected.reportTime,
      }
      if (botTokenInput.trim()) payload.botToken = botTokenInput.trim()
      return saveMutation.mutateAsync(payload as never)
    })
    if (!ok) return
    setBotTokenInput('')
    void refetch()
    void refetchHealth()
  }

  const handleTest = async () => {
    const ok = await confirmTelegramTestSent(() =>
      testMutation.mutateAsync('✅ SPLARO — Telegram test from admin panel.'),
    )
    if (ok) void refetchHealth()
  }

  const handleGenerateLinkToken = async () => {
    const result = await confirmTelegramLinkTokenGenerated(
      () => linkTokenMutation.mutateAsync(),
      'tg-link-ok',
    )
    if (!result) return
    setLinkToken(result.code)
    void refetchLinked()
    void refetchHealth()
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
    const ok = await confirmTelegramAdminUnlinked(id, () => unlinkMutation.mutateAsync(id))
    if (ok) {
      void refetchLinked()
      void refetchHealth()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          font: `600 11.5px/1 ${FONT}`,
        }}
      >
        <span
          style={{
            padding: '5px 10px',
            borderRadius: 8,
            border: `1px solid ${connected ? 'var(--ok-bd, var(--line))' : 'var(--warn-bd, var(--line))'}`,
            background: connected ? 'var(--ok-soft, var(--surface-2))' : 'var(--warn-soft, var(--surface-2))',
            color: connected ? 'var(--ok)' : 'var(--warn)',
          }}
        >
          {connected ? 'Connected' : tokenConfigured ? 'Token saved — add chat ID & enable' : 'Not configured'}
        </span>
        {data?.lastTestedAt ? (
          <span style={{ color: 'var(--ink-3)' }}>Last test: {new Date(data.lastTestedAt).toLocaleString()}</span>
        ) : null}
      </div>

      <div style={{ ...card, padding: 16, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <DcField label="Bot token" hint={tokenConfigured ? 'Leave blank to keep saved encrypted token.' : 'From BotFather.'}>
          <div style={{ position: 'relative' }}>
            <DcInput
              mono
              type={showToken ? 'text' : 'password'}
              value={botTokenInput}
              onChange={(e) => setBotTokenInput(e.target.value)}
              placeholder={tokenConfigured ? `Saved (${data?.botToken ?? '••••'})` : '123456789:ABC…'}
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {tokenConfigured ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ok)' }}>
              <CheckCircle2 size={12} /> Token saved (encrypted)
            </span>
          ) : null}
        </DcField>

        <DcField
          label="Chat ID"
          hint="Group: add bot → /link_group. BotFather /setprivacy → Disable for groups."
        >
          <DcInput
            mono
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-100… or personal ID"
          />
        </DcField>
      </div>

      <div
        style={{
          ...card,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <p style={{ margin: 0, font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>Enable bot</p>
          <p style={{ margin: '4px 0 0', font: `500 11.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
            Notifications when active
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => setIsEnabled((v) => !v)}
          style={{
            width: 44,
            height: 26,
            borderRadius: 99,
            border: '1px solid var(--line)',
            background: isEnabled ? 'var(--violet-solid, var(--violet))' : 'var(--surface-2)',
            position: 'relative',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: isEnabled ? 20 : 2,
              width: 20,
              height: 20,
              borderRadius: 99,
              background: 'var(--on-violet)',
              transition: 'left 120ms',
            }}
          />
        </button>
      </div>

      <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>Admin linking</p>
        <p style={{ margin: 0, font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Generate a link token, open the bot, send <code style={{ fontFamily: MONO }}>/login XXXX-XXXX</code>.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <AdminButton
            loading={linkTokenMutation.isPending}
            onClick={() => void handleGenerateLinkToken()}
            disabled={!tokenConfigured || !isEnabled}
          >
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
        {(linkedData?.linked.length ?? 0) > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linkedData?.linked.map((admin) => (
              <div
                key={admin.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                }}
              >
                <div>
                  <p style={{ margin: 0, font: `700 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    {admin.username ? `@${admin.username}` : admin.telegramIdMasked}
                  </p>
                  <p style={{ margin: '2px 0 0', font: `500 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                    {admin.role.replace(/_/g, ' ')} · ID {admin.telegramIdMasked}
                  </p>
                </div>
                <AdminButton variant="ghost" size="sm" loading={unlinkMutation.isPending} onClick={() => void handleUnlink(admin.id)}>
                  <Unlink className="h-3.5 w-3.5" />
                  Unlink
                </AdminButton>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            No linked admin Telegram accounts yet.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <AdminButton variant="accent" loading={saveMutation.isPending} onClick={() => void handleSave()}>
          Save to database
        </AdminButton>
        <AdminButton
          loading={testMutation.isPending}
          onClick={() => void handleTest()}
          disabled={!tokenConfigured || !chatId.trim()}
        >
          Test connection
        </AdminButton>
      </div>
    </div>
  )
}
