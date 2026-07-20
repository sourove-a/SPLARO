'use client'

import { useEffect, useState } from 'react'

const CANARY_VAR = '--accent-gold'
const EXPECTED_GOLD_VALUES = [
  '#101114',
  'rgb(16, 17, 20)',
  '16, 17, 20',
]

function probeCssHealth(): boolean {
  const root = document.documentElement
  const gold = getComputedStyle(root).getPropertyValue(CANARY_VAR).trim().toLowerCase()
  const hasCanary = gold.length > 0 && EXPECTED_GOLD_VALUES.some((value) => gold.includes(value))
  if (!hasCanary) return false

  const layoutLinks = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="_next"]'),
  ).filter((link) => link.href.includes('/css/'))

  if (layoutLinks.length === 0) return true

  return layoutLinks.every((link) => {
    try {
      return link.sheet !== null
    } catch {
      return false
    }
  })
}

/**
 * Detects missing/broken CSS.
 * Production: silent one-shot reload only — never show a customer-facing debug banner.
 * Development: amber banner with pnpm css:fix guidance.
 */
export function CssHealthGuard() {
  const [broken, setBroken] = useState(false)
  const isProd = process.env.NODE_ENV === 'production'

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = isProd ? 3 : 4

    const check = () => {
      if (cancelled) return
      attempts += 1

      if (probeCssHealth()) {
        setBroken(false)
        document.body.classList.remove('css-health-broken')
        return
      }

      if (attempts < maxAttempts) {
        window.setTimeout(check, isProd ? 600 : 900)
        return
      }

      if (isProd) {
        const key = 'splaro_css_reload'
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1')
            window.location.reload()
          }
        } catch {
          // ignore storage errors
        }
        // Never surface a debug banner on production.
        return
      }

      setBroken(true)
      document.body.classList.add('css-health-broken')
    }

    const timer = window.setTimeout(check, isProd ? 800 : 1200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.body.classList.remove('css-health-broken')
    }
  }, [isProd])

  if (!broken || isProd) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-[99999] border-t border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
    >
      Styles did not load (stale dev cache). Run{' '}
      <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">pnpm css:fix</code> then{' '}
      <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">pnpm dev:web</code>
      <button
        type="button"
        className="ml-3 rounded-lg border border-amber-400/50 bg-white px-3 py-1 text-xs font-bold"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  )
}
