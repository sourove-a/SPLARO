import { FootwearPage, type FootwearConfig } from '@/components/footwear/FootwearPage'
import { fetchFootwearRowProducts } from '@/lib/catalog/server'
import { getFootwearPageConfig } from '@/lib/content/get-footwear-config'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export const metadata = createRouteMetadata({
  title: 'Footwear',
  description: 'Luxury handcrafted footwear — loafers, sandals, heels and more.',
  path: '/footwear',
})

export const revalidate = 60

const ROW_CATEGORY_SLUGS: Record<string, string> = {
  'mens-footwear': 'men-footwear',
  'womens-footwear': 'women-footwear',
  'kids-footwear': 'kids-footwear',
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
          sizes: p.sizes,
          colorsHex: p.colors,
          ...(p.variantRefs ? { variantRefs: p.variantRefs } : {}),
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
            ? '/c/men-footwear'
            : cat.id === 'women'
              ? '/c/women-footwear'
              : cat.id === 'kids'
                ? '/c/kids-footwear'
                : cat.href,
      })),
    },
    productRows,
  }
}

export default async function FootwearRoute() {
  const base = await getFootwearPageConfig()
  const config = await hydrateFootwearConfig(base)
  return <FootwearPage config={config} />
}
