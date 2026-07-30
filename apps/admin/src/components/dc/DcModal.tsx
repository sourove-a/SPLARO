'use client'

import { useEffect, type ReactNode } from 'react'

import { DcIcon } from './DcIcon'
import { FONT } from './tokens'

export interface DcModalProps {
  open: boolean
  title: string
  /** One line under the title — say what saving will actually do. */
  subtitle?: string | undefined
  confirmLabel: string
  /** Set for destructive confirms so the primary button reads as danger. */
  danger?: boolean | undefined
  busy?: boolean | undefined
  onClose: () => void
  onConfirm: () => void
  children?: ReactNode
}

/** Modal shell in the design's surface treatment. Escape and backdrop both close. */
export function DcModal({
  open,
  title,
  subtitle,
  confirmLabel,
  danger,
  busy,
  onClose,
  onConfirm,
  children,
}: DcModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'var(--overlay)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'dc-fadein .12s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(460px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--line-2)',
          borderRadius: 14,
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
          overflow: 'hidden',
          animation: 'dc-rise .14s ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ font: `600 14px/1.3 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
            {subtitle ? (
              <span
                style={{
                  font: `400 11.5px/1.45 ${FONT}`,
                  color: 'var(--ink-3)',
                  textWrap: 'pretty',
                }}
              >
                {subtitle}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 26,
              height: 26,
              flex: 'none',
              border: 0,
              borderRadius: 7,
              background: 'transparent',
              color: 'var(--ink-3)',
              cursor: 'pointer',
            }}
          >
            <DcIcon name="icon-x" size={14} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '15px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 13,
          }}
        >
          {children}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="dc-hover-ink"
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              font: `600 12.5px/1 ${FONT}`,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              height: 34,
              padding: '0 15px',
              borderRadius: 9,
              cursor: busy ? 'not-allowed' : 'pointer',
              font: `600 12.5px/1 ${FONT}`,
              border: `1px solid ${danger ? 'var(--bad-bd)' : 'var(--violet-solid)'}`,
              background: danger ? 'var(--bad-soft)' : 'var(--violet-solid)',
              color: danger ? 'var(--bad)' : 'var(--on-violet)',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export interface DcFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string | undefined
  hint?: string | undefined
  mono?: boolean | undefined
  area?: boolean | undefined
}

export function DcField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
  area,
}: DcFieldProps) {
  const shared = {
    padding: '10px 12px',
    borderRadius: 9,
    border: '1px solid var(--line)',
    background: 'var(--surface-2)',
    outline: 'none',
    color: 'var(--ink)',
    font: `400 12.5px/1.5 ${mono ? 'var(--mono)' : FONT}`,
    width: '100%',
  } as const

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          font: `600 11px/1 ${FONT}`,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      {area ? (
        <textarea
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...shared, resize: 'vertical' }}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={shared}
        />
      )}
      {hint ? (
        <span
          style={{ font: `400 11.5px/1.45 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  )
}
