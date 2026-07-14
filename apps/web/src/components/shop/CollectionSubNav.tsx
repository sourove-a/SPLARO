'use client'

import Link from 'next/link'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { cn } from '@/lib/utils/cn'
import type { CollectionSubNavItem } from '@/lib/storefront/collection-subnav'

interface CollectionSubNavProps {
  items: CollectionSubNavItem[]
}

export function CollectionSubNav({ items }: CollectionSubNavProps) {
  if (items.length <= 1) return null

  return (
    <nav className="collection-subnav" aria-label="Collection categories">
      <HorizontalScrollRail
        className="collection-subnav__rail"
        trackClassName="collection-subnav__track"
        variant="pill"
        ariaLabel="Collection sub-categories"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'collection-subnav__pill',
              item.active && 'collection-subnav__pill--active',
            )}
            aria-current={item.active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </HorizontalScrollRail>
    </nav>
  )
}
