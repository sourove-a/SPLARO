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
        {online ? <Wifi style={{ height: 13, width: 13 }} strokeWidth={2.25} /> : <WifiOff style={{ height: 13, width: 13 }} strokeWidth={2.25} />}
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

export function SettingsSidebar({ active, onChange, settingsLoaded }: Props) {
  return (
    <nav className="settings-sidebar-menu">
      <ConnectionStatus settingsLoaded={settingsLoaded} />

      {SECTIONS.map((s) => {
        const isActive = active === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={cn('settings-nav-item', isActive && 'settings-nav-item--active')}
          >
            <span className="settings-nav-item__icon">
              <s.icon style={{ height: 15, width: 15 }} strokeWidth={1.75} />
            </span>
            <div className="settings-nav-item__text">
              <p className="settings-nav-item__label">{s.label}</p>
              <p className="settings-nav-item__desc">{s.desc}</p>
            </div>
            {isActive ? <span className="settings-nav-item__active-dot" aria-hidden /> : null}
          </button>
        )
      })}
    </nav>
  )
}
