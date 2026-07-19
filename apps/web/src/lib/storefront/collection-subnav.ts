import type { NavLink } from '@/lib/storefront/settings'
import { collectionHref, collectionSlugFromHref } from '@/lib/storefront/collection-paths'
import { titleFromCollectionSlug } from '@/lib/storefront/collection-context'

export interface ShopBreadcrumbItem {
  label: string
  href?: string
}

export interface CollectionSubNavItem {
  label: string
  href: string
  active: boolean
}

function slugMatches(href: string, slug: string): boolean {
  return collectionSlugFromHref(href) === slug || href === collectionHref(slug)
}

/** premium trail: Home / Kids / Girls */
export function resolveCollectionBreadcrumbs(
  slug: string | undefined,
  title: string | undefined,
  headerNav: NavLink[] | undefined,
): ShopBreadcrumbItem[] {
  const items: ShopBreadcrumbItem[] = [{ label: 'Home', href: '/' }]

  if (!slug) {
    items.push({ label: 'Shop' })
    return items
  }

  const nav = headerNav ?? []
  const href = collectionHref(slug)

  for (const item of nav) {
    if (!item.megaMenu) {
      if (slugMatches(item.href, slug)) {
        items.push({ label: item.label, href: item.href })
        return items
      }
      continue
    }

    if (slugMatches(item.href, slug)) {
      items.push({ label: item.label, href: item.href })
      return items
    }

    for (const category of item.megaMenu.categories) {
      if (slugMatches(category.href, slug)) {
        items.push({ label: item.label, href: item.href })
        items.push({ label: category.label, href: category.href })
        return items
      }

      for (const sub of category.subcategories ?? []) {
        if (slugMatches(sub.href, slug)) {
          items.push({ label: item.label, href: item.href })
          items.push({ label: category.label, href: category.href })
          items.push({ label: sub.label, href: sub.href })
          return items
        }
      }
    }
  }

  items.push({ label: 'Shop', href: '/shop' })
  items.push({ label: title ?? titleFromCollectionSlug(slug), href })
  return items
}

/** Sub-category pills under breadcrumb (premium Girls → All / Tops / Dress). */
export function resolveCollectionSubNav(
  slug: string,
  headerNav: NavLink[] | undefined,
): CollectionSubNavItem[] {
  const nav = headerNav ?? []
  const href = collectionHref(slug)

  for (const item of nav) {
    if (!item.megaMenu) continue

    if (slugMatches(item.href, slug)) {
      const categories = item.megaMenu.categories
      if (!categories.length) {
        return [{ label: 'All', href, active: true }]
      }
      return [
        { label: 'All', href, active: true },
        ...categories.map((category) => ({
          label: category.label,
          href: category.href,
          active: false,
        })),
      ]
    }

    for (const category of item.megaMenu.categories) {
      if (slugMatches(category.href, slug)) {
        const subs = category.subcategories ?? []
        if (!subs.length) {
          return [{ label: 'All', href: category.href, active: true }]
        }
        return [
          { label: 'All', href: category.href, active: true },
          ...subs.map((sub) => ({
            label: sub.label,
            href: sub.href,
            active: false,
          })),
        ]
      }

      for (const sub of category.subcategories ?? []) {
        if (slugMatches(sub.href, slug)) {
          const subs = category.subcategories ?? []
          return [
            { label: 'All', href: category.href, active: false },
            ...subs.map((entry) => ({
              label: entry.label,
              href: entry.href,
              active: slugMatches(entry.href, slug),
            })),
          ]
        }
      }
    }
  }

  return [{ label: 'All', href, active: true }]
}
