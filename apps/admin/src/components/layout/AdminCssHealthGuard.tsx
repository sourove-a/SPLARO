'use client'

import { useEffect, useState, type CSSProperties } from 'react'

const CANARY_VAR = '--admin-bg'
const RELOAD_KEY = 'splaro-admin-css-auto-reload'

function isStaleChunkError(message: string) {
  return (
    message.includes("reading 'call'") ||
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('missing required error components')
  )
}

function probeCssHealth(): boolean {
  const adminBg = getComputedStyle(document.documentElement).getPropertyValue(CANARY_VAR).trim()
  if (!adminBg) return false

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

const bannerStyle: CSSProperties = {
  position: 'fixed',
  inset: '0',
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(17,17,17,0.55)',
  backdropFilter: 'blur(6px)',
}

const cardStyle: CSSProperties = {
  maxWidth: '420px',
  width: '100%',
  padding: '20px 22px',
  borderRadius: '14px',
  background: '#fffbeb',
  border: '1px solid #fcd34d',
  color: '#78350f',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: 1.55,
  textAlign: 'center',
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
}

/**
 * Detects stale .next dev cache (404 on layout.css / chunks) and auto-reloads once.
 */
export function AdminCssHealthGuard() {
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return

    const reloadOnceForStaleCache = () => {
      if (sessionStorage.getItem(RELOAD_KEY)) return false
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
      return true
    }

    const onAssetError = (event: Event) => {
      if (event instanceof ErrorEvent && isStaleChunkError(event.message)) {
        reloadOnceForStaleCache()
        return
      }

      const target = event.target
      if (!(target instanceof HTMLScriptElement || target instanceof HTMLLinkElement)) return
      const url = target instanceof HTMLScriptElement ? target.src : target.href
      if (!url.includes('_next')) return
      reloadOnceForStaleCache()
    }

    window.addEventListener('error', onAssetError, true)

    let cancelled = false
    let attempts = 0
    const maxAttempts = 4

    const check = () => {
      if (cancelled) return
      attempts += 1

      if (probeCssHealth()) {
        sessionStorage.removeItem(RELOAD_KEY)
        setBroken(false)
        return
      }

      if (attempts < maxAttempts) {
        window.setTimeout(check, 900)
        return
      }

      setBroken(true)
    }

    const timer = window.setTimeout(check, 1200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener('error', onAssetError, true)
    }
  }, [])

  if (!broken) return null

  return (
    <div role="alert" style={bannerStyle}>
      <div style={cardStyle}>
        <strong style={{ display: 'block', marginBottom: '8px', fontSize: '15px' }}>
          Admin styles failed to load
        </strong>
        Stale dev cache — CSS/chunk 404. Terminal-এ চালান:
        <br />
        <code style={{ display: 'inline-block', marginTop: '10px', padding: '4px 8px', background: '#fef3c7', borderRadius: '6px', fontSize: '12px' }}>
          pnpm css:fix:admin && pnpm dev:admin
        </code>
        <br />
        তারপর hard refresh (Cmd+Shift+R).
        <button
          type="button"
          style={{
            display: 'inline-block',
            marginTop: '14px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #d97706',
            background: '#fff',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
          }}
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    </div>
  )
}
