'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startViewTransition, supportsViewTransitions } from '@/lib/navigation/view-transition'
import type { ComponentProps, MouseEvent } from 'react'

type ProductTransitionLinkProps = ComponentProps<typeof Link>

function resolveHref(href: ProductTransitionLinkProps['href']): string {
  if (typeof href === 'string') return href
  const path = href.pathname ?? ''
  const query = href.query
  if (!query || typeof query !== 'object') return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Product routes only — wraps navigation in View Transitions API when supported. */
export function ProductTransitionLink({
  href,
  onClick,
  children,
  ...rest
}: ProductTransitionLinkProps) {
  const router = useRouter()
  const path = resolveHref(href)

  return (
    <Link
      href={href}
      {...rest}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (!path.startsWith('/products/')) return
        if (!supportsViewTransitions()) return

        event.preventDefault()
        startViewTransition(() => {
          router.push(path)
        })
      }}
    >
      {children}
    </Link>
  )
}
