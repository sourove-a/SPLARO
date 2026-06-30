'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useTransition } from 'react'

let pendingAdminNavHref: string | null = null
let recoveryInstalled = false

export function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

export function hardAdminNavigate(href: string) {
  if (isExternalHref(href)) {
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.assign(href)
}

export function setPendingAdminNav(href: string | null) {
  pendingAdminNavHref = href
}

export function installAdminNavRecovery() {
  if (recoveryInstalled || typeof window === 'undefined') return
  recoveryInstalled = true

  window.addEventListener('unhandledrejection', (event) => {
    if (!pendingAdminNavHref) return

    const reason = event.reason
    const message =
      typeof reason === 'string'
        ? reason
        : reason instanceof Error
          ? reason.message
          : String(reason ?? '')

    if (
      message.includes('Failed to fetch') ||
      message.includes('Load failed') ||
      message.includes('NetworkError') ||
      message.includes('fetch failed')
    ) {
      event.preventDefault()
      const href = pendingAdminNavHref
      pendingAdminNavHref = null
      hardAdminNavigate(href)
    }
  })
}

function prefetchRoute(router: ReturnType<typeof useRouter>, href: string) {
  if (isExternalHref(href)) return
  try {
    router.prefetch(href)
  } catch {
    // Prefetch is best-effort in dev.
  }
}

/** Soft navigation with hard-reload fallback when RSC fetch fails (common during dev compile). */
export function useAdminNavigate() {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setPendingAdminNav(null)
  }, [pathname])

  const navigate = useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return
      }

      const targetPath = href.split('?')[0] ?? href
      if (pathname === targetPath) return

      setPendingAdminNav(href)
      prefetchRoute(router, href)

      startTransition(() => {
        try {
          router.push(href, { scroll: false })
        } catch {
          hardAdminNavigate(href)
          setPendingAdminNav(null)
        }
      })
    },
    [router, pathname],
  )

  return { navigate, isPending, hardNavigate: hardAdminNavigate }
}

/** Mark a Link click so recovery can fall back to full navigation if soft nav fails. */
export function markAdminLinkNavigation(href: string) {
  if (!isExternalHref(href)) {
    setPendingAdminNav(href)
  }
}
