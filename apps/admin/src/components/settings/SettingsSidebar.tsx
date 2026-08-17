'use client'

import {
  Building2,
  CreditCard,
  Globe,
  Home,
  Mail,
  Navigation,
  Palette,
  Truck,
  Wifi,
  BarChart3,
  WifiOff,
  Cloud,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { FONT, MONO } from '@/components/dc/tokens'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

export type SettingsSection =
  | 'general'
  | 'branding'
  | 'contact'
  | 'homepage'
  | 'navigation'
  | 'payments'
  | 'shipping'
  | 'notifications'
  | 'marketing'
  | 'infrastructure'
  | 'domain'

const SETTINGS_SECTIONS = new Set<SettingsSection>([
  'general', 'branding', 'contact', 'homepage', 'navigation', 'payments', 'shipping', 'notifications', 'marketing', 'infrastructure', 'domain',
])

function isSettingsSection(value: string | null): value is SettingsSection {
  return Boolean(value && SETTINGS_SECTIONS.has(value as SettingsSection))
}

export { isSettingsSection }

const SECTIONS: { id: SettingsSection; label: string; icon: typeof Globe; desc: string }[] = [
  { id: 'general', label: 'General', icon: Building2, desc: 'Store name, currency, SKU' },
  { id: 'branding', label: 'Branding', icon: Palette, desc: 'Logo, favicon, footer' },
  { id: 'contact', label: 'Contact & Social', icon: Globe, desc: 'Phone, email, socials' },
  { id: 'homepage', label: 'Homepage', icon: Home, desc: 'Hero, marquee, offers' },
  { id: 'navigation', label: 'Navigation', icon: Navigation, desc: 'Header & footer menus' },
  { id: 'payments', label: 'Payments', icon: CreditCard, desc: 'bKash, Nagad, COD, SSL' },
  { id: 'shipping', label: 'Shipping', icon: Truck, desc: 'Dhaka & outside charges' },
  { id: 'notifications', label: 'Notifications', icon: Mail, desc: 'SMTP, Telegram, newsletter' },
  { id: 'marketing', label: 'Marketing', icon: BarChart3, desc: 'Meta Pixel, GA4' },
  { id: 'infrastructure', label: 'Infrastructure', icon: Cloud, desc: 'R2 storage, Steadfast' },
  { id: 'domain', label: 'Domain & SEO', icon: Wifi, desc: 'Custom domain, meta tags' },
]

interface Props {
  active: SettingsSection
  onChange: (s: SettingsSection) => void
  settingsLoaded: boolean
}

function ConnectionStatus({ settingsLoaded }: { settingsLoaded: boolean }) {
  const { api, checking } = useAdminConnection(30_000)
  const apiReachable = api.pulse === 'online' || api.pulse === 'degraded'
  const latency = api.latencyMs
  const online = settingsLoaded && apiReachable
  const isChecking = checking && api.pulse === 'checking'

  return (
    <div
      className={cn(
        'settings-nav-status',
        online ? 'settings-nav-status--online' : 'settings-nav-status--offline',
      )}
    >
      <span
        className={cn(
          'settings-nav-status__icon',
          online ? 'settings-nav-status__icon--online' : 'settings-nav-status__icon--offline',
        )}
      >
        {online ? <Wifi style={{ height: 13, width: 13 }} strokeWidth={1.5} /> : <WifiOff style={{ height: 13, width: 13 }} strokeWidth={1.5} />}
      </span>
      <div className="settings-nav-status__body">
        <p className="settings-nav-status__title">
          {isChecking ? 'Checking API…' : online ? 'API connected' : 'API offline'}
        </p>
        <p className="settings-nav-status__sub">
          {isChecking
            ? 'Pinging backend health…'
            : !settingsLoaded
              ? 'Settings not loaded — start API'
              : !apiReachable
                ? 'Cannot reach API — save disabled'
                : latency != null
                  ? `${latency}ms · settings loaded from server`
                  : 'Settings loaded from server'}
        </p>
      </div>
      <span
        className={cn(
          'settings-nav-status__dot',
          online ? 'settings-nav-status__dot--online' : 'settings-nav-status__dot--offline',
        )}
        aria-hidden
      />
    </div>
  )
}

/** Section groups, in the order the design lays them out. */
const SET_GROUPS: Array<[string, SettingsSection[]]> = [
  ['Store', ['general', 'branding', 'contact']],
  ['Storefront', ['homepage', 'navigation', 'payments', 'shipping']],
  ['Platform', ['notifications', 'marketing', 'infrastructure', 'domain']],
]

export function SettingsSidebar({ active, onChange, settingsLoaded }: Props) {
  return (
    <>
      <div className="settings-mobile-nav">
        <div className="settings-mobile-chips" role="tablist" aria-label="Settings sections">
          {SECTIONS.map((s) => {
            const isActive = active === s.id
            const Icon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(s.id)}
                className={cn(
                  'settings-mobile-chip',
                  isActive && 'settings-mobile-chip--active',
                )}
              >
                <Icon style={{ height: 13, width: 13 }} strokeWidth={1.8} />
                <span>{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <nav className="settings-sidebar-rail" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ConnectionStatus settingsLoaded={settingsLoaded} />

        {SET_GROUPS.map(([groupLabel, ids]) => (
          <div key={groupLabel} className="settings-sidebar-rail__group" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div
              className="settings-sidebar-rail__label"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px 6px',
                font: `700 10px/1 ${FONT}`,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              <span>{groupLabel}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span style={{ font: `600 10px/1 ${MONO}`, opacity: 0.65 }}>{ids.length}</span>
            </div>

            {ids.map((id) => {
              const s = SECTIONS.find((x) => x.id === id)
              if (!s) return null
              const isActive = active === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(id)}
                  className={cn(
                    'settings-sidebar-rail__item',
                    isActive ? 'settings-sidebar-rail__item--active' : 'dc-hover-surface',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 9px',
                    borderRadius: 9,
                    border: `1px solid ${isActive ? 'var(--violet-bd)' : 'var(--line)'}`,
                    background: isActive ? 'var(--violet-soft)' : 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    className="settings-sidebar-rail__icon"
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 26,
                      height: 26,
                      flex: 'none',
                      borderRadius: 7,
                      border: '1px solid var(--line)',
                      background: isActive ? 'var(--surface)' : 'var(--surface-2)',
                      color: isActive ? 'var(--violet)' : 'var(--ink-3)',
                    }}
                  >
                    <s.icon style={{ height: 14, width: 14 }} strokeWidth={1.75} />
                  </span>
                  <span
                    style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}
                  >
                    <span
                      style={{
                        font: `600 12.5px/1.2 ${FONT}`,
                        color: isActive ? 'var(--violet)' : 'var(--ink)',
                      }}
                    >
                      {s.label}
                    </span>
                    <span
                      style={{
                        font: `400 11px/1.3 ${FONT}`,
                        color: 'var(--ink-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.desc}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </>
  )
}
