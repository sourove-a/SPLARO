'use client'

import Link from 'next/link'
import type { ShopBreadcrumbItem } from '@/lib/storefront/collection-subnav'

interface ShopBreadcrumbsProps {
  items: ShopBreadcrumbItem[]
}

export function ShopBreadcrumbs({ items }: ShopBreadcrumbsProps) {
  if (!items.length) return null

  return (
    <nav className="shop-breadcrumbs" aria-label="Breadcrumb">
      <ol className="shop-breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="shop-breadcrumbs__item">
              {item.href && !isLast ? (
                <Link href={item.href} className="shop-breadcrumbs__link">
                  {item.label}
                </Link>
              ) : (
                <span className="shop-breadcrumbs__current" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? <span className="shop-breadcrumbs__sep" aria-hidden>/</span> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
