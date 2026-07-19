'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const NAVIGATION_START_EVENT = 'splaro:navigation-start'
const NAVIGATION_TIMEOUT_MS = 12_000

function internalDestination(anchor: HTMLAnchorElement): string | null {
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return null

  try {
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin) return null
    const destination = `${url.pathname}${url.search}`
    const current = `${window.location.pathname}${window.location.search}`
    return destination === current ? null : destination
  } catch {
    return null
  }
}

/** Immediate route feedback without fading or blocking current-page paint. */
export function NavigationFeedback() {
  const pathname = usePathname()
  const pendingAnchorRef = useRef<HTMLAnchorElement | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    const clearPending = () => {
      document.documentElement.removeAttribute('data-navigation-pending')
      pendingAnchorRef.current?.removeAttribute('data-navigation-pending')
      pendingAnchorRef.current = null
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      if (pollRef.current !== null) window.clearInterval(pollRef.current)
      timeoutRef.current = null
      pollRef.current = null
    }

    const startPending = (destination: string, anchor?: HTMLAnchorElement) => {
      clearPending()
      document.documentElement.setAttribute('data-navigation-pending', 'true')
      if (anchor) {
        anchor.setAttribute('data-navigation-pending', 'true')
        pendingAnchorRef.current = anchor
      }

      pollRef.current = window.setInterval(() => {
        if (`${window.location.pathname}${window.location.search}` === destination) {
          clearPending()
        }
      }, 50)
      timeoutRef.current = window.setTimeout(clearPending, NAVIGATION_TIMEOUT_MS)
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      if (anchor.hasAttribute('data-navigation-pending')) {
        event.preventDefault()
        return
      }

      const destination = internalDestination(anchor)
      if (destination) startPending(destination, anchor)
    }

    const onProgrammaticStart = (event: Event) => {
      const destination = (event as CustomEvent<{ path?: string }>).detail?.path
      if (destination) startPending(destination)
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener(NAVIGATION_START_EVENT, onProgrammaticStart)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener(NAVIGATION_START_EVENT, onProgrammaticStart)
      clearPending()
    }
  }, [pathname])

  return <div className="storefront-navigation-feedback" aria-hidden="true" />
}
