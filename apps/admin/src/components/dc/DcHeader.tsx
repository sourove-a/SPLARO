'use client'

import { DcIcon } from './DcIcon'
import { useDcTheme } from './theme'
import { FONT, MONO, toneStyle, type DcTone } from './tokens'

export interface DcHeaderProps {
  apiLabel: string
  apiTone: DcTone
  onlineLabel?: string | null
  onlineTitle?: string
  notifications?: number
  /** True when any unread alert is critical — paints the badge red. */
  notificationsUrgent?: boolean
  railOpen: boolean
  onToggleRail: () => void
  onOpenPalette?: () => void
  onOpenNotifications?: () => void
  onOpenOnline?: () => void
  onOpenConnection?: () => void
}

const iconButton = {
  display: 'grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  borderRadius: 9,
  cursor: 'pointer',
} as const

export function DcHeader({
  apiLabel,
  apiTone,
  onlineLabel,
  onlineTitle,
  notifications = 0,
  notificationsUrgent = false,
  railOpen,
  onToggleRail,
  onOpenPalette,
  onOpenNotifications,
  onOpenOnline,
  onOpenConnection,
}: DcHeaderProps) {
  const { theme, toggleTheme } = useDcTheme()
  const api = toneStyle(apiTone)
  const online = toneStyle('info')

  return (
    <header
      className="dc-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 56,
        padding: '0 18px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--headerbg)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <button
        type="button"
        onClick={onOpenPalette}
        className="dc-header__search dc-hover-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          height: 34,
          padding: '0 11px',
          minWidth: 290,
          borderRadius: 9,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          font: `400 13px/1 ${FONT}`,
        }}
      >
        <DcIcon name="icon-search" size={14} />
        <span className="dc-header__search-label" style={{ flex: 1, textAlign: 'left' }}>
          Search screens and actions…
        </span>
        <span
          className="dc-header__shortcut"
          style={{
            padding: '2px 5px',
            borderRadius: 5,
            border: '1px solid var(--line)',
            font: `600 10.5px/1 ${MONO}`,
            color: 'var(--ink-3)',
          }}
        >
          ⌘K
        </span>
      </button>

      <div className="dc-header__spacer" style={{ flex: 1 }} />

      {onlineLabel ? (
        <button
          type="button"
          onClick={onOpenOnline}
          className="dc-header__online dc-hover-line"
          title={onlineTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 30,
            padding: '0 10px',
            borderRadius: 99,
            border: `1px solid ${online.bd}`,
            background: online.bg,
            font: `600 11.5px/1 ${FONT}`,
            color: online.fg,
            cursor: 'pointer',
          }}
        >
          <DcIcon name="icon-users" size={13} />
          <span>{onlineLabel}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpenConnection}
        className="dc-header__api dc-hover-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 30,
          padding: '0 10px',
          borderRadius: 99,
          border: `1px solid ${api.bd}`,
          background: api.bg,
          font: `600 11.5px/1 ${FONT}`,
          color: api.fg,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: 'currentColor',
            animation: 'dc-pulse 2.4s ease-in-out infinite',
          }}
        />
        <span className="dc-header__api-label">{apiLabel}</span>
      </button>

      <div
        className="dc-header__divider"
        style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 3px' }}
      />

      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        className="dc-header__icon dc-hover-ink"
        style={{
          ...iconButton,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: 'var(--ink-2)',
        }}
      >
        <DcIcon name={theme === 'dark' ? 'icon-sun' : 'icon-moon'} size={15} />
      </button>

      <button
        type="button"
        onClick={onOpenNotifications}
        title="Notifications"
        className="dc-header__icon dc-hover-ink"
        style={{
          ...iconButton,
          position: 'relative',
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: 'var(--ink-2)',
        }}
      >
        <DcIcon name="icon-bell" size={15} />
        {notifications > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 99,
              background: notificationsUrgent ? 'var(--bad)' : 'var(--violet-solid)',
              color: 'var(--on-violet)',
              font: `700 9.5px/1 ${FONT}`,
              border: '2px solid var(--headerbg)',
            }}
          >
            {notifications}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={onToggleRail}
        title="Activity"
        className="dc-header__rail-toggle"
        style={{
          ...iconButton,
          // Toggled state is carried by the neutral ramp — violet is nav-only.
          border: `1px solid ${railOpen ? 'var(--line-2)' : 'var(--line)'}`,
          background: railOpen ? 'var(--surface-3)' : 'var(--surface-2)',
          color: railOpen ? 'var(--ink)' : 'var(--ink-2)',
        }}
      >
        <DcIcon name="icon-panel-right" size={15} />
      </button>
    </header>
  )
}
