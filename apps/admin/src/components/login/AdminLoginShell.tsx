'use client'

import { useLayoutEffect, type ReactNode } from 'react'
import { ArrowRight, ExternalLink, Fingerprint, LockKeyhole, Send, ShieldCheck } from 'lucide-react'
import { resolvePublicSiteUrl } from '@splaro/config'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'

const STOREFRONT_URL = resolvePublicSiteUrl()

/**
 * Handoff-style split login chrome.
 * Auth forms (OTP / password / invite / reset) render as children — logic stays in login-client.
 */
export function AdminLoginShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.body.classList.add('admin-auth-page')
    document.documentElement.classList.remove('dark')
    return () => document.body.classList.remove('admin-auth-page')
  }, [])

  return (
    <div className="admin-auth-shell admin-auth-shell--dc">
      <header className="admin-auth-topbar admin-auth-topbar--dc">
        <a
          href={STOREFRONT_URL}
          className="admin-auth-topbar__link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden />
          Storefront
        </a>
      </header>

      <aside className="admin-auth-dc__brand" aria-hidden={false}>
        <div className="admin-auth-dc__glow" aria-hidden="true" />
        <div className="admin-auth-dc__orb admin-auth-dc__orb--one" aria-hidden="true" />
        <div className="admin-auth-dc__orb admin-auth-dc__orb--two" aria-hidden="true" />
        <div className="admin-auth-dc__brand-top">
          <SplaroAdminLogo variant="login" priority />
          <span className="admin-auth-dc__secure-chip">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Private operations
          </span>
        </div>
        <div className="admin-auth-dc__brand-copy">
          <p className="admin-auth-dc__eyebrow">SPLARO · Commerce OS</p>
          <h1 className="admin-auth-dc__headline">
            Right person. Right access. Right way in.
          </h1>
          <p className="admin-auth-dc__lede">
            Enter one work email. SPLARO reads account policy, then opens correct verification path.
          </p>
          <div className="admin-auth-dc__route" aria-label="Adaptive sign-in route">
            <div className="admin-auth-dc__route-start">
              <span className="admin-auth-dc__route-icon">
                <Fingerprint className="h-4 w-4" strokeWidth={2} />
              </span>
              <span>
                <strong>Identity check</strong>
                <small>Work email + active staff role</small>
              </span>
            </div>
            <div className="admin-auth-dc__route-line" aria-hidden>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
            <div className="admin-auth-dc__route-options">
              <div>
                <span className="admin-auth-dc__route-icon admin-auth-dc__route-icon--telegram">
                  <Send className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span>
                  <strong>Owner / Admin</strong>
                  <small>Personal Telegram code</small>
                </span>
              </div>
              <div>
                <span className="admin-auth-dc__route-icon admin-auth-dc__route-icon--password">
                  <LockKeyhole className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span>
                  <strong>Manager / Editor</strong>
                  <small>Account password</small>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="admin-auth-dc__meta">
          <span>admin.splaro.co</span>
          <span aria-hidden="true">·</span>
          <span>API v1</span>
          <span aria-hidden="true">·</span>
          <span>Dhaka, BD</span>
        </div>
      </aside>

      <div className="admin-auth-dc__form-col admin-auth-template-enter">
        <div className="admin-auth-dc__form-wrap">
          <div className="admin-auth-card admin-auth-card--dc">{children}</div>
        </div>
      </div>
    </div>
  )
}
