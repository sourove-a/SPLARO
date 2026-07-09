'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import { TelegramBotConfigPanel } from '@/components/modules/TelegramBotConfigPanel'
import { sendSmtpTestEmail, verifySmtpConnection } from '@/lib/api/settings'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { SectionCard, SectionPageHeader, FieldGrid, Field, Toggle, SaveBar, type SectionProps } from './shared'

const HOSTINGER_SMTP = {
  host: 'smtp.hostinger.com',
  port: 587,
  secure: false,
  user: 'noreply@splaro.co',
  fromName: 'SPLARO',
  fromEmail: 'noreply@splaro.co',
  replyTo: 'support@splaro.co',
} as const

/** Hostinger aliases on noreply@splaro.co mailbox */
const EMAIL_ALIASES = [
  { label: 'noreply', email: 'noreply@splaro.co', role: 'From — automated (orders, password reset)' },
  { label: 'support', email: 'support@splaro.co', role: 'Reply-to — customer replies' },
  { label: 'hello', email: 'hello@splaro.co', role: 'From — welcome & marketing' },
  { label: 'info', email: 'info@splaro.co', role: 'From — general info' },
] as const

interface Props extends SectionProps {
  subscriberData: { subscribers?: { id: string; email: string; createdAt: string }[]; total?: number } | undefined
  onRefreshSubscribers: () => void
}

export function NotificationsSection({ draft, setDraft, save, saving, apiOnline, subscriberData, onRefreshSubscribers }: Props) {
  const [showPass, setShowPass] = useState(false)
  const [testing, setTesting] = useState<'verify' | 'send' | null>(null)
  const [testEmailTo, setTestEmailTo] = useState('')

  const applyHostingerPreset = () => {
    setDraft((p) => ({
      ...p,
      emailEnabled: true,
      smtp: {
        ...p.smtp,
        enabled: true,
        ...HOSTINGER_SMTP,
        password: p.smtp.password,
      },
    }))
  }

  const applyAlias = (email: string, as: 'from' | 'reply') => {
    setDraft((p) => ({
      ...p,
      smtp: {
        ...p.smtp,
        ...(as === 'from' ? { fromEmail: email, user: 'noreply@splaro.co' } : { replyTo: email }),
      },
    }))
  }

  const handleVerify = async () => {
    setTesting('verify')
    try {
      const result = await verifySmtpConnection()
      if (result.ok) toastOk(result.message)
      else toastFail(result.message)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'SMTP verify failed')
    } finally {
      setTesting(null)
    }
  }

  const handleSendTest = async () => {
    const to = testEmailTo.trim() || draft.store.email.trim()
    if (!to) {
      toastFail('Enter a test email address or set store email in General settings.')
      return
    }
    setTesting('send')
    try {
      const result = await sendSmtpTestEmail(to)
      if (result.ok) toastOk(`Test email sent to ${to}`)
      else toastFail('Test email failed — check SMTP host, user, and password.')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Test email failed')
    } finally {
      setTesting(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Mail size={22} />}
        title="Notifications"
        subtitle="SMTP email, Telegram bot (token + chat ID + alerts), and newsletter subscribers."
        badge="Comms"
      />

      <SectionCard
        title="Email (SMTP)"
        subtitle="Hostinger mailbox noreply@splaro.co — aliases info@, hello@, support@ share the same password."
      >
        <div style={{ marginBottom: '1rem' }}>
          <Toggle
            label="Enable email notifications"
            desc="Order confirmations, password reset, shipping updates."
            checked={draft.emailEnabled}
            onChange={() => setDraft((p) => ({ ...p, emailEnabled: !p.emailEnabled, smtp: { ...p.smtp, enabled: !p.emailEnabled } }))}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" className="settings-text-link" style={{ fontSize: '0.8125rem' }} onClick={applyHostingerPreset}>
            Apply Hostinger preset
          </button>
          {EMAIL_ALIASES.map((alias) => (
            <button
              key={alias.email}
              type="button"
              className="settings-text-link"
              style={{ fontSize: '0.75rem', opacity: 0.85 }}
              title={alias.role}
              onClick={() => applyAlias(alias.email, alias.label === 'support' ? 'reply' : 'from')}
            >
              {alias.email}
            </button>
          ))}
        </div>

        {draft.emailEnabled && (
          <FieldGrid>
            <Field label="SMTP host">
              <input
                className="settings-input"
                placeholder="smtp.hostinger.com"
                value={draft.smtp.host}
                onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, host: e.target.value } }))}
              />
            </Field>
            <Field label="Port">
              <input
                className="settings-input"
                type="number"
                value={draft.smtp.port}
                onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, port: Number(e.target.value) } }))}
              />
            </Field>
            <Field label="Username / email">
              <input
                className="settings-input"
                placeholder="noreply@splaro.co"
                value={draft.smtp.user}
                onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, user: e.target.value } }))}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  className="settings-input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Leave blank to keep current"
                  value={draft.smtp.password}
                  onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, password: e.target.value } }))}
                />
                <button
                  type="button"
                  className="settings-text-link"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <Field label="From name">
              <input
                className="settings-input"
                placeholder="SPLARO"
                value={draft.smtp.fromName}
                onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, fromName: e.target.value } }))}
              />
            </Field>
            <Field label="From email">
              <input
                className="settings-input"
                type="email"
                placeholder="noreply@splaro.co"
                value={draft.smtp.fromEmail}
                onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, fromEmail: e.target.value } }))}
              />
            </Field>
            <Field label="Reply-to">
              <input
                className="settings-input"
                type="email"
                placeholder="support@splaro.co"
                value={draft.smtp.replyTo ?? ''}
                onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, replyTo: e.target.value } }))}
              />
            </Field>
            <div className="md:col-span-2">
              <Toggle
                label="TLS / secure connection"
                desc="Enable for port 465. Disable for port 587 with STARTTLS (Hostinger)."
                checked={draft.smtp.secure}
                onChange={() => setDraft((p) => ({ ...p, smtp: { ...p.smtp, secure: !p.smtp.secure } }))}
              />
            </div>
          </FieldGrid>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <SaveBar
            label="Save email settings"
            saving={saving}
            disabled={!apiOnline}
            onClick={() => {
              const { password, ...rest } = draft.smtp
              const smtpPayload = password?.trim() ? draft.smtp : rest
              save({ emailEnabled: draft.emailEnabled, smtp: smtpPayload as typeof draft.smtp }, 'Email settings')
            }}
          />
          {draft.emailEnabled ? (
            <>
              <button
                type="button"
                className="settings-text-link"
                disabled={!apiOnline || testing !== null}
                onClick={() => void handleVerify()}
              >
                {testing === 'verify' ? 'Verifying…' : 'Verify connection'}
              </button>
              <input
                className="settings-input"
                type="email"
                placeholder={draft.store.email || 'Test recipient email'}
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                style={{ maxWidth: 240, fontSize: '0.8125rem' }}
              />
              <button
                type="button"
                className="settings-text-link"
                disabled={!apiOnline || testing !== null}
                onClick={() => void handleSendTest()}
              >
                {testing === 'send' ? 'Sending…' : 'Send test email'}
              </button>
            </>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Telegram Bot"
        subtitle="Bot token, chat ID, and alert toggles — one save to encrypted database (.env ignored after first save)."
      >
        <TelegramBotConfigPanel embedded />
      </SectionCard>

      <SectionCard title="Newsletter subscribers" subtitle="Emails collected from the storefront newsletter signup.">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
            {subscriberData?.total != null ? `${subscriberData.total} subscribers` : 'Loading…'}
          </p>
          <button type="button" className="settings-text-link" onClick={onRefreshSubscribers}>
            Refresh ↻
          </button>
        </div>
        {subscriberData?.subscribers && subscriberData.subscribers.length > 0 ? (
          <div className="settings-data-table-wrap">
            <table className="settings-data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {subscriberData.subscribers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--admin-text)', fontWeight: 600 }}>{s.email}</td>
                    <td style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
                      {new Date(s.createdAt).toLocaleDateString('en-BD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No subscribers yet.</p>
        )}
      </SectionCard>
    </div>
  )
}
