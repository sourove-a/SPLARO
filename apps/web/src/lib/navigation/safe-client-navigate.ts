import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import {
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
 * After cookie + signIn, skip App Router RSC. A mixed-build tab always gets
 * current HTML instead of a blank failed flight.
 */
export function navigateAfterAuth(path: string) {
  hardNavigate(path)
}

type SafeNavigateOptions = {
  timeoutMs?: number
}

/**
 * Client navigate with automatic full-page fallback when SPA prefetch/RSC fetch fails.
 * URL change alone does not count as settled.
 */
export function safeClientNavigate(
  router: AppRouterInstance,
  path: string,
  method: 'push' | 'replace' = 'push',
  options?: SafeNavigateOptions,
) {
  window.dispatchEvent(
    new CustomEvent('splaro:navigation-start', { detail: { path } }),
  )
  let settled = false
  const timeoutMs = options?.timeoutMs ?? DEFAULT_NAV_FALLBACK_MS

  const settle = () => {
    settled = true
    cleanup()
  }

  const recover = () => {
    if (settled) return
    settle()
    hardNavigate(path)
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

  const cleanup = () => {
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('error', onError, true)
    window.clearTimeout(fallbackTimer)
  }

  const fallbackTimer = window.setTimeout(() => {
    if (settled) return
    recover()
  }, timeoutMs)

  window.addEventListener('unhandledrejection', onRejection)
  window.addEventListener('error', onError, true)

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
