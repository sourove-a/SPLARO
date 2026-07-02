import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import type { AdminSettingsData } from '@/lib/api/settings'

export interface SectionProps {
  draft: AdminSettingsData
  setDraft: React.Dispatch<React.SetStateAction<AdminSettingsData>>
  save: (patch: Partial<AdminSettingsData>, label: string, onSuccess?: () => void) => void
  saving: boolean
  apiOnline: boolean
}

export function SectionPageHeader({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <div className="settings-page-header">
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="settings-page-header__icon">{icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                color: 'var(--admin-text-strong)',
                lineHeight: 1.2,
              }}
            >
              {title}
            </h2>
            {badge ? <span className="settings-eyebrow-badge">{badge}</span> : null}
          </div>
          <p
            style={{
              marginTop: '0.25rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--admin-text-muted)',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Divider() {
  return <div className="settings-divider" />
}

export function IconInput({
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  icon: ReactNode
  placeholder?: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="settings-icon-input">
      <input
        className="settings-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="settings-icon-input__icon" style={{ transition: 'color 160ms ease' }}>
        {icon}
      </span>
    </div>
  )
}

export function SectionCard({
  title,
  subtitle,
  children,
  accent = true,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <section className="settings-section-card settings-card">
      <span className="settings-section-card__shine" aria-hidden />
      {accent ? <span className="settings-section-card__accent" aria-hidden /> : null}
      <div className="settings-section-card__body">
        <div className="settings-section-card__title">
          <h3 className="settings-section-card__heading">{title}</h3>
          {subtitle ? <p className="settings-section-card__subtitle">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </section>
  )
}

export function FieldGrid({ cols = 2, children }: { cols?: 1 | 2; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: cols === 2 ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr',
      }}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  span2,
  hint,
  children,
}: {
  label: string
  span2?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'block', gridColumn: span2 ? '1 / -1' : undefined }}>
      <span
        style={{
          display: 'block',
          marginBottom: '0.375rem',
          fontSize: '0.72rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--admin-text-secondary)',
        }}
      >
        {label}
      </span>
      {children}
      {hint ? (
        <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
          {hint}
        </span>
      ) : null}
    </label>
  )
}

export function Toggle({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string
  desc?: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <label className={cn('settings-toggle', checked && 'settings-toggle--on', disabled && 'opacity-60 pointer-events-none')}>
      <div>
        <p className="settings-toggle__label">{label}</p>
        {desc ? <p className="settings-toggle__desc">{desc}</p> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault()
          onChange()
        }}
        className={cn('settings-toggle__switch', checked && 'settings-toggle__switch--on')}
        aria-pressed={checked}
      >
        <span className={cn('settings-toggle__knob', checked && 'settings-toggle__knob--on')} />
      </button>
    </label>
  )
}

export function SaveBar({
  label,
  onClick,
  saving,
  disabled,
}: {
  label: string
  onClick: () => void
  saving: boolean
  disabled?: boolean
}) {
  const isDisabled = saving || disabled
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1.25rem' }}>
      {disabled && !saving ? (
        <p style={{ marginRight: 'auto', fontSize: '0.75rem', fontWeight: 600, color: '#b45309' }}>
          API offline — cannot save
        </p>
      ) : null}
      <button type="button" disabled={isDisabled} onClick={onClick} className="settings-save-btn">
        <span className="settings-save-btn__shine" aria-hidden />
        {saving ? (
          <>
            <svg
              style={{ animation: 'spin 1s linear infinite', height: 14, width: 14 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Saving…
          </>
        ) : (
          <>
            <svg height={14} width={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {label}
          </>
        )}
      </button>
    </div>
  )
}
