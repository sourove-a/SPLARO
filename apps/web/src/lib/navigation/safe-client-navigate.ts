import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

function pathsMatch(current: string, target: string): boolean {
  try {
    const base = window.location.origin
    const currentUrl = new URL(current, base)
    const targetUrl = new URL(target, base)
    return (
      currentUrl.pathname === targetUrl.pathname &&
      currentUrl.search === targetUrl.search
    )
  } catch {
    return window.location.pathname === target.split('?')[0]
  }
}

function isRecoverableNavigationError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : ''
  return /failed to fetch|networkerror|network error|load failed|aborted/i.test(message)
}

/** Hard navigation when Next.js RSC fetch fails (extensions, offline API, dev restart). */
export function hardNavigate(path: string) {
  window.location.assign(path)
}

/**
 * Client navigate with automatic full-page fallback when SPA prefetch/RSC fetch fails.
 * Common causes: VPN/ad-block extensions, dev server restart, transient network.
 */
export function safeClientNavigate(
  router: AppRouterInstance,
  path: string,
  method: 'push' | 'replace' = 'push',
) {
  window.dispatchEvent(
    new CustomEvent('splaro:navigation-start', { detail: { path } }),
  )
  let settled = false
  const settle = () => {
    settled = true
    cleanup()
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    if (settled || !isRecoverableNavigationError(event.reason)) return
    event.preventDefault()
    settle()
    hardNavigate(path)
  }

  const cleanup = () => {
    window.removeEventListener('unhandledrejection', onRejection)
    window.clearTimeout(fallbackTimer)
  }

  const fallbackTimer = window.setTimeout(() => {
    if (settled || pathsMatch(`${window.location.pathname}${window.location.search}`, path)) {
      settle()
      return
    }
    settle()
    hardNavigate(path)
  }, 12000)

  window.addEventListener('unhandledrejection', onRejection)

  try {
    if (method === 'replace') {
      router.replace(path)
    } else {
      router.push(path)
    }
    window.requestAnimationFrame(() => {
      if (pathsMatch(`${window.location.pathname}${window.location.search}`, path)) {
        settle()
      }
    })
  } catch {
    settle()
    hardNavigate(path)
  }
}
