'use client'

import Link from 'next/link'

import { DcIcon } from './DcIcon'
import { toneStyle, type DcTone } from './tokens'

const MOBILE_TABS = [
  { href: '/dashboard', label: 'Today', icon: 'icon-layout-dashboard', match: (h: string) => h === '/dashboard' },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    icon: 'icon-shopping-bag',
    match: (h: string) => h === '/dashboard/orders' || h.startsWith('/dashboard/orders/'),
  },
  {
    href: '/dashboard/packing-station',
    label: 'Pack',
    icon: 'icon-scan-line',
    match: (h: string) => h.startsWith('/dashboard/packing'),
  },
] as const

export function DcMobileAppChrome({
  title,
  activeHref,
  apiLabel,
  apiTone,
  onlineLabel,
  notifications = 0,
  notificationsUrgent = false,
  navOpen,
  onToggleNav,
  onOpenSearch,
  onOpenNotifications,
  onOpenConnection,
  onAskSplaro,
}: {
  title: string
  activeHref: string
  apiLabel: string
  apiTone: DcTone
  onlineLabel?: string
  notifications?: number
  notificationsUrgent?: boolean
  navOpen: boolean
  onToggleNav: () => void
  onOpenSearch?: () => void
  onOpenNotifications?: () => void
  onOpenConnection?: () => void
  onAskSplaro?: () => void
}) {
  const api = toneStyle(apiTone)
  const primaryActive = MOBILE_TABS.some((tab) => tab.match(activeHref))

  return (
    <>
      <header className="dc-mobile-app-header">
        <button
          type="button"
          className="dc-mobile-app-header__button"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={onToggleNav}
        >
          <DcIcon name={navOpen ? 'icon-x' : 'icon-menu'} size={17} />
        </button>

        <button
          type="button"
          className="dc-mobile-app-header__title-btn"
          onClick={onOpenConnection}
          title={`${apiLabel}${onlineLabel ? ` · ${onlineLabel}` : ''}`}
        >
          <span className="dc-mobile-app-header__title-text">{title}</span>
          <span
            className="dc-mobile-app-header__pulse"
            title={apiLabel}
            style={{ color: api.fg, background: 'currentColor' }}
          />
        </button>

        <div className="dc-mobile-app-header__actions">
          {onAskSplaro ? (
            <button
              type="button"
              className="dc-mobile-app-header__button dc-mobile-app-header__button--ask"
              aria-label="Ask SPLARO"
              onClick={onAskSplaro}
            >
              <DcIcon name="icon-sparkles" size={16} />
            </button>
          ) : null}

          {onOpenNotifications ? (
            <button
              type="button"
              className="dc-mobile-app-header__button dc-mobile-app-header__button--notif"
              aria-label="Notifications"
              onClick={onOpenNotifications}
            >
              <DcIcon name="icon-bell" size={16} />
              {notifications > 0 ? (
                <span
                  className="dc-mobile-app-header__badge"
                  data-urgent={notificationsUrgent ? 'true' : 'false'}
                >
                  {notifications > 99 ? '99+' : notifications}
                </span>
              ) : null}
            </button>
          ) : null}

          <button
            type="button"
            className="dc-mobile-app-header__button"
            aria-label="Search admin"
            onClick={onOpenSearch}
          >
            <DcIcon name="icon-search" size={17} />
          </button>
        </div>
      </header>

      <nav className="dc-mobile-bottom-nav" aria-label="Admin mobile navigation">
        {MOBILE_TABS.map((tab) => {
          const active = tab.match(activeHref)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="dc-mobile-bottom-nav__item"
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'page' : undefined}
            >
              <span className="dc-mobile-bottom-nav__icon">
                <DcIcon name={tab.icon} size={18} />
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          className="dc-mobile-bottom-nav__item"
          data-active={!primaryActive || navOpen ? 'true' : 'false'}
          aria-label="More admin sections"
          aria-expanded={navOpen}
          onClick={onToggleNav}
        >
          <span className="dc-mobile-bottom-nav__icon">
            <DcIcon name="icon-ellipsis" size={18} />
          </span>
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
