'use client'

import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  trailing?: ReactNode
}

export function AuthField({ label, trailing, className, type, ...props }: AuthFieldProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type
  const hasTrailing = isPassword || Boolean(trailing)

  return (
    <label className="auth-field">
      {label ? <span className="auth-field__label">{label}</span> : null}
      <span className="auth-field__wrap">
        <input
          {...props}
          type={inputType}
          className={cn('auth-field__input', !hasTrailing && 'auth-field__input--plain', className)}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-field__icon-btn"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            <span className="auth-field__icon-chip">
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
