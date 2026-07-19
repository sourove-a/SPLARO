'use client'

import Link from 'next/link'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { markClientNavigationReady } from '@/lib/motion/client-nav-ready'

type ProductTransitionLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode
}

/**
 * Product card → PDP.
 * Uses Next Link default scroll-to-top (scroll={true}).
 * View Transitions were disabled here — they kept shop scrollY so PDPs opened on the footer.
 */
export function ProductTransitionLink({
  prefetch = true,
  href,
  onClick,
  children,
  className,
  scroll = true,
  ...rest
}: ProductTransitionLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    markClientNavigationReady()

    // Do not scroll the current grid before navigation; PDP mount owns top snap.
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      scroll={scroll}
      data-no-press=""
      className={className}
      onClick={handleClick}
      {...rest}
    >
      <span className="product-transition-link__hit">{children}</span>
    </Link>
  )
}
