'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { useReducedMotion } from '@/lib/motion/react'
import { markClientNavigationReady } from '@/lib/motion/client-nav-ready'
import { startViewTransition, supportsViewTransitions } from '@/lib/navigation/view-transition'

type ProductTransitionLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode
}

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

/**
 * Product card → PDP: prefetch for speed + View Transition image morph.
 * Press feedback uses CSS on .product-transition-link__hit (not Framer on the
 * same node as view-transition-name — that blocked the morph).
 */
export function ProductTransitionLink({
  prefetch = true,
  href,
  onClick,
  children,
  className,
  ...rest
}: ProductTransitionLinkProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const path = resolveHref(href)

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (!path.startsWith('/products/')) return

    markClientNavigationReady()

    if (!reducedMotion && supportsViewTransitions()) {
      event.preventDefault()
      startViewTransition(() => {
        router.push(path)
      })
    }
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      data-no-press=""
      className={className}
      onClick={handleClick}
      {...rest}
    >
      <span className="product-transition-link__hit">{children}</span>
    </Link>
  )
}
