'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { snapHeaderChromeLeavingHome } from '@/lib/navigation/snap-header-chrome'

/** Capture-phase snap before paint on any in-app link leaving `/`. */
export function LeaveHomeChromeSnap() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/') return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!anchor || anchor.getAttribute('target') === '_blank') return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || /^https?:\/\//i.test(href)) return

      const nextPath = href.split(/[?#]/)[0] || href
      if (!nextPath || nextPath === '/' || nextPath === pathname) return

      snapHeaderChromeLeavingHome()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname])

  return null
}
