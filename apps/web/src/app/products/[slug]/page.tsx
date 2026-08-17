import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getProductDetailBySlug } from '@/lib/catalog/server'
import { PDP_REVIEWS_VISIBLE } from '@/lib/catalog/pdp-reviews-visibility'
import { pageTitleSegment } from '@/lib/seo/page-title'
import { serializeJsonLd } from '@/lib/seo/json-ld'
import ProductPageClient from './product-page-client'
import { RelatedProducts } from './related-products'
import { RecentlyViewedSection } from './recently-viewed-section'
import { ProductRelatedSkeleton } from './product-related-section'
import {
  sanitizeStorefrontDescription,
  sanitizeStorefrontMaterial,
  sanitizeStorefrontShortDescription,
} from '@/lib/catalog/storefront-sanitize'
import { buildProductDescriptionFallback } from '@/lib/catalog/product-copy'
import { getCheckoutShippingSettings } from '@/lib/storefront/settings'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export const dynamicParams = true
export const dynamic = 'force-dynamic'

/** Empty — middleware enforces real HTTP 404 for unknown slugs. */
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  let result: Awaited<ReturnType<typeof getProductDetailBySlug>> = null
  try {
    result = await getProductDetailBySlug(slug)
  } catch {
    return {
      title: 'Product',
      robots: { index: false, follow: false },
    }
  }

  if (!result) {
    return {
      title: 'Product not found',
      robots: { index: false, follow: false },
    }
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
  const rawImage = product.images[0]
  const absoluteImageUrl = rawImage
    ? (rawImage.startsWith('http') ? rawImage : `${siteUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`)
    : `${siteUrl}/og-image.jpg`
  const ogImage = [{ url: absoluteImageUrl, alt: product.name }]

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
  const [result, shipping] = await Promise.all([
    getProductDetailBySlug(slug),
    getCheckoutShippingSettings(),
  ])

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

  const activeVariants = product.variants.filter((variant) => variant.isActive)
  const variantColors = [...new Set(activeVariants.map((v) => v.color).filter(Boolean) as string[])]
  const variantSizes = [...new Set(activeVariants.map((v) => v.size).filter(Boolean) as string[])]

  const hasVariantSchema = activeVariants.map((variant) => {
    const params = new URLSearchParams({ v: variant.id })
    if (variant.size) params.set('size', variant.size)
    if (variant.color) params.set('color', variant.color)

    return {
      '@type': 'Product',
      '@id': `${siteUrl}/products/${product.slug}#variant-${variant.id}`,
      name: `${product.name}${variant.color ? ` - ${variant.color}` : ''}${variant.size ? ` (${variant.size})` : ''}`,
      sku: variant.id,
      image: variant.image || product.images[0],
      ...(variant.color ? { color: variant.color } : {}),
      ...(variant.size ? { size: variant.size } : {}),
      offers: {
        '@type': 'Offer',
        url: `${siteUrl}/products/${product.slug}?${params.toString()}`,
        priceCurrency: 'BDT',
        price: String(variant.price ?? product.price),
        priceValidUntil,
        itemCondition: 'https://schema.org/NewCondition',
        availability: (variant.stock ?? 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: 'SPLARO',
        },
      },
    }
  })

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
        '@id': `${siteUrl}/products/${product.slug}#product`,
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
        ...(variantColors.length > 0 ? { color: variantColors.length === 1 ? variantColors[0] : variantColors } : {}),
        ...(variantSizes.length > 0 ? { size: variantSizes.length === 1 ? variantSizes[0] : variantSizes } : {}),
        ...(() => {
          const material = sanitizeStorefrontMaterial(product.fabricContent)
          return material ? { material } : {}
        })(),
        ...(product.category ? { category: product.category } : {}),
        ...(hasVariantSchema.length > 0 ? { hasVariant: hasVariantSchema } : {}),
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
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: Number.isFinite(shipping.outsideDhakaCharge)
                ? shipping.outsideDhakaCharge.toFixed(2)
                : '120.00',
              currency: 'BDT',
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'BD',
            },
          },
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'BD',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 7,
            returnMethod: 'https://schema.org/ReturnByMail',
          },
          ...(product.compareAtPrice != null &&
          Number(product.compareAtPrice) > Number(product.price)
            ? {
                priceSpecification: [
                  {
                    '@type': 'UnitPriceSpecification',
                    priceType: 'https://schema.org/SalePrice',
                    price: String(product.price),
                    priceCurrency: 'BDT',
                  },
                  {
                    '@type': 'UnitPriceSpecification',
                    priceType: 'https://schema.org/ListPrice',
                    price: String(product.compareAtPrice),
                    priceCurrency: 'BDT',
                  },
                ],
              }
            : {}),
        },
        // Both blocks stay gated on PDP_REVIEWS_VISIBLE — review markup for a
        // section the shopper cannot see is a structured-data violation.
        ...(PDP_REVIEWS_VISIBLE && product.reviewCount > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating.toFixed(1),
                reviewCount: product.reviewCount,
              },
            }
          : {}),
        // Individual reviews are what Google renders as star snippets in the
        // SERP — aggregateRating alone rarely earns them. Only real, published
        // reviews are emitted; an empty list stays absent rather than faked.
        ...(PDP_REVIEWS_VISIBLE && reviews.length
          ? {
              review: reviews.slice(0, 12).map((review) => ({
                '@type': 'Review',
                reviewRating: {
                  '@type': 'Rating',
                  ratingValue: String(review.rating),
                  bestRating: '5',
                  worstRating: '1',
                },
                author: { '@type': 'Person', name: review.name || 'SPLARO customer' },
                ...(review.title ? { name: review.title } : {}),
                reviewBody: review.text,
                ...(review.createdAt ? { datePublished: review.createdAt.slice(0, 10) } : {}),
              })),
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
      <RecentlyViewedSection excludeId={product.id} />
    </>
  )
}
