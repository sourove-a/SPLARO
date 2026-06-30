'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

interface AuthModeSwitchProps {
  nextPath?: string
}

export function AuthModeSwitch({ nextPath = '/account' }: AuthModeSwitchProps) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'
  const query = nextPath !== '/account' ? `?next=${encodeURIComponent(nextPath)}` : ''

  return (
    <div className="auth-mode-switch" role="tablist" aria-label="Account access">
      <Link
        href={`/login${query}`}
        prefetch
        scroll={false}
        replace={pathname === '/signup'}
        className={cn('auth-mode-switch__btn', isLogin && 'auth-mode-switch__btn--active')}
        role="tab"
        aria-selected={isLogin}
      >
        {isLogin ? (
          <motion.span
            layoutId="auth-mode-pill"
            className="auth-mode-switch__pill"
            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }}
          />
        ) : null}
        <span className="auth-mode-switch__label">Sign in</span>
      </Link>
      <Link
        href={`/signup${query}`}
        prefetch
        scroll={false}
        replace={pathname === '/login'}
        className={cn('auth-mode-switch__btn', !isLogin && 'auth-mode-switch__btn--active')}
        role="tab"
        aria-selected={!isLogin}
      >
        {!isLogin ? (
          <motion.span
            layoutId="auth-mode-pill"
            className="auth-mode-switch__pill"
            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }}
          />
        ) : null}
        <span className="auth-mode-switch__label">Create account</span>
      </Link>
    </div>
  )
}

