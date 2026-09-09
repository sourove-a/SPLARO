import type { CatalogChannel } from '@splaro/types'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { fetchLiveCategories, fetchLiveCollections } from '@/lib/catalog/live'
import { collectionHref, collectionSlugFromHref } from '@/lib/storefront/collection-paths'

export type CollectionRoomCategory = 'heritage' | 'drops' | 'seasonal' | 'footwear'

export interface CollectionRoom {
  id: string
  slug: string
  title: string
  subtitle: string
  category: CollectionRoomCategory
  tag: string
  image: string
  href: string
  pieceCount: number
  isSpotlight?: boolean
}

const ROOM_FALLBACK_IMAGE = '/images/hero/new-season-1600.webp'

interface RoomPresentation {
  title?: string
  subtitle: string
  category: CollectionRoomCategory
  tag: string
  image: string
  isSpotlight?: boolean
}

/**
 * Editorial copy only. A room is rendered when the live catalog or a published
 * channel actually backs the slug — never from this map alone, so the page can
 * not advertise a room that resolves to a redirect or an unknown route.
 */
const ROOM_PRESENTATION: Record<string, RoomPresentation> = {
  jhingephool: {
    title: 'ঝিঙেফুল — Heritage Handloom',
    subtitle: 'Artisanal sarees, master-woven jamdani, and Bangladeshi handloom craft.',
    category: 'heritage',
    tag: 'Signature Atelier',
    image: '/images/hero/saree-collection-1600.webp',
    isSpotlight: true,
  },
  women: {
    title: 'Women’s Signature Atelier',
    subtitle: 'Ethereal drapes, celebratory tissues, and timeless festive silhouettes.',
    category: 'drops',
    tag: 'Couture Capsule',
    image: '/images/hero/women-collection-1600.webp',
  },
  men: {
    title: 'Men’s Noir Monogram',
    subtitle: 'Refined midnight panjabis, structured jackets, and modern tailoring.',
    category: 'drops',
    tag: 'Modern Formal',
    image: '/images/hero/new-season-1600.webp',
  },
  kids: {
    title: 'Junior Festive Atelier',
    subtitle: 'Celebratory ensembles cut from gentle fabrics for young connoisseurs.',
    category: 'seasonal',
    tag: 'Limited Run',
    image: '/images/hero/summer-1600.webp',
  },
  footwear: {
    title: 'Royal Footwear Series',
    subtitle: 'Burnished calfskin loafers, artisan mules, and formal dress footwear.',
    category: 'footwear',
    tag: 'Leather Atelier',
    image: '/images/hero/new-season-1600.webp',
  },
  accessories: {
    title: 'Fine Leather & Accents',
    subtitle: 'Full-grain belts, minimalist cardholders, and finishing touches.',
    category: 'footwear',
    tag: 'Craft Accents',
    image: '/images/hero/new-season-1600.webp',
  },
}

/**
 * Art-directed rooms keep their editorial hero — the catalog stores brand marks
 * and logos in `imageUrl`, which crop badly in a 3:4 card. Every other room
 * takes the live image, falling back only when it is missing or a placeholder.
 */
function resolveRoomImage(liveImage: string | null | undefined, presentation?: RoomPresentation): string {
  if (presentation?.image) return presentation.image
  const trimmed = liveImage?.trim()
  if (trimmed && trimmed !== PRODUCT_IMAGE_PLACEHOLDER) return trimmed
  return ROOM_FALLBACK_IMAGE
}

/**
 * Channel hrefs are admin-editable and often stored as `/collections/<slug>`,
 * which 307s to `/c/<slug>`. Link straight at the canonical path so a card
 * click never spends a redirect. Non-collection paths (`/accessories`) pass through.
 */
function canonicalRoomHref(rawHref: string | undefined, slug: string): string {
  const href = rawHref?.trim()
  if (!href) return collectionHref(slug)
  const hrefSlug = collectionSlugFromHref(href)
  return hrefSlug ? collectionHref(hrefSlug) : href
}

function buildRoom(input: {
  slug: string
  label: string
  href: string
  pieceCount: number
  liveImage?: string | null | undefined
}): CollectionRoom {
  const presentation = ROOM_PRESENTATION[input.slug]
  return {
    id: input.slug,
    slug: input.slug,
    title: presentation?.title || input.label,
    subtitle:
      presentation?.subtitle ??
      (input.pieceCount > 0
        ? `A curated room of ${input.pieceCount} ${input.pieceCount === 1 ? 'piece' : 'pieces'}.`
        : 'A curated room from the SPLARO atelier.'),
    category: presentation?.category ?? 'drops',
    tag: presentation?.tag ?? 'Curated Drop',
    image: resolveRoomImage(input.liveImage, presentation),
    href: input.href,
    pieceCount: input.pieceCount,
    ...(presentation?.isSpotlight ? { isSpotlight: true as const } : {}),
  }
}

/**
 * Rooms shown on /collections: every stocked Prisma collection, then every
 * published catalog channel. Unpublished channels (and anything the catalog
 * does not know) are dropped so no card links to a redirect or a 404.
 */
export async function getCollectionRooms(channels: CatalogChannel[]): Promise<CollectionRoom[]> {
  const [liveCollections, liveCategories] = await Promise.all([
    fetchLiveCollections().catch(() => []),
    fetchLiveCategories().catch(() => []),
  ])

  const categoryCounts = new Map(liveCategories.map((row) => [row.slug, row.productCount]))
  const rooms: CollectionRoom[] = []
  const seen = new Set<string>()

  for (const row of liveCollections) {
    if (row.productCount <= 0 || seen.has(row.slug)) continue
    seen.add(row.slug)
    rooms.push(
      buildRoom({
        slug: row.slug,
        label: row.name,
        href: collectionHref(row.slug),
        pieceCount: row.productCount,
        liveImage: row.imageUrl,
      }),
    )
  }

  for (const channel of channels) {
    if (channel.published === false || seen.has(channel.slug)) continue
    seen.add(channel.slug)
    rooms.push(
      buildRoom({
        slug: channel.slug,
        label: channel.label,
        href: canonicalRoomHref(channel.href, channel.slug),
        pieceCount: categoryCounts.get(channel.slug) ?? 0,
      }),
    )
  }

  return rooms
}
