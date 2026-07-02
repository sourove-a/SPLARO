import type { Metadata } from 'next'
import { FootwearPage, type FootwearConfig } from '@/components/footwear/FootwearPage'
import { fetchFootwearRowProducts } from '@/lib/catalog/server'
import configJson from '@/data/footwear-page-config.json'

export const metadata: Metadata = {
  title: 'Footwear | SPLARO',
  description: 'Luxury handcrafted footwear — loafers, sandals, heels and more.',
}

export const revalidate = 60

const ROW_CATEGORY_SLUGS: Record<string, string> = {
  'mens-footwear': 'footwear-men',
  'womens-footwear': 'footwear-women',
  'kids-footwear': 'footwear-kids',
}

async function hydrateFootwearConfig(base: FootwearConfig): Promise<FootwearConfig> {
  const productRows = await Promise.all(
    base.productRows.map(async (row) => {
      const categorySlug = ROW_CATEGORY_SLUGS[row.id]
      if (!categorySlug) return { ...row, products: [] }

      const live = await fetchFootwearRowProducts(categorySlug, 12)
      if (!live.length) return { ...row, products: [] }

      return {
        ...row,
        exploreHref: `/c/${categorySlug}`,
        products: live.map((p) => ({
          id: p.id,
          slug: p.slug ?? p.id,
          name: p.name,
          code: ('sku' in p && p.sku ? String(p.sku) : p.id.slice(-6)),
          colors: p.colors?.length ?? 1,
          price: p.price,
          image: ('images' in p && Array.isArray(p.images) ? p.images[0] : p.image) ?? null,
        })),
      }
    }),
  )

  return {
    ...base,
    shopByCategory: {
      ...base.shopByCategory,
      categories: base.shopByCategory.categories.map((cat) => ({
        ...cat,
        href:
          cat.id === 'men'
            ? '/c/footwear-men'
            : cat.id === 'women'
              ? '/c/footwear-women'
              : cat.id === 'kids'
                ? '/c/footwear-kids'
                : cat.href,
      })),
    },
    productRows,
  }
}

export default async function FootwearRoute() {
  const config = await hydrateFootwearConfig(configJson as unknown as FootwearConfig)
  return <FootwearPage config={config} />
}
