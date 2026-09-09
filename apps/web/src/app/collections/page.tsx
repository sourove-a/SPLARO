import { mergeCatalogChannels } from '@splaro/types'
import { getCollectionRooms } from '@/lib/catalog/collection-rooms'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { buildItemListJsonLd } from '@/lib/seo/geo-json-ld'
import { CollectionsPage } from '@/components/collections/CollectionsPage'

export const dynamic = 'force-dynamic'

export const metadata = createRouteMetadata({
  title: 'Collections',
  description: 'Curated SPLARO collections — rooms in the wardrobe, signature capsules, and handloom editions.',
  path: '/collections',
})

export default async function CollectionsRoute() {
  const settings = await getStorefrontSettings()
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])
  const rooms = await getCollectionRooms(channels)
  const listLd = buildItemListJsonLd({
    name: 'SPLARO collections',
    path: '/collections',
    items: rooms.map((room) => ({
      name: room.title,
      path: room.href,
    })),
  })

  return (
    <main className="shop-page-shell min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listLd }} />
      <CollectionsPage rooms={rooms} />
    </main>
  )
}
