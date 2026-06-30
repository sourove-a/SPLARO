import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllCatalogSlugs, getProductDetailBySlug, getRelatedProducts } from '@/lib/catalog/server'
import ProductPageClient from './product-page-client'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export const dynamicParams = true

export async function generateStaticParams() {
  return getAllCatalogSlugs()
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getProductDetailBySlug(slug)

  if (!result) {
    return { title: 'Product not found' }
  }

  const { product } = result
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.com.bd'

  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.description,
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? product.description,
      images: product.images[0] ? [{ url: product.images[0], alt: product.name }] : [],
      url: `${siteUrl}/products/${product.slug}`,
      type: 'website',
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const result = await getProductDetailBySlug(slug)

  if (!result) notFound()

  const { product, reviews } = result
  const related = await getRelatedProducts(product)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.com.bd'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images,
    brand: {
      '@type': 'Brand',
      name: 'SPLARO',
    },
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/products/${product.slug}`,
      priceCurrency: 'BDT',
      price: product.price,
      availability:
        product.variants.some((variant) => variant.stock > 0)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'SPLARO',
      },
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating.toFixed(1),
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductPageClient product={product} reviews={reviews} relatedProducts={related} />
    </>
  )
}
