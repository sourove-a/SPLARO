import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, MapPin, Phone, MessageCircle, Navigation } from 'lucide-react'
import { AccountGlass } from '@/components/account/AccountGlass'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import {
  resolveSupportPhone,
  resolveWhatsAppNumber,
  whatsAppHref,
} from '@/lib/storefront/contact'
import { DEFAULT_STORE_ADDRESS, DEFAULT_SUPPORT_EMAIL } from '@/lib/storefront/defaults'
import { buildLocalBusinessJsonLd } from '@/lib/seo/geo-json-ld'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export const metadata: Metadata = createRouteMetadata({
  title: 'Our Store — Uttara Studio',
  description:
    'Visit the SPLARO studio in Uttara, Dhaka, or shop online with nationwide COD delivery across Bangladesh.',
  path: '/stores',
})

function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/**
 * Single-studio locator — address/phone/WhatsApp from storefront settings.
 * Static card + Google Maps deep-link (no Mapbox/Maps JS SDK).
 */
export default async function StoresPage() {
  const settings = await getStorefrontSettings()
  const address = settings.store.address?.trim() || DEFAULT_STORE_ADDRESS
  const label = settings.store.name?.trim() || 'SPLARO Studio'
  const phone = resolveSupportPhone(settings)
  const email =
    settings.store.email?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    DEFAULT_SUPPORT_EMAIL
  const whatsapp = resolveWhatsAppNumber(settings)
  const wa = whatsAppHref(whatsapp, 'Hello SPLARO! I would like to visit the studio.')
  const phoneDigits = phone.replace(/\D/g, '')
  const hasPhone = phoneDigits.length >= 10
  const hasWa = wa !== '#'

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: buildLocalBusinessJsonLd({
            name: label,
            address,
            ...(hasPhone ? { telephone: phone } : {}),
            email,
          }),
        }}
      />
      <div className="content-page account-shell">
        <div className="account-shell__ambient" aria-hidden="true" />

        <div className="content-page__layout">
          <AccountGlass className="content-page__header">
            <Link href="/" className="content-page__back">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
              Back to home
            </Link>
            <p className="content-page__eyebrow">Visit</p>
            <h1 className="content-page__title">Our store</h1>
            <p className="content-page__description">
              One studio in Dhaka — try pieces in person, or order online for delivery across
              Bangladesh.
            </p>
          </AccountGlass>

          <AccountGlass className="content-page__body-wrap">
            <div className="content-page__body">
              <div className="content-page__contact-grid">
                <div className="content-page__contact-card content-page__contact-card--static">
                  <span className="content-page__contact-icon" aria-hidden>
                    <MapPin className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="content-page__contact-copy">
                    <strong>{label}</strong>
                    <span>{address}</span>
                  </div>
                </div>

                <a
                  href={mapsHref(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="content-page__contact-card"
                >
                  <span className="content-page__contact-icon" aria-hidden>
                    <Navigation className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="content-page__contact-copy">
                    <strong>Directions</strong>
                    <span>Open in Google Maps</span>
                  </div>
                </a>

                {hasPhone ? (
                  <a href={`tel:${phoneDigits}`} className="content-page__contact-card">
                    <span className="content-page__contact-icon" aria-hidden>
                      <Phone className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="content-page__contact-copy">
                      <strong>Call</strong>
                      <span>{phone}</span>
                    </div>
                  </a>
                ) : null}

                {hasWa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="content-page__contact-card"
                  >
                    <span className="content-page__contact-icon" aria-hidden>
                      <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="content-page__contact-copy">
                      <strong>WhatsApp</strong>
                      <span>Chat before you visit</span>
                    </div>
                  </a>
                ) : null}
              </div>

              <p className="content-page__contact-hint" style={{ marginTop: '1.25rem' }}>
                Prefer online?{' '}
                <Link href="/shop" className="underline underline-offset-4">
                  Shop the catalog
                </Link>
                {' · '}
                <Link href="/contact" className="underline underline-offset-4">
                  Contact
                </Link>
              </p>
            </div>
          </AccountGlass>
        </div>
      </div>
    </>
  )
}
