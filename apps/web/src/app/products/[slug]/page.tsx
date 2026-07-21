import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { productSlug } from '@/lib/catalog/index'
import { getProductDetailBySlug, getStorefrontCatalog } from '@/lib/catalog/server'
import { isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'
import { pageTitleSegment } from '@/lib/seo/page-title'
import { serializeJsonLd } from '@/lib/seo/json-ld'
import ProductPageClient from './product-page-client'
import { RelatedProducts } from './related-products'
import { ProductRelatedSkeleton } from './product-related-section'
import {
  sanitizeStorefrontDescription,
  sanitizeStorefrontShortDescription,
} from '@/lib/catalog/storefront-sanitize'
import { buildProductDescriptionFallback } from '@/lib/catalog/product-copy'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export const dynamicParams = true

/** Pre-render only when live API catalog is available (avoids CI/build timeouts). */
export async function generateStaticParams() {
  if (isCiOrProductionBuild()) return []
  try {
    const { products, source } = await getStorefrontCatalog()
    if (source !== 'api' || !products.length) return []
    return products.map((p) => ({
      slug: (p.slug ?? productSlug(p)) as string,
    }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getProductDetailBySlug(slug).catch(() => null)

  if (!result) {
    return { title: 'Product not found' }
  }

  const { product } = result
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'
  const safeDescription = sanitizeStorefrontDescription(
    product.metaDescription ?? product.description,
    `${product.name} — premium piece from SPLARO.`,
  )
  const safeOgDescription =
    sanitizeStorefrontShortDescription(product.shortDescription, safeDescription) ??
    safeDescription
  const ogImage = product.images[0]
    ? [{ url: product.images[0], alt: product.name }]
    : [{ url: `${siteUrl}/og-image.jpg`, alt: product.name }]

  return {
    title: pageTitleSegment(product.metaTitle) || product.name,
    description: safeDescription,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    alternates: {
      canonical: `${siteUrl}/products/${product.slug}`,
    },
    openGraph: {
      title: product.name,
      description: safeOgDescription,
      images: ogImage,
      url: `${siteUrl}/products/${product.slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: safeOgDescription,
      images: ogImage.map((image) => image.url),
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const result = await getProductDetailBySlug(slug)

  if (!result) notFound()

  const { product: rawProduct, reviews } = result
  // QA/seed wording ("seeded for storefront QA…") must never reach customers —
  // swap it for honest brand copy before the client renders it.
  const safeShortDescription = sanitizeStorefrontShortDescription(
    rawProduct.shortDescription,
  )
  const descriptionFallback = buildProductDescriptionFallback({
    name: rawProduct.name,
    fabricContent: rawProduct.fabricContent,
    fitType: rawProduct.fitType,
    occasion: rawProduct.occasion,
    category: rawProduct.category,
    categorySlug: rawProduct.categorySlug,
  })
  const product = {
    ...rawProduct,
    description: sanitizeStorefrontDescription(
      rawProduct.description,
      descriptionFallback,
    ),
    ...(safeShortDescription
      ? { shortDescription: safeShortDescription }
      : rawProduct.shortDescription
        ? { shortDescription: '' }
        : {}),
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const inStock = product.variants.some((variant) => variant.stock > 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${siteUrl}/shop` },
          {
            '@type': 'ListItem',
            position: 3,
            name: product.name,
            item: `${siteUrl}/products/${product.slug}`,
          },
        ],
      },
      {
        '@type': 'Product',
        name: product.name,
        description: sanitizeStorefrontDescription(
          product.description,
          `${product.name} — premium piece from SPLARO.`,
        ),
        sku: product.sku,
        image: product.images,
        url: `${siteUrl}/products/${product.slug}`,
        brand: {
          '@type': 'Brand',
          name: 'SPLARO',
        },
        offers: {
          '@type': 'Offer',
          url: `${siteUrl}/products/${product.slug}`,
          priceCurrency: 'BDT',
          price: String(product.price),
          priceValidUntil,
          itemCondition: 'https://schema.org/NewCondition',
          availability: inStock
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
      },
    ],
  }

  return (
    <>
      {/* First gallery image preload is handled by <StorefrontImage priority> on the
          client (product-page-client.tsx) — it resolves to whichever URL actually
          gets rendered (raw vs Next-optimized). A manual preload here always used
          the raw source URL and caused every PDP hero photo to be double-fetched
          when the Next image optimizer is active. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ProductPageClient product={product} reviews={reviews} />
      <Suspense fallback={<ProductRelatedSkeleton />}>
        <RelatedProducts product={product} />
      </Suspense>
    </>
  )
}
