'use client'

import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { isValidBdMobile } from '@/lib/checkout/phone'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  trailing?: ReactNode
  /** Force red icon state (form validation error). */
  invalid?: boolean
}

function isAuthValueValid(type: string | undefined, value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  if (type === 'password') return trimmed.length >= 8
  if (type === 'tel') return isValidBdMobile(trimmed)
  return trimmed.length >= 2
}

export function AuthField({
  label,
  trailing,
  className,
  type,
  invalid = false,
  value,
  defaultValue,
  ...props
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type
  const hasTrailing = isPassword || Boolean(trailing)
  const rawValue = value ?? defaultValue ?? ''
  const stringValue = typeof rawValue === 'string' ? rawValue : String(rawValue)
  const valid = !invalid && isAuthValueValid(type, stringValue)

  return (
    <label
      className={cn(
        'auth-field',
        valid && 'auth-field--valid',
        invalid && 'auth-field--invalid',
      )}
    >
      {label ? <span className="auth-field__label">{label}</span> : null}
      <span className="auth-field__wrap">
        <input
          {...props}
          value={value}
          defaultValue={defaultValue}
          type={inputType}
          aria-invalid={invalid || undefined}
          className={cn(
            'auth-field__input',
            !hasTrailing && 'auth-field__input--plain',
            className,
          )}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-field__icon-btn"
            // Keep input focus — avoids scroll/layout jump when toggling visibility.
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault()
              setVisible((next) => !next)
            }}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            <span className="auth-field__icon-chip" aria-hidden>
              {visible ? (
                <EyeOff className="h-4 w-4" strokeWidth={2.1} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2.1} />
              )}
            </span>
          </button>
        ) : trailing ? (
          <span className="auth-field__icon">{trailing}</span>
        ) : null}
      </span>
    </label>
  )
}
