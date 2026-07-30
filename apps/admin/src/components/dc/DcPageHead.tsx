'use client'

import { DcIcon } from './DcIcon'
import { FONT, toneStyle, type DcTone } from './tokens'

export type DcModuleState = 'live' | 'loading' | 'empty' | 'error'

export const MODULE_STATES: Array<{ id: DcModuleState; icon: string; title: string }> = [
  { id: 'live', icon: 'icon-activity', title: 'Live data' },
  { id: 'loading', icon: 'icon-loader', title: 'Loading state' },
  { id: 'empty', icon: 'icon-inbox', title: 'Empty state' },
  { id: 'error', icon: 'icon-triangle-alert', title: 'Error state' },
]

export interface DcPageAction {
  label: string
  icon: string
  variant?: 'primary' | 'ghost'
  onClick?: () => void
}

export interface DcPageHeadProps {
  crumbGroup: string
  title: string
  statusLabel: string
  statusTone: DcTone
  syncLabel: string
  syncing?: boolean
  onSync?: () => void
  onBack?: () => void
  actions?: DcPageAction[]
  state?: DcModuleState
  onStateChange?: (state: DcModuleState) => void
}

export function DcPageHead({
  crumbGroup,
  title,
  statusLabel,
  statusTone,
  syncLabel,
  syncing,
  onSync,
  onBack,
  actions = [],
  state,
  onStateChange,
}: DcPageHeadProps) {
  const status = toneStyle(statusTone)

  return (
    <div
      className="dc-page-head"
      data-has-actions={actions.length > 0 ? 'true' : 'false'}
      data-has-back={onBack ? 'true' : 'false'}
      style={{
        position: 'sticky',
        top: 56,
        zIndex: 20,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 18,
        padding: '16px 24px 14px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--headerbg)',
        backdropFilter: 'blur(12px)',
        flexWrap: 'wrap',
      }}
    >
      <div
        className="dc-page-head__identity"
        style={{
          flex: 1,
          minWidth: 260,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <div
          className="dc-page-head__crumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            font: `500 11.5px/1 ${FONT}`,
            color: 'var(--ink-3)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{crumbGroup}</span>
          <DcIcon name="icon-chevron-right" size={11} />
          <span style={{ color: 'var(--ink-2)' }}>{title}</span>
        </div>
        <div
          className="dc-page-head__title-row"
          style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}
        >
          {onBack ? (
            <button
              type="button"
              className="dc-page-head__back dc-hover-ink"
              onClick={onBack}
              title="Back"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                cursor: 'pointer',
              }}
            >
              <DcIcon name="icon-arrow-left" size={15} />
            </button>
          ) : null}
          <h1
            className="dc-page-head__title"
            style={{
              margin: 0,
              font: `700 21px/1.15 ${FONT}`,
              letterSpacing: '-.022em',
              color: 'var(--ink)',
            }}
          >
            {title}
          </h1>
          <div
            className="dc-page-head__status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 22,
              padding: '0 8px',
              borderRadius: 6,
              border: `1px solid ${status.bd}`,
              background: status.bg,
              font: `600 10.5px/1 ${FONT}`,
              letterSpacing: '.05em',
              color: status.fg,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
            <span>{statusLabel}</span>
          </div>
          <span
            className="dc-page-head__sync"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 24 }}
          >
            <span
              className="dc-page-head__sync-label"
              style={{ font: `400 12px/24px ${FONT}`, color: 'var(--ink-3)' }}
            >
              {syncLabel}
            </span>
            {onSync ? (
              <button
                type="button"
                onClick={onSync}
                title="Sync"
                className="dc-hover-ink"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 24,
                  height: 24,
                  flex: 'none',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                }}
              >
                <DcIcon
                  name="icon-refresh-cw"
                  size={12}
                  style={syncing ? { animation: 'dc-spin .8s linear infinite' } : undefined}
                />
              </button>
            ) : null}
          </span>
        </div>
      </div>

      {/* flex:0 1 auto + wrap is load-bearing: with flex:none long action labels
          overflow <main> and paint over the right rail. */}
      <div
        className="dc-page-head__actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          flex: '0 1 auto',
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {process.env.NODE_ENV === 'development' && state && onStateChange ? (
          <div
            className="dc-page-head__states"
            style={{
              display: 'flex',
              gap: 3,
              padding: 3,
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              flex: 'none',
            }}
          >
            {MODULE_STATES.map((sb) => {
              const on = sb.id === state
              return (
                <button
                  key={sb.id}
                  type="button"
                  onClick={() => onStateChange(sb.id)}
                  title={sb.title}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 27,
                    height: 26,
                    border: 0,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: on ? 'var(--surface)' : 'transparent',
                    color: on ? 'var(--violet)' : 'var(--ink-3)',
                  }}
                >
                  <DcIcon name={sb.icon} size={13} />
                </button>
              )
            })}
          </div>
        ) : null}

        {actions.map((a) => {
          const primary = a.variant === 'primary'
          return (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 34,
                padding: '0 13px',
                borderRadius: 9,
                cursor: 'pointer',
                font: `600 12.5px/1 ${FONT}`,
                border: `1px solid ${primary ? 'var(--violet-solid)' : 'var(--line)'}`,
                background: primary ? 'var(--violet-solid)' : 'var(--surface-2)',
                color: primary ? 'var(--on-violet)' : 'var(--ink-2)',
              }}
            >
              <DcIcon name={a.icon} size={14} />
              <span>{a.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
