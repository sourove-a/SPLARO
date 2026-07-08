'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import { AuthEarthBackground } from '@/components/earth/AuthEarthBackground'
import {
  captureAuthReturnPath,
  clearAuthReturnPath,
  getAuthReturnPath,
} from '@/lib/auth/auth-return'
import { authMotionTransition, authTapSpring } from '@/lib/auth/auth-motion'

interface AuthShellProps {
  children: ReactNode
  hideSkipLink?: boolean
}

export function AuthShell({ children, hideSkipLink = false }: AuthShellProps) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const tapTransition = authMotionTransition(reduceMotion, 0.16)
  const pressMotion = reduceMotion ? {} : { whileTap: authTapSpring, whileHover: { opacity: 0.82 } }
  const iconPressMotion = reduceMotion ? {} : { whileTap: authTapSpring }
  const [skipCheckoutLink, setSkipCheckoutLink] = useState(hideSkipLink)
  const [returnPath, setReturnPath] = useState('/')

  useLayoutEffect(() => {
    document.body.classList.add('auth-page')
    captureAuthReturnPath()
    setReturnPath(getAuthReturnPath())
    return () => document.body.classList.remove('auth-page')
  }, [])

  useLayoutEffect(() => {
    if (hideSkipLink) {
      setSkipCheckoutLink(true)
      return
    }
    const next = new URLSearchParams(window.location.search).get('next')
    setSkipCheckoutLink(next === '/checkout')
  }, [hideSkipLink])

  const handleExit = () => {
    clearAuthReturnPath()
  }

  const handleBack = () => {
    clearAuthReturnPath()
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push(returnPath)
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell__glow" aria-hidden="true" />
      <AuthEarthBackground />

      <header className="auth-topbar">
        <motion.button
          type="button"
          onClick={handleBack}
          className="auth-topbar__back"
          aria-label={`Back to ${returnPath === '/' ? 'home' : 'previous page'}`}
          {...pressMotion}
          transition={tapTransition}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Back
        </motion.button>
        <motion.div {...iconPressMotion} transition={tapTransition}>
          <Link
            href={returnPath}
            onClick={handleExit}
            className="auth-topbar__close lux-icon-btn lux-icon-btn--round"
            aria-label="Close and return"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </motion.div>
      </header>

      <div className="auth-shell__inner">
        <div className="auth-shell__logo">
          <SplaroBrandLogo href="/" tone="dark" size="footerLuxury" />
        </div>

        <div className="auth-glass-panel">
          <div className="auth-glass-panel__shine" aria-hidden="true" />
          {children}
        </div>

        {skipCheckoutLink ? null : (
          <Link href="/" className="auth-skip-link" onClick={() => clearAuthReturnPath()}>
            Continue without signing in
          </Link>
        )}
      </div>
    </div>
  )
}
