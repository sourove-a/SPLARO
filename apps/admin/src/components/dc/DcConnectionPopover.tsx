'use client'

import { useState } from 'react'
import type { ServiceConnection } from '@/lib/hooks/use-admin-connection'
import { DcIcon } from './DcIcon'
import { FONT, toneStyle, type DcTone } from './tokens'

export interface DcConnectionPopoverProps {
  open: boolean
  onClose: () => void
  api: ServiceConnection
  database: ServiceConnection
  storefront: ServiceConnection
  onRetry: () => Promise<void>
}

function toneOf(pulse: ServiceConnection['pulse']): DcTone {
  if (pulse === 'online') return 'ok'
  if (pulse === 'degraded') return 'warn'
  if (pulse === 'offline') return 'bad'
  return 'mute'
}

function labelOf(pulse: ServiceConnection['pulse']): string {
  if (pulse === 'online') return 'Online'
  if (pulse === 'degraded') return 'Degraded'
  if (pulse === 'offline') return 'Offline'
  return 'Checking…'
}

function Row({ name, conn }: { name: string; conn: ServiceConnection }) {
  const t = toneStyle(toneOf(conn.pulse))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          marginTop: 4,
          borderRadius: 99,
          background: t.fg,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{name}</span>
          <span
            style={{
              padding: '1px 7px',
              borderRadius: 99,
              border: `1px solid ${t.bd}`,
              background: t.bg,
              color: t.fg,
              font: `600 10px/1.4 ${FONT}`,
            }}
          >
            {labelOf(conn.pulse)}
          </span>
          {conn.latencyMs != null ? (
            <span style={{ font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>{conn.latencyMs}ms</span>
          ) : null}
        </div>
        {conn.message ? (
          <div style={{ marginTop: 2, font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            {conn.message}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function DcConnectionPopover({
  open,
  onClose,
  api,
  database,
  storefront,
  onRetry,
}: DcConnectionPopoverProps) {
  const [retrying, setRetrying] = useState(false)

  if (!open) return null

  const handleRetry = () => {
    setRetrying(true)
    void onRetry().finally(() => setRetrying(false))
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close connection status"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 95, border: 0, background: 'transparent', cursor: 'default' }}
      />
      <div
        role="dialog"
        aria-label="Connection status"
        style={{
          position: 'fixed',
          top: 60,
          right: 90,
          zIndex: 96,
          width: 320,
          maxWidth: 'calc(100vw - 32px)',
          border: '1px solid var(--line-2)',
          borderRadius: 13,
          background: 'var(--surface)',
          overflow: 'hidden',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 14px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={{ flex: 1, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
            Connection status
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="dc-hover-ink"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 9px',
              borderRadius: 7,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              cursor: retrying ? 'default' : 'pointer',
              font: `600 11px/1 ${FONT}`,
              opacity: retrying ? 0.6 : 1,
            }}
          >
            <DcIcon name="icon-refresh-cw" size={12} />
            {retrying ? 'Checking…' : 'Retry'}
          </button>
        </div>

        <div>
          <Row name="API" conn={api} />
          <Row name="Database" conn={database} />
          <Row name="Storefront" conn={storefront} />
        </div>
      </div>
    </>
  )
}
