import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import {
  AUTH_NAV_FALLBACK_MS,
  DEFAULT_NAV_FALLBACK_MS,
  isRecoverableNavigationError,
} from '@/lib/navigation/navigation-recovery'

export {
  AUTH_NAV_FALLBACK_MS,
  DEFAULT_NAV_FALLBACK_MS,
  isRecoverableNavigationError,
} from '@/lib/navigation/navigation-recovery'

/** Hard navigation when Next.js RSC fetch fails (extensions, offline API, deploy mismatch). */
export function hardNavigate(path: string) {
  window.location.assign(path)
}

/**
 * After cookie + signIn, stay in the App Router so Google GIS close does not
 * dump a full document reload (white flash + account spinner).
 * If the RSC flight dies, safeClientNavigate still hard-navigates.
 */
export function navigateAfterAuth(router: AppRouterInstance, path: string) {
  safeClientNavigate(router, path, 'replace', { timeoutMs: AUTH_NAV_FALLBACK_MS })
}

type SafeNavigateOptions = {
  timeoutMs?: number
}

let activeNavCleanup: (() => void) | null = null

/**
 * Client navigate with automatic full-page fallback when SPA prefetch/RSC fetch fails.
 * Cancels timers when route changes or subsequent navigation starts.
 */
export function safeClientNavigate(
  router: AppRouterInstance,
  path: string,
  method: 'push' | 'replace' = 'push',
  options?: SafeNavigateOptions,
) {
  if (activeNavCleanup) {
    activeNavCleanup()
    activeNavCleanup = null
  }

  window.dispatchEvent(
    new CustomEvent('splaro:navigation-start', { detail: { path } }),
  )
  let settled = false
  const timeoutMs = options?.timeoutMs ?? DEFAULT_NAV_FALLBACK_MS

  const cleanup = () => {
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('error', onError, true)
    window.removeEventListener('popstate', checkSettled)
    if (pollInterval) window.clearInterval(pollInterval)
    if (fallbackTimer) window.clearTimeout(fallbackTimer)
    if (activeNavCleanup === cleanup) {
      activeNavCleanup = null
    }
  }

  const settle = () => {
    settled = true
    cleanup()
  }

  const recover = () => {
    if (settled) return
    settle()
    hardNavigate(path)
  }

  const checkSettled = () => {
    if (settled) return
    const current = window.location.pathname + window.location.search
    const target = path.split('#')[0] ?? path
    if (current === target || window.location.pathname === target.split('?')[0]) {
      settle()
    }
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    if (settled || !isRecoverableNavigationError(event.reason)) return
    event.preventDefault()
    recover()
  }

  const onError = (event: ErrorEvent) => {
    if (settled) return
    const target = event.target
    if (target instanceof HTMLScriptElement && /\/_next\/static\//.test(target.src)) {
      recover()
      return
    }
    if (target instanceof HTMLLinkElement && /\/_next\/static\//.test(target.href)) {
      recover()
      return
    }
    if (isRecoverableNavigationError(event.message)) recover()
  }

  const pollInterval = window.setInterval(checkSettled, 150)
  window.addEventListener('popstate', checkSettled)

  const fallbackTimer = window.setTimeout(() => {
    if (settled) return
    recover()
  }, timeoutMs)

  window.addEventListener('unhandledrejection', onRejection)
  window.addEventListener('error', onError, true)

  activeNavCleanup = cleanup

  try {
    if (method === 'replace') {
      router.replace(path)
    } else {
      router.push(path)
    }
  } catch {
    recover()
  }
}
