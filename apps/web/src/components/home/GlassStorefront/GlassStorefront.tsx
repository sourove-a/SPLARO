'use client'

import { useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { HeroSlider } from '@/components/home/HeroSlider'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { TrustBar } from '@/components/home/TrustBar'
import { HomeDepartmentRows } from '@/components/home/HomeDepartmentRows'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import type { HeroBanner } from '@/lib/api/banners'
import type { HomepageDepartmentRow } from '@/lib/catalog/homepage-department-rows'
import { resolveHomepageSections } from '@/lib/storefront/homepage-defaults'
import { NewsletterSection } from '@/components/home/NewsletterSection/NewsletterSection'

function isDeptHiddenInNav(
  slug: string,
  headerNav: Array<{ href?: string; label?: string; hidden?: boolean }>,
): boolean {
  const slugLc = slug.toLowerCase()
  const match = headerNav.find((item) => {
    const href = (item.href ?? '').split('?')[0]?.replace(/\/$/, '') ?? ''
    const label = (item.label ?? '').trim().toLowerCase()
    if (label === slugLc) return true
    if (slugLc === 'accessories') {
      return href === '/accessories' || href.endsWith('/accessories')
    }
    return (
      href === `/c/${slugLc}` ||
      href === `/collections/${slugLc}` ||
      href.endsWith(`/c/${slugLc}`) ||
      href.endsWith(`/collections/${slugLc}`)
    )
  })
  return match?.hidden === true
}

const SpecialOffer = dynamic(
  () => import('@/components/home/SpecialOffer').then((m) => m.SpecialOffer),
)

interface GlassStorefrontProps {
  departmentRows?: HomepageDepartmentRow[]
  heroBanners?: HeroBanner[]
  showHero?: boolean
  storySlot?: ReactNode
}

/**
 * Home composition — always visible content (no scroll-hide).
 * Premium feel comes from Pearl glass, motion language hover, and idle sheens —
 * not from opacity:0 gates that feel slow/janky.
 */
export function GlassStorefront({
  departmentRows = [],
  heroBanners = [],
  showHero = false,
  storySlot,
}: GlassStorefrontProps) {
  const settings = useStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const offer = settings.config.specialOffer
  const showSpecialOffer =
    Boolean(homepage.specialOffer) &&
    Boolean(offer?.enabled) &&
    Boolean(offer?.title?.trim())
  const showNewsletter = homepage.newsletter && (settings.config.newsletter?.enabled ?? true)
  const visibleDepartmentRows = useMemo(() => {
    const nav = settings.config.headerNav ?? []
    return departmentRows.filter((row) => !isDeptHiddenInNav(row.slug, nav))
  }, [departmentRows, settings.config.headerNav])
  const showCatalog = homepage.catalog && visibleDepartmentRows.length > 0

  return (
    <>
      {showHero && homepage.hero ? (
        <HeroSlider initialBanners={heroBanners} />
      ) : null}

      {homepage.marquee || homepage.trustBar ? (
        <div className="home-post-hero">
          {homepage.marquee ? <MarqueeStrip /> : null}
          {homepage.trustBar ? <TrustBar /> : null}
        </div>
      ) : null}

      <div className="ed-root">
        {showSpecialOffer ? <SpecialOffer /> : null}

        {showCatalog ? (
          <section className="ed-catalog-intro" aria-label="Shop by department">
            <div className="ed-catalog-intro__ambient" aria-hidden />
            <HomeDepartmentRows rows={visibleDepartmentRows} />
          </section>
        ) : null}

        {storySlot}

        {showNewsletter ? <NewsletterSection /> : null}
      </div>
    </>
  )
}
