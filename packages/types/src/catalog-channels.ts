export interface CatalogChannel {
  slug: string
  label: string
  /** Matches shop product category name */
  shopCategory: string
  href: string
  published: boolean
}

export const DEFAULT_CATALOG_CHANNELS: CatalogChannel[] = [
  {
    slug: 'summer-edition',
    label: 'Summer Edition',
    shopCategory: 'Summer Edition',
    href: '/c/summer-edition',
    published: true,
  },
  {
    slug: 'men',
    label: 'Men',
    shopCategory: 'Men',
    href: '/c/men',
    published: true,
  },
  {
    slug: 'women',
    label: 'Women',
    shopCategory: 'Women',
    href: '/c/women',
    published: true,
  },
  {
    slug: 'kids',
    label: 'Kids',
    shopCategory: 'Kids',
    href: '/c/kids',
    published: true,
  },
  {
    slug: 'footwear',
    label: 'Footwear',
    shopCategory: 'Footwear',
    href: '/c/footwear',
    published: true,
  },
  {
    slug: 'accessories',
    label: 'Accessories',
    shopCategory: 'Accessories',
    href: '/accessories',
    published: true,
  },
]

export function mergeCatalogChannels(raw: unknown): CatalogChannel[] {
  const defaults = DEFAULT_CATALOG_CHANNELS.map((channel) => ({ ...channel }))
  if (!Array.isArray(raw)) return defaults

  return defaults.map((channel) => {
    const saved = raw.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        'slug' in entry &&
        (entry as CatalogChannel).slug === channel.slug,
    ) as Partial<CatalogChannel> | undefined

    if (!saved) return channel
    return {
      ...channel,
      ...saved,
      slug: channel.slug,
      label: saved.label?.trim() || channel.label,
      shopCategory: saved.shopCategory?.trim() || channel.shopCategory,
      href: saved.href?.trim() || channel.href,
      published: saved.published !== false,
    }
  })
}

export function isCatalogChannelPublished(
  channels: CatalogChannel[],
  slug: string,
): boolean {
  const channel = channels.find((entry) => entry.slug === slug)
  return channel?.published !== false
}

/** Top-level collection slug or nested slug like men-panjabi when parent is hidden. */
export function isCollectionSlugAccessible(
  slug: string,
  channels: CatalogChannel[],
): boolean {
  const direct = channels.find((entry) => entry.slug === slug)
  if (direct) return direct.published

  const parent = channels.find((entry) => slug.startsWith(`${entry.slug}-`))
  if (parent) return parent.published

  return true
}

export function filterCollectionCards<T extends { slug: string }>(
  cards: T[],
  channels: CatalogChannel[],
): T[] {
  return cards.filter((card) => isCollectionSlugAccessible(card.slug, channels))
}

export function isHrefBlockedByCatalogChannels(
  href: string,
  channels: CatalogChannel[],
): boolean {
  const normalized = href.split('?')[0]?.replace(/\/$/, '') ?? ''
  if (normalized === '/accessories' || normalized.startsWith('/accessories/')) {
    return false
  }
  if (!normalized.startsWith('/collections/') && !normalized.startsWith('/c/')) {
    return channels.some(
      (channel) => !channel.published && hrefMatchesCatalogChannel(normalized, channel),
    )
  }

  const slug = normalized.replace(/^\/(?:collections|c)\//, '')
  return !isCollectionSlugAccessible(slug, channels)
}

export function getPublishedShopCategories(channels: CatalogChannel[]): string[] {
  return channels.filter((channel) => channel.published).map((channel) => channel.shopCategory)
}

export function hrefMatchesCatalogChannel(href: string, channel: CatalogChannel): boolean {
  const normalized = href.split('?')[0]?.replace(/\/$/, '') ?? ''
  return (
    normalized === channel.href ||
    normalized === `/c/${channel.slug}` ||
    normalized === `/collections/${channel.slug}` ||
    normalized.endsWith(`/c/${channel.slug}`) ||
    normalized.endsWith(`/collections/${channel.slug}`)
  )
}

export function filterNavByCatalogChannels<T extends { href: string }>(
  links: T[],
  channels: CatalogChannel[],
): T[] {
  return links.filter((link) => !isHrefBlockedByCatalogChannels(link.href, channels))
}

export function filterFooterGroupsByCatalogChannels<
  T extends { links: { href: string }[] },
>(groups: T[], channels: CatalogChannel[]): T[] {
  return groups.map((group) => ({
    ...group,
    links: filterNavByCatalogChannels(group.links, channels),
  }))
}

type MegaMenuCategory = {
  href: string
  subcategories?: { href: string }[]
}

type MegaMenuHero = { href: string }

type MegaMenuShape = {
  categories: MegaMenuCategory[]
  heroes: MegaMenuHero[]
}


export function filterHeaderNavByCatalogChannels<
  T extends { href: string; megaMenu?: MegaMenuShape },
>(nav: T[], channels: CatalogChannel[]): T[] {
  return filterNavByCatalogChannels(nav, channels).map((item) => {
    if (!item.megaMenu) return item

    return {
      ...item,
      megaMenu: {
        categories: item.megaMenu.categories
          .filter((category) => !isHrefBlockedByCatalogChannels(category.href, channels))
          .map((category) => ({
            ...category,
            subcategories: category.subcategories?.filter(
              (sub) => !isHrefBlockedByCatalogChannels(sub.href, channels),
            ),
          })),
        heroes: item.megaMenu.heroes.filter(
          (hero) => !isHrefBlockedByCatalogChannels(hero.href, channels),
        ),
      },
    }
  })
}
