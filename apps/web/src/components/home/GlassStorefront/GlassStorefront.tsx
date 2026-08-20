'use client'

import { useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { HeroSlider } from '@/components/home/HeroSlider'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { HomeDepartmentRows } from '@/components/home/HomeDepartmentRows'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import type { HeroBanner } from '@/lib/api/banners'
import type { HomepageDepartmentRow } from '@/lib/catalog/homepage-department-rows'
import { resolveHomepageSections } from '@/lib/storefront/homepage-defaults'
import { resolveHomepageSectionOrder, type HomepageSectionId } from '@splaro/config'
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
  const order = resolveHomepageSectionOrder(homepage.order)

  const renderSection = (key: HomepageSectionId) => {
    switch (key) {
      case 'hero':
        return showHero && homepage.hero ? <HeroSlider key="home-hero" initialBanners={heroBanners} /> : null
      case 'marquee':
        return homepage.marquee ? (
          <div key="home-post-hero" className="home-post-hero">
            <MarqueeStrip key="home-marquee" />
          </div>
        ) : null
      case 'specialOffer':
        return showSpecialOffer ? <SpecialOffer key="home-special-offer" /> : null
      case 'catalog':
        return showCatalog ? (
          <section key="home-catalog" className="ed-catalog-intro" aria-label="Shop by department">
            <div className="ed-catalog-intro__ambient" aria-hidden />
            <HomeDepartmentRows rows={visibleDepartmentRows} />
          </section>
        ) : null
      case 'ourStory':
        return storySlot ? <div key="home-story">{storySlot}</div> : null
      case 'newsletter':
        return showNewsletter ? <NewsletterSection key="home-newsletter" /> : null
      case 'trustBar':
      case 'collections':
      case 'instagram':
        return null
      default:
        return null
    }
  }

  const nodes: ReactNode[] = []
  let body: ReactNode[] = []
  const flushBody = () => {
    if (body.length === 0) return
    nodes.push(
      <div key={`home-ed-root-${nodes.length}`} className="ed-root">
        {body}
      </div>,
    )
    body = []
  }

  for (const key of order) {
    const node = renderSection(key)
    if (!node) continue
    if (key === 'hero') {
      flushBody()
      nodes.push(node)
      continue
    }
    if (key === 'marquee') {
      flushBody()
      nodes.push(node)
      continue
    }
    body.push(node)
  }
  flushBody()

  return <>{nodes}</>
}
