'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, Mail, Plus, Power, Server, Trash2, XCircle } from 'lucide-react'
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
  const [accountHealth, setAccountHealth] = useState<Record<string, { ok: boolean; message: string }>>({})

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

  const addSmtpAccount = () => {
    if (!draft.smtp.host.trim() || !draft.smtp.user.trim() || !draft.smtp.fromEmail.trim()) {
      toastFail('Host, username, and From email are required.')
      return
    }
    if (!draft.smtp.password.trim()) {
      toastFail('Enter app password for new SMTP account.')
      return
    }
    const account = {
      ...draft.smtp,
      id: `smtp-${Date.now()}`,
      label: draft.smtp.fromEmail.trim(),
      priority: draft.smtpAccounts.length + 1,
      enabled: true,
    }
    const smtpAccounts = [...draft.smtpAccounts, account]
    setDraft((p) => ({ ...p, smtpAccounts }))
    save({ smtpAccounts }, 'SMTP account', () => toastOk(`${account.label} added to delivery pool.`))
  }

  const testSmtpAccount = async (id: string) => {
    setTesting('verify')
    try {
      const result = await verifySmtpConnection(id)
      setAccountHealth((p) => ({ ...p, [id]: result }))
      if (result.ok) toastOk(result.message)
      else toastFail(result.message)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SMTP verification failed'
      setAccountHealth((p) => ({ ...p, [id]: { ok: false, message } }))
      toastFail(message)
    } finally {
      setTesting(null)
    }
  }

  const updateSmtpAccounts = (smtpAccounts: typeof draft.smtpAccounts, label: string) => {
    setDraft((p) => ({ ...p, smtpAccounts }))
    save({ smtpAccounts }, label)
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
      if (result.ok) toastOk(result.message)
      else toastFail(result.message)
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
            label="Send automatic customer emails"
            desc="ON: new orders receive confirmation and invoice. OFF: no automatic order email. Password recovery and manual test remain available."
            checked={draft.emailEnabled}
            onChange={() => setDraft((p) => ({ ...p, emailEnabled: !p.emailEnabled, smtp: { ...p.smtp, enabled: !p.emailEnabled } }))}
          />
        </div>

        <div className="smtp-pool">
          <div className="smtp-pool__head" style={{ marginBottom: draft.smtpAccounts.length ? 12 : 0 }}>
            <div>
              <p className="smtp-pool__title">SMTP delivery pool</p>
              <p className="smtp-pool__meta">{draft.smtpAccounts.length} saved account{draft.smtpAccounts.length === 1 ? '' : 's'} · priority failover enabled</p>
            </div>
            <button type="button" className="admin-btn admin-btn--dark smtp-pool__add" onClick={addSmtpAccount} disabled={saving || !apiOnline}>
              <Plus size={14} strokeWidth={1.75} /> Add SMTP account
            </button>
          </div>
          {draft.smtpAccounts.length === 0 ? (
            <div className="smtp-pool__empty">
              No saved pool accounts. Fill the form below, enter the app password, then click <strong>Add SMTP account</strong>. When one mailbox fails, the next in priority is used automatically.
            </div>
          ) : (
            <div className="smtp-pool__list">
              {draft.smtpAccounts.map((account, index) => {
                const persistedHealth = account.lastTestStatus
                  ? { ok: account.lastTestStatus === 'success', message: account.lastTestMessage || '' }
                  : undefined
                const health = accountHealth[account.id] ?? persistedHealth
                const healthState = health ? (health.ok ? 'ok' : 'fail') : 'untested'
                return (
                  <div key={account.id} className="smtp-account" data-health={healthState} data-disabled={!account.enabled}>
                    <div className="smtp-account__row">
                      <div className="smtp-account__badge"><Server size={16} strokeWidth={1.75} /></div>
                      <div className="smtp-account__info">
                        <p className="smtp-account__name">{account.label || account.fromEmail}</p>
                        <p className="smtp-account__sub">#{index + 1} · {account.host}:{account.port} · {account.user}</p>
                      </div>
                      <span className="smtp-account__status" data-health={healthState}>
                        {health ? (health.ok ? <CheckCircle2 size={14} strokeWidth={1.75} /> : <XCircle size={14} strokeWidth={1.75} />) : <Power size={14} strokeWidth={1.75} />}
                        {health ? (health.ok ? 'Connected' : 'Failed') : 'Not tested'}
                      </span>
                      <button type="button" className="settings-text-link" disabled={testing !== null} onClick={() => void testSmtpAccount(account.id)}>Test</button>
                      <button type="button" className="settings-text-link" onClick={() => updateSmtpAccounts(draft.smtpAccounts.map((item) => item.id === account.id ? { ...item, enabled: !item.enabled } : item), 'SMTP account status')}>{account.enabled ? 'Disable' : 'Enable'}</button>
                      <button
                        type="button"
                        aria-label={`Delete ${account.label}`}
                        className="smtp-account__delete"
                        onClick={() => {
                          const label = account.label || account.fromEmail || 'this account'
                          if (
                            !window.confirm(
                              `Remove SMTP account "${label}"? This saves immediately.`,
                            )
                          ) {
                            return
                          }
                          updateSmtpAccounts(
                            draft.smtpAccounts
                              .filter((item) => item.id !== account.id)
                              .map((item, i) => ({ ...item, priority: i + 1 })),
                            'SMTP account removed',
                          )
                        }}
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                    {health && !health.ok ? <p className="smtp-account__error">{health.message}</p> : null}
                  </div>
                )
              })}
            </div>
          )}
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
        id="telegram"
        title="Telegram Bot"
        subtitle="Ops alerts, OTP login, and bot token live on the dedicated Telegram screen."
      >
        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
          Token, chat ID, admin linking, and alert toggles are verified there — not duplicated in Settings.
        </p>
        <Link href="/dashboard/telegram-bot" className="settings-text-link">
          Open Telegram Bot screen →
        </Link>
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
