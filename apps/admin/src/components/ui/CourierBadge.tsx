'use client'

import { cn } from '@/lib/utils/cn'

// ─── Courier brand config ────────────────────────────────────────────────────

export type CourierKey = 'STEADFAST' | 'PATHAO' | 'REDX' | 'PAPERFLY' | 'SUNDARBAN' | string

interface CourierConfig {
  label: string
  accent: string        // brand color
  bg: string            // pill bg
  border: string        // pill border
  textColor: string     // label color
  icon: React.ReactNode
}

// ─── SVG icons (16×16 viewBox, stroke-based, clean & sharp) ─────────────────

function IconSteadfast({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1.5L13.5 4.5V9C13.5 11.8 11.1 13.9 8 14.5C4.9 13.9 2.5 11.8 2.5 9V4.5L8 1.5Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M5.5 8L7 9.5L10.5 6" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconPathao({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="6" r="2.5" stroke={color} strokeWidth="1.4"/>
      <path d="M8 8.5C5.5 8.5 3.5 10 3.5 12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 8.5C10.5 8.5 12.5 10 12.5 12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="3.5" cy="12.5" r="1" fill={color}/>
      <circle cx="12.5" cy="12.5" r="1" fill={color}/>
      <circle cx="8" cy="12.5" r="1" fill={color}/>
    </svg>
  )
}

function IconRedx({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8H14" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M10 4L14 8L10 12" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 5.5L5.5 8L2 10.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconPaperfly({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 13L7 8.5L10 11L14 3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 3L6.5 5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M7 8.5L6.5 5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconSundarban({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2.5C8 2.5 4 5 4 8.5C4 10.5 5.5 12 8 12C10.5 12 12 10.5 12 8.5C12 5 8 2.5 8 2.5Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M8 12V14" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M5.5 7C6.5 6.5 7.5 7 8 8" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function IconUnknown({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="10" height="8" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <path d="M5.5 5V4C5.5 2.9 6.4 2 7.5 2H8.5C9.6 2 10.5 2.9 10.5 4V5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="8" cy="9" r="1" fill={color}/>
    </svg>
  )
}

// ─── Brand map ───────────────────────────────────────────────────────────────

const COURIER_MAP: Record<string, CourierConfig> = {
  STEADFAST: {
    label: 'Steadfast',
    accent: '#1d6f42',
    bg: '#f0faf4',
    border: '#bbdecb',
    textColor: '#166534',
    icon: <IconSteadfast color="#1d6f42" />,
  },
  PATHAO: {
    label: 'Pathao',
    accent: '#e8380d',
    bg: '#fff4f1',
    border: '#fcc8bc',
    textColor: '#b91c1c',
    icon: <IconPathao color="#e8380d" />,
  },
  REDX: {
    label: 'REDX',
    accent: '#c0392b',
    bg: '#fff1f1',
    border: '#fbc8c8',
    textColor: '#991b1b',
    icon: <IconRedx color="#c0392b" />,
  },
  PAPERFLY: {
    label: 'Paperfly',
    accent: '#7c3aed',
    bg: '#f5f3ff',
    border: '#d8b4fe',
    textColor: '#5b21b6',
    icon: <IconPaperfly color="#7c3aed" />,
  },
  SUNDARBAN: {
    label: 'Sundarban',
    accent: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    textColor: '#0c4a6e',
    icon: <IconSundarban color="#0369a1" />,
  },
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CourierBadgeProps {
  provider: CourierKey
  /** 'pill' = compact badge (tables), 'card' = full card with status */
  variant?: 'pill' | 'card'
  status?: string | null
  className?: string
}

export function CourierBadge({ provider, variant = 'pill', status, className }: CourierBadgeProps) {
  const key = (provider ?? '').toUpperCase()
  const cfg = COURIER_MAP[key]

  if (!cfg) {
    return (
      <span className={cn('courier-badge courier-badge--unknown', className)}>
        <IconUnknown color="#6b7280" />
        <span>{provider || '—'}</span>
      </span>
    )
  }

  if (variant === 'card') {
    return (
      <div
        className={cn('courier-card', className)}
        style={{ '--courier-accent': cfg.accent, '--courier-bg': cfg.bg, '--courier-border': cfg.border } as React.CSSProperties}
      >
        <div className="courier-card__icon">{cfg.icon}</div>
        <div className="courier-card__body">
          <p className="courier-card__name" style={{ color: cfg.textColor }}>{cfg.label}</p>
          {status ? (
            <p className="courier-card__status">{status.toLowerCase().replace(/_/g, ' ')}</p>
          ) : null}
        </div>
        <div className="courier-card__dot" style={{ background: cfg.accent }} />
      </div>
    )
  }

  return (
    <span
      className={cn('courier-badge', className)}
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        color: cfg.textColor,
      }}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  )
}

// ─── Courier selector (for forms) ────────────────────────────────────────────

interface CourierSelectorProps {
  value: CourierKey
  onChange: (v: CourierKey) => void
  className?: string
}

const ALL_COURIERS: CourierKey[] = ['STEADFAST', 'PATHAO', 'REDX', 'PAPERFLY', 'SUNDARBAN']

export function CourierSelector({ value, onChange, className }: CourierSelectorProps) {
  return (
    <div className={cn('courier-selector', className)}>
      {ALL_COURIERS.map((key) => {
        const cfg = COURIER_MAP[key]!
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn('courier-selector__option', active && 'courier-selector__option--active')}
            style={
              active
                ? ({
                    '--courier-bg': cfg.bg,
                    '--courier-border': cfg.border,
                    '--courier-accent': cfg.accent,
                  } as React.CSSProperties)
                : undefined
            }
          >
            <span className="courier-selector__icon">{cfg.icon}</span>
            <span className="courier-selector__label" style={active ? { color: cfg.textColor } : undefined}>
              {cfg.label}
            </span>
            {active ? <span className="courier-selector__check" style={{ background: cfg.accent }} /> : null}
          </button>
        )
      })}
    </div>
  )
}
