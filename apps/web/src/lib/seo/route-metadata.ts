import type { Metadata } from 'next'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co').replace(/\/+$/, '')
const DEFAULT_IMAGE = '/og-image.jpg'

interface RouteMetadataOptions {
  title: string
  description: string
  path: `/${string}` | '/'
  image?: string
}

export function createRouteMetadata({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
}: RouteMetadataOptions): Metadata {
  const canonical = new URL(path, `${SITE_URL}/`).toString()
  const socialImage = new URL(image, `${SITE_URL}/`).toString()

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: 'SPLARO',
      locale: 'en_US',
      title,
      description,
      url: canonical,
      images: [{ url: socialImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
  }
}

export function createNoIndexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  }
}
