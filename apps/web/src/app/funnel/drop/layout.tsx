import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { getServerApiBaseUrl } from '@splaro/config'

/**
 * Metadata for a standalone drop.
 *
 * The drop page itself is a client component, so it cannot export
 * `generateMetadata` — which left every subdomain inheriting the storefront's
 * root metadata. A drop shared to WhatsApp or Facebook previewed as
 * "SPLARO | Premium Fashion for Men, Women & Kids" with the storefront's
 * description, and its canonical pointed at `https://splaro.co/`, telling
 * Google the page is a duplicate of the homepage. For a page whose entire job
 * is to receive paid traffic, that is the expensive kind of wrong.
 *
 * A layout can be a server component while the page stays client, so the
 * metadata is resolved here from the host the browser actually asked for.
 */

export const dynamic = 'force-dynamic'

interface ResolvedDrop {
  storeName?: string | null
  headline?: string | null
  subheadline?: string | null
  customProductTitle?: string | null
  customProductDescription?: string | null
  product?: {
    title?: string | null
    description?: string | null
    images?: unknown
  } | null
}

/** The host the browser asked for — behind nginx that is the forwarded one. */
async function requestHost(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-host')?.split(',')[0]?.trim()
  const direct = headerList.get('host')?.split(',')[0]?.trim()
  return (forwarded || direct || '').toLowerCase()
}

function firstImage(product: ResolvedDrop['product']): string | null {
  const images = product?.images
  if (!Array.isArray(images) || !images.length) return null
  const first = images[0]
  if (typeof first === 'string') return first
  if (first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string') {
    return (first as { url: string }).url
  }
  return null
}

/** One line, no markup, short enough for a preview card. */
function toDescription(value: string | null | undefined): string | null {
  if (!value) return null
  const flat = value.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length > 200 ? `${flat.slice(0, 197)}…` : flat
}

async function resolveDrop(host: string): Promise<ResolvedDrop | null> {
  if (!host) return null
  try {
    const base = getServerApiBaseUrl().replace(/\/+$/, '')
    const url = new URL(`${base}/funnel/resolve`)
    url.searchParams.set('host', host)
    // Metadata must never be the thing that holds a page open.
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    return (await res.json()) as ResolvedDrop
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await requestHost()
  const drop = await resolveDrop(host)
  const origin = host ? `https://${host.replace(/:\d+$/, '')}` : undefined

  // Unresolved host: keep the page out of search rather than let it inherit the
  // storefront's identity. A drop that is not configured has nothing to index.
  if (!drop) {
    return {
      title: 'Drop',
      robots: { index: false, follow: false },
      ...(origin ? { metadataBase: new URL(origin), alternates: { canonical: '/' } } : {}),
    }
  }

  const title =
    drop.customProductTitle?.trim() ||
    drop.product?.title?.trim() ||
    drop.headline?.trim() ||
    `${drop.storeName?.trim() || 'SPLARO'} — Exclusive Drop`

  const description =
    toDescription(drop.customProductDescription) ??
    toDescription(drop.subheadline) ??
    toDescription(drop.product?.description) ??
    toDescription(drop.headline)

  const image = firstImage(drop.product)
  const absoluteImage = image && origin ? (image.startsWith('http') ? image : `${origin}${image}`) : null

  return {
    title,
    ...(description ? { description } : {}),
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    // Its own subdomain, never the storefront root — these are separate pages
    // with separate jobs, and the drop is the canonical version of itself.
    alternates: { canonical: '/' },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      ...(description ? { description } : {}),
      ...(origin ? { url: origin } : {}),
      ...(drop.storeName ? { siteName: drop.storeName } : {}),
      ...(absoluteImage ? { images: [{ url: absoluteImage, alt: title }] } : {}),
    },
    twitter: {
      card: absoluteImage ? 'summary_large_image' : 'summary',
      title,
      ...(description ? { description } : {}),
      ...(absoluteImage ? { images: [absoluteImage] } : {}),
    },
  }
}

export default function FunnelDropLayout({ children }: { children: ReactNode }) {
  return children
}
