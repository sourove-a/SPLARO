'use client'

import { cn } from '@/lib/utils/cn'

interface AdminSwitchProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  'aria-label'?: string
}

/** Theme-aware iOS-style switch — reuse settings knob styles. */
export function AdminSwitch({ checked, onChange, disabled, 'aria-label': ariaLabel }: AdminSwitchProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={onChange}
      className={cn(
        'settings-toggle__switch',
        checked && 'settings-toggle__switch--on',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className={cn('settings-toggle__knob', checked && 'settings-toggle__knob--on')} />
    </button>
  )
}

interface AdminSwitchRowProps {
  label: string
  desc?: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
  highlight?: boolean
}

/** Compact row for sidebars — not the full-width settings card. */
export function AdminSwitchRow({
  label,
  desc,
  checked,
  onChange,
  disabled,
  highlight,
}: AdminSwitchRowProps) {
  return (
    <div
      className={cn(
        'admin-switch-row',
        highlight && 'admin-switch-row--highlight',
        checked && highlight && 'admin-switch-row--highlight-on',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="admin-switch-row__label">{label}</p>
        {desc ? <p className="admin-switch-row__desc">{desc}</p> : null}
      </div>
      <AdminSwitch
        checked={checked}
        onChange={onChange}
        {...(disabled !== undefined ? { disabled } : {})}
        aria-label={label}
      />
    </div>
  )
}
