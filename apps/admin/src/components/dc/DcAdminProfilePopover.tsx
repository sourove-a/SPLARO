'use client'

import { useEffect, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastFail, toastInfo, toastOk } from '@/lib/admin/feedback'
import { changeAdminPassword, updateAdminProfile } from '@/lib/api/auth-profile'
import type { PresenceSnapshot } from '@/lib/api/presence'

export interface DcAdminProfilePopoverProps {
  open: boolean
  onClose: () => void
  onSignOut?: (() => void) | undefined
  name: string
  email: string
  role: string
  initials: string
  clientIp?: string | null
  lastLoginIp?: string | null
  lastLoginAt?: string | null
  canChangePassword?: boolean
  canEditProfile?: boolean
  onNameSaved?: ((name: string) => void) | undefined
  presence?: PresenceSnapshot | null
}

function normalizeIpAddress(value?: string | null): string | null {
  const raw = value?.trim()
  if (!raw || raw.toLowerCase() === 'unknown') return null

  const unwrapped = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
  if (unwrapped.toLowerCase().startsWith('::ffff:')) return unwrapped.slice(7)
  if (unwrapped === '::1') return '127.0.0.1'
  return unwrapped
}

function formatLastLogin(value?: string | null): string {
  if (!value) return 'Not recorded yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded yet'

  return date
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', ' ·')
    .replace(/\b(am|pm)\b/i, (part) => part.toUpperCase())
}

export function DcAdminProfilePopover({
  open,
  onClose,
  onSignOut,
  name,
  email,
  role,
  initials,
  clientIp,
  lastLoginIp,
  lastLoginAt,
  canChangePassword = false,
  canEditProfile = false,
  onNameSaved,
  presence,
}: DcAdminProfilePopoverProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState(name)
  const [saving, setSaving] = useState<'name' | 'password' | null>(null)

  useEffect(() => {
    if (open) setDisplayName(name)
  }, [open, name])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const currentIp = normalizeIpAddress(clientIp)
  const previousIp = normalizeIpAddress(lastLoginIp)
  const ipLine = currentIp ?? previousIp ?? 'Unavailable'
  const ipLabel = currentIp ? 'Current IP' : previousIp ? 'Last known IP' : 'IP address'
  const ipContext = currentIp
    ? currentIp === '127.0.0.1'
      ? 'Local development session'
      : 'Current admin session'
    : previousIp
      ? 'Last verified login address'
      : 'Proxy did not provide an address'
  const liveUsers = presence
    ? `${presence.storefront} storefront · ${presence.admin} staff`
    : 'Presence unavailable'
  const lastLoginLabel = formatLastLogin(lastLoginAt)
  const lastLoginContext = previousIp ? `From ${previousIp}` : 'Login IP not recorded'

  const submitPassword = async () => {
    if (newPassword.length < 8) {
      toastFail('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toastFail('New password and confirm do not match.')
      return
    }
    setSaving('password')
    try {
      await changeAdminPassword(currentPassword, newPassword)
      toastOk('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSaving(null)
    }
  }

  const submitName = async () => {
    const next = displayName.trim()
    if (!next) {
      toastFail('Name is required')
      return
    }
    if (next === name.trim()) {
      toastInfo('Name is already saved')
      return
    }
    setSaving('name')
    try {
      const saved = await updateAdminProfile(next)
      const savedName = saved.user?.name?.trim() || next
      toastOk('Name updated')
      onNameSaved?.(savedName)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update name')
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close profile"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          border: 0,
          background: 'var(--overlay)',
          cursor: 'default',
        }}
      />
      <div
        role="dialog"
        className="dc-popover-card dc-popover-card--profile"
        aria-label="Admin profile"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: 14,
          bottom: 14,
          zIndex: 90,
          width: 'min(384px, calc(100vw - 28px))',
          maxHeight: 'calc(100dvh - 28px)',
          borderRadius: 18,
          // No shadows in this design — depth is the border plus the card sheen.
          border: '1px solid var(--line-2)',
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <div
          className="dc-popover-card__header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            padding: '16px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              borderRadius: 13,
              border: '1px solid var(--violet-bd)',
              background:
                'linear-gradient(145deg, color-mix(in srgb, var(--violet-solid) 88%, white), var(--violet-solid))',
              color: 'var(--on-violet)',
              font: `750 15px/1 ${FONT}`,
              letterSpacing: '-.02em',
            }}
          >
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `750 14.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>{name}</div>
            <div
              style={{
                marginTop: 3,
                font: `500 11.5px/1.3 ${FONT}`,
                color: 'var(--ink-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {email || '—'}
            </div>
          </div>
          <button
            type="button"
            className="dc-popover-card__close-btn dc-hover-surface"
            aria-label="Close profile"
            onClick={onClose}
            style={{
              display: 'none',
              placeItems: 'center',
              width: 28,
              height: 28,
              borderRadius: 7,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <DcIcon name="icon-x" size={14} />
          </button>
          <span
            style={{
              padding: '5px 9px',
              borderRadius: 999,
              border: '1px solid var(--violet-bd)',
              background: 'var(--violet-soft)',
              color: 'var(--violet)',
              font: `700 10.5px/1 ${FONT}`,
            }}
          >
            {role}
          </span>
        </div>

        {canEditProfile ? (
          <div
            style={{
              padding: '12px 16px 4px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink)' }}>Display name</div>
            <ProfileInput
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={setDisplayName}
              autoComplete="name"
            />
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void submitName()}
              style={{
                height: 34,
                borderRadius: 9,
                border: 0,
                background: 'var(--violet-solid)',
                color: 'var(--on-violet)',
                font: `600 12.5px/1 ${FONT}`,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving === 'name' ? 'Saving…' : 'Save name'}
            </button>
          </div>
        ) : null}

        <div style={{ padding: '14px 14px 2px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 2px 9px',
            }}
          >
            <span
              style={{
                font: `700 10px/1 ${FONT}`,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              Session overview
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                font: `700 10px/1 ${FONT}`,
                color: presence ? 'var(--ok)' : 'var(--ink-3)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: presence ? 'var(--ok)' : 'var(--ink-3)',
                }}
              />
              {presence ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div
            style={{
              overflow: 'hidden',
              border: '1px solid var(--line)',
              borderRadius: 13,
              background: 'color-mix(in srgb, var(--surface-2) 62%, var(--surface))',
            }}
          >
            <ProfileRow
              icon="icon-users"
              label="Live now"
              value={liveUsers}
              detail={presence ? 'Real-time storefront and staff activity' : 'Waiting for API'}
              {...(presence ? { tone: 'ok' as const } : {})}
            />
            <ProfileRow
              icon="icon-globe"
              label={ipLabel}
              value={ipLine}
              detail={ipContext}
              mono
              divided
            />
            <ProfileRow
              icon="icon-clock"
              label="Last login"
              value={lastLoginLabel}
              detail={lastLoginContext}
              divided
            />
          </div>
        </div>

        {canChangePassword ? (
          <div
            style={{
              padding: '12px 16px 14px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink)' }}>Change password</div>
            <ProfileInput
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <ProfileInput
              type="password"
              placeholder="New password (min 8)"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <ProfileInput
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void submitPassword()}
              style={{
                height: 34,
                borderRadius: 9,
                border: 0,
                background: 'var(--violet-solid)',
                color: 'var(--on-violet)',
                font: `600 12.5px/1 ${FONT}`,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving === 'password' ? 'Saving…' : 'Update password'}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              margin: '12px 14px 2px',
              padding: '11px 12px',
              border: '1px solid var(--violet-bd)',
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--violet-soft) 72%, var(--surface))',
            }}
          >
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 28,
                height: 28,
                flex: 'none',
                borderRadius: 9,
                background: 'var(--violet-soft)',
                color: 'var(--violet)',
              }}
            >
              <DcIcon name="icon-shield-check" size={14} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `700 11.5px/1.25 ${FONT}`, color: 'var(--ink)' }}>
                Telegram-protected access
              </div>
              <div
                style={{
                  marginTop: 3,
                  font: `500 10.8px/1.45 ${FONT}`,
                  color: 'var(--ink-3)',
                }}
              >
                Owner and Admin use Telegram code. Password controls appear for Manager and Editor
                accounts.
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 14px 14px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 11,
              border: '1px solid var(--line-2)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `650 12.5px/1 ${FONT}`,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onSignOut?.()}
            style={{
              flex: 1,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              borderRadius: 11,
              border: '1px solid color-mix(in srgb, var(--bad) 35%, var(--line))',
              background: 'var(--surface)',
              color: 'var(--bad)',
              font: `650 12.5px/1 ${FONT}`,
              cursor: 'pointer',
            }}
          >
            <DcIcon name="icon-log-out" size={14} />
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}

function ProfileRow({
  icon,
  label,
  value,
  detail,
  mono,
  divided,
  tone,
}: {
  icon: string
  label: string
  value: string
  detail?: string
  mono?: boolean
  divided?: boolean
  tone?: 'ok'
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
        minHeight: 58,
        padding: '10px 11px',
        borderTop: divided ? '1px solid var(--line)' : undefined,
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 30,
          height: 30,
          borderRadius: 9,
          border: `1px solid ${tone === 'ok' ? 'var(--ok-bd)' : 'var(--line)'}`,
          background: tone === 'ok' ? 'var(--ok-soft)' : 'var(--surface)',
          color: tone === 'ok' ? 'var(--ok)' : 'var(--ink-3)',
          flex: 'none',
        }}
      >
        <DcIcon name={icon} size={14} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            font: `600 10.5px/1 ${FONT}`,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div
          style={{
            font: mono ? `650 12.5px/1.3 ${MONO}` : `650 12.5px/1.3 ${FONT}`,
            color: 'var(--ink)',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </div>
        {detail ? (
          <div
            style={{
              marginTop: 2,
              font: `500 10.5px/1.35 ${FONT}`,
              color: 'var(--ink-3)',
              wordBreak: 'break-word',
            }}
          >
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProfileInput({
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  type: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 34,
        padding: '0 11px',
        borderRadius: 9,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        color: 'var(--ink)',
        font: `500 12.5px/1 ${FONT}`,
        outline: 'none',
      }}
    />
  )
}
