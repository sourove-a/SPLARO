/**
 * GEO / AEO helpers — structured data that helps answer engines cite SPLARO.
 */

import { serializeJsonLd } from '@/lib/seo/json-ld'
import type { SitePageSection } from '@/lib/content/site-pages'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co').replace(/\/+$/, '')

export function buildFaqPageJsonLd(sections: SitePageSection[]): string {
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/faq#faq`,
    url: `${SITE_URL}/faq`,
    mainEntity: sections.map((section) => ({
      '@type': 'Question',
      name: section.heading,
      acceptedAnswer: {
        '@type': 'Answer',
        text: section.body,
      },
    })),
  })
}

type LocalBusinessInput = {
  name: string
  address: string
  telephone?: string
  email?: string
}

export function buildLocalBusinessJsonLd({
  name,
  address,
  telephone,
  email,
}: LocalBusinessInput): string {
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': ['ClothingStore', 'LocalBusiness'],
    '@id': `${SITE_URL}/stores#studio`,
    name,
    url: `${SITE_URL}/stores`,
    image: `${SITE_URL}/images/logo/splaro-logo-black-premium.png`,
    description:
      'SPLARO studio in Uttara, Dhaka — quiet luxury fashion for men, women, and kids with nationwide online delivery across Bangladesh.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: 'Dhaka',
      addressRegion: 'Dhaka',
      postalCode: '1230',
      addressCountry: 'BD',
    },
    areaServed: { '@type': 'Country', name: 'Bangladesh' },
    priceRange: '৳৳',
    currenciesAccepted: 'BDT',
    paymentAccepted: 'Cash, Cash on Delivery, Mobile Banking, Card',
    ...(telephone ? { telephone } : {}),
    ...(email ? { email } : {}),
    sameAs: [
      'https://www.instagram.com/splaro.bd',
      'https://www.facebook.com/SPLARO/',
      'https://www.youtube.com/@SPLARO',
    ],
  })
}

export function buildBreadcrumbJsonLd(
  crumbs: Array<{ name: string; path: string }>,
): string {
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.path.startsWith('http') ? crumb.path : `${SITE_URL}${crumb.path}`,
    })),
  })
}

export function buildArticleJsonLd(input: {
  title: string
  description: string
  path: string
  dateModified?: string
}): string {
  const url = `${SITE_URL}${input.path}`
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'SPLARO', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'SPLARO',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo/splaro-logo-black-premium.png`,
      },
    },
    dateModified: input.dateModified ?? new Date().toISOString().slice(0, 10),
    inLanguage: 'en-BD',
  })
}

export { SITE_URL as GEO_SITE_URL }
