'use client'

import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Route shell — owns the cross-page enter motion.
 *
 * Two rules learned the hard way and kept:
 *  1. Never wrap children in a new element. Layout CSS matches on direct
 *     children of #main-content (`#main-content:has(> .home-hero-slider)`),
 *     so the animation is flagged on #main-content itself instead.
 *  2. Never start the fade at opacity 0 — that reads as a white flash on
 *     menu/account clicks. The incoming page starts mostly opaque and only
 *     settles the last stretch.
 *
 * The first paint (hard refresh / SSR entry) never animates: a page that
 * dims itself on arrival looks broken, and it would cost LCP.
 */

let hasNavigatedOnce = false

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export default function RootTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Layout effect, not effect: this must land before the browser paints the new
  // route, or the page shows at full opacity for a frame and then flickers down.
  useIsomorphicLayoutEffect(() => {
    if (!hasNavigatedOnce) {
      hasNavigatedOnce = true
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const main = document.getElementById('main-content')
    if (!main) return

    main.setAttribute('data-route-enter', 'on')

    const clear = () => main.removeAttribute('data-route-enter')
    // Timeout is the safety net — animationend never fires if the element is
    // swapped or the animation is interrupted by a second navigation.
    const timer = window.setTimeout(clear, 700)
    main.addEventListener('animationend', clear, { once: true })

    return () => {
      window.clearTimeout(timer)
      main.removeEventListener('animationend', clear)
      clear()
    }
  }, [pathname])

  /**
   * Leaving state — the half that makes a tap feel answered.
   *
   * Next holds the current page on screen until the next route commits, so on a
   * slow connection a tap looks like nothing happened. A document-level capture
   * listener dims the outgoing page the moment an internal link is taken; the
   * enter effect above clears it when the new route lands.
   */
  useEffect(() => {
    let clearTimer = 0

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      // Same page (or a pure hash jump) — nothing is navigating away.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      const main = document.getElementById('main-content')
      main?.setAttribute('data-route-leaving', 'on')

      // The dim is an acknowledgement, not a loading state. If the route is slow
      // — or never commits at all (handler cancelled it, a guard blocked it) —
      // the page must not sit dimmed. Release it on its own either way.
      window.clearTimeout(clearTimer)
      clearTimer = window.setTimeout(() => {
        main?.removeAttribute('data-route-leaving')
      }, 900)
    }

    document.addEventListener('click', onClick, { capture: true })
    return () => {
      window.clearTimeout(clearTimer)
      document.removeEventListener('click', onClick, { capture: true })
    }
  }, [])

  // Whatever route we land on, the leaving dim must not survive it.
  useIsomorphicLayoutEffect(() => {
    document.getElementById('main-content')?.removeAttribute('data-route-leaving')
  }, [pathname])

  return <>{children}</>
}
