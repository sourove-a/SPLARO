'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import type { AdminSettingsData } from '@/lib/api/settings'
import { SectionCard, SectionPageHeader, FieldGrid, Field, Toggle, SaveBar, type SectionProps } from './shared'

function defaultTelegram(): NonNullable<AdminSettingsData['telegram']> {
  return {
    botToken: '',
    chatId: '',
    isActive: false,
    notifyOrders: true,
    notifyPayments: true,
    notifyCourier: true,
    notifyStock: false,
    reportDaily: false,
  }
}

interface Props extends SectionProps {
  subscriberData: { subscribers?: { id: string; email: string; createdAt: string }[]; total?: number } | undefined
  onRefreshSubscribers: () => void
}

export function NotificationsSection({ draft, setDraft, save, saving, apiOnline, subscriberData, onRefreshSubscribers }: Props) {
  const [showPass, setShowPass] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Mail size={22} />}
        title="Notifications"
        subtitle="SMTP email configuration, Telegram alerts, and newsletter subscribers."
        badge="Comms"
      />
      {/* Email / SMTP */}
      <SectionCard title="Email (SMTP)" subtitle="Transactional emails: order confirmation, shipping updates.">
        <div style={{ marginBottom: "1rem" }}>
          <Toggle
            label="Enable email notifications"
            desc="Send order and account emails via SMTP."
            checked={draft.emailEnabled}
            onChange={() => setDraft((p) => ({ ...p, emailEnabled: !p.emailEnabled }))}
          />
        </div>
        {draft.emailEnabled && (
          <FieldGrid>
            <Field label="SMTP host">
              <input
                className="settings-input"
                placeholder="smtp.gmail.com"
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
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--admin-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
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
                placeholder="hello@splaro.com"
                value={draft.smtp.fromEmail}
                onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, fromEmail: e.target.value } }))}
              />
            </Field>
            <div className="md:col-span-2">
              <Toggle
                label="TLS / secure connection"
                desc="Enable for port 465. Disable for port 587 with STARTTLS."
                checked={draft.smtp.secure}
                onChange={() => setDraft((p) => ({ ...p, smtp: { ...p.smtp, secure: !p.smtp.secure } }))}
              />
            </div>
          </FieldGrid>
        )}
        <SaveBar label="Save email settings" saving={saving} disabled={!apiOnline} onClick={() => save({ emailEnabled: draft.emailEnabled, smtp: draft.smtp }, 'Email settings')} />
      </SectionCard>

      {/* Telegram */}
      <SectionCard title="Telegram notifications" subtitle="Push order alerts to a Telegram bot or group.">
        <FieldGrid>
          <Field label="Bot token">
            <input
              className="settings-input"
              placeholder="123456789:AAF…"
              value={draft.telegram?.botToken ?? ''}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  telegram: { ...(p.telegram ?? defaultTelegram()), botToken: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Chat ID">
            <input
              className="settings-input"
              placeholder="-100XXXXXXXXXX"
              value={draft.telegram?.chatId ?? ''}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  telegram: { ...(p.telegram ?? defaultTelegram()), chatId: e.target.value },
                }))
              }
            />
          </Field>
        </FieldGrid>
        <SaveBar
          label="Save Telegram"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ telegram: draft.telegram ?? null }, 'Telegram')}
        />
      </SectionCard>

      {/* Newsletter subscribers */}
      <SectionCard title="Newsletter subscribers" subtitle="Emails collected from the storefront newsletter signup.">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
            {subscriberData?.total != null ? `${subscriberData.total} subscribers` : 'Loading…'}
          </p>
          <button
            type="button"
            style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5e7cff', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={onRefreshSubscribers}
          >
            Refresh ↻
          </button>
        </div>
        {subscriberData?.subscribers && subscriberData.subscribers.length > 0 ? (
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.72)', overflow: 'hidden', background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(12px)' }}>
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.28))', borderBottom: '1px solid rgba(255,255,255,0.55)' }}>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>Email</th>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {subscriberData.subscribers.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.45)' }}>
                    <td style={{ padding: '0.625rem 1rem', color: 'var(--admin-text)', fontWeight: 600 }}>{s.email}</td>
                    <td style={{ padding: '0.625rem 1rem', color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
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
