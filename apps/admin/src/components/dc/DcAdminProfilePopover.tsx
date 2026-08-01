'use client'

import { useEffect, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { changeAdminPassword } from '@/lib/api/auth-profile'
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
  presence?: PresenceSnapshot | null
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
  presence,
}: DcAdminProfilePopoverProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const ipLine = clientIp?.trim() || lastLoginIp?.trim() || '—'
  const liveUsers = presence
    ? `${presence.storefront} storefront · ${presence.admin} staff`
    : '—'

  const submitPassword = async () => {
    if (newPassword.length < 8) {
      toastFail('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toastFail('New password and confirm do not match.')
      return
    }
    setSaving(true)
    try {
      await changeAdminPassword(currentPassword, newPassword)
      toastOk('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSaving(false)
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
          background: 'rgba(0,0,0,.35)',
          cursor: 'default',
        }}
      />
      <div
        role="dialog"
        aria-label="Admin profile"
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 90,
          width: 'min(360px, calc(100vw - 32px))',
          borderRadius: 14,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
          boxShadow: '0 18px 48px rgba(0,0,0,.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--violet-solid)',
              color: 'var(--on-violet)',
              font: `700 14px/1 ${FONT}`,
            }}
          >
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 14px/1.2 ${FONT}`, color: 'var(--ink)' }}>{name}</div>
            <div
              style={{
                font: `500 12px/1.3 ${FONT}`,
                color: 'var(--ink-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {email || '—'}
            </div>
          </div>
          <span
            style={{
              padding: '4px 8px',
              borderRadius: 7,
              border: '1px solid var(--violet-bd)',
              background: 'var(--violet-soft)',
              color: 'var(--violet)',
              font: `600 11px/1 ${FONT}`,
            }}
          >
            {role}
          </span>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ProfileRow icon="icon-users" label="Live now" value={liveUsers} />
          <ProfileRow icon="icon-globe" label="Your IP" value={ipLine} mono />
          {lastLoginAt ? (
            <ProfileRow
              icon="icon-clock"
              label="Last login"
              value={new Date(lastLoginAt).toLocaleString()}
            />
          ) : null}
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
              disabled={saving}
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
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '10px 16px 12px',
              borderTop: '1px solid var(--line)',
              font: `500 11.5px/1.45 ${FONT}`,
              color: 'var(--ink-3)',
            }}
          >
            Owner / Admin accounts sign in with Telegram code — password change is for Manager &
            Editor (sub-admin) accounts.
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px 12px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 9,
              border: '1px solid var(--line-2)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `600 12.5px/1 ${FONT}`,
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
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              borderRadius: 9,
              border: '1px solid color-mix(in srgb, var(--bad) 35%, var(--line))',
              background: 'var(--surface)',
              color: 'var(--bad)',
              font: `600 12.5px/1 ${FONT}`,
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
  mono,
}: {
  icon: string
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'var(--surface-2)',
          color: 'var(--ink-3)',
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
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            font: mono ? `600 12.5px/1.3 ${MONO}` : `600 12.5px/1.3 ${FONT}`,
            color: 'var(--ink)',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </div>
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
