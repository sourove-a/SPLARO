'use client'

import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

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
  | 'domain'

const SECTIONS: { id: SettingsSection; label: string; icon: typeof Globe; desc: string }[] = [
  { id: 'general', label: 'General', icon: Building2, desc: 'Name, currency, timezone' },
  { id: 'branding', label: 'Branding', icon: Palette, desc: 'Logo, favicon, footer' },
  { id: 'contact', label: 'Contact & Social', icon: Globe, desc: 'Phone, email, socials' },
  { id: 'homepage', label: 'Homepage', icon: Home, desc: 'Sections, marquee, offers' },
  { id: 'navigation', label: 'Navigation', icon: Navigation, desc: 'Header & footer links' },
  { id: 'payments', label: 'Payments', icon: CreditCard, desc: 'bKash, Nagad, COD' },
  { id: 'shipping', label: 'Shipping', icon: Truck, desc: 'Delivery charges' },
  { id: 'notifications', label: 'Notifications', icon: Mail, desc: 'SMTP, Telegram' },
  { id: 'marketing', label: 'Marketing', icon: BarChart3, desc: 'Pixel, Analytics' },
  { id: 'domain', label: 'Domain & SEO', icon: Wifi, desc: 'Domain, meta tags' },
]

interface Props {
  active: SettingsSection
  onChange: (s: SettingsSection) => void
  settingsLoaded: boolean
}

function ConnectionStatus({ settingsLoaded }: { settingsLoaded: boolean }) {
  const [apiReachable, setApiReachable] = useState<boolean | null>(null)
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const ping = async () => {
      try {
        const res = await fetch('/api/ping', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        const data = (await res.json()) as { online?: boolean; latencyMs?: number | null }
        if (cancelled) return
        setApiReachable(Boolean(data.online))
        setLatency(data.online && typeof data.latencyMs === 'number' ? data.latencyMs : null)
      } catch {
        if (!cancelled) {
          setApiReachable(false)
          setLatency(null)
        }
      }
    }

    void ping()
    const id = window.setInterval(() => void ping(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const online = settingsLoaded && apiReachable !== false
  const checking = apiReachable === null

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
          {checking ? 'Checking API…' : online ? 'API connected' : 'API offline'}
        </p>
        <p className="settings-nav-status__sub">
          {checking
            ? 'Pinging backend health…'
            : !settingsLoaded
              ? 'Settings not loaded — start API'
              : apiReachable === false
                ? 'Cannot reach API — save disabled'
                : latency !== null
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
