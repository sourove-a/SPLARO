'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Gem, Heart, Leaf, Sparkles, Sprout, Star, type LucideIcon } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import type { StoryPillarIcon } from '@/lib/storefront/homepage-defaults'
import { resolveStoreLogo } from '@/components/brand/SplaroBrandLogo'
import { resolveOurStory, visiblePillars } from '@/lib/storefront/homepage-defaults'
import { CustomerStoriesDropdown } from './CustomerStoriesDropdown'
import { SocialReelsDropdown } from './SocialReelsDropdown'
import { StoryReadMore } from './StoryReadMore'

const StoryEarthGlobe = dynamic(
  () => import('./StoryEarthGlobe').then((m) => m.StoryEarthGlobe),
  { ssr: false },
)

/** Same PNG wordmarks as header — not the legacy Georgia serif SVG placeholders. */
const SPLARO_LOGO = '/images/logo/splaro-brand-mark-400.webp'
const SPLARO_MARK = '/images/logo/splaro-brand-mark-tab-48.png'
const MARK_SIZE = 48
const LOGO_W = 200
const LOGO_H = 80

const PILLAR_ICONS: Record<StoryPillarIcon, LucideIcon> = {
  sprout: Sprout,
  leaf: Leaf,
  gem: Gem,
  star: Star,
  heart: Heart,
  sparkles: Sparkles,
}

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] },
  }),
}

export function WhySplaro() {
  const settings = useStorefrontSettings()
  const story = resolveOurStory(settings.config.ourStory)
  const homepage = settings.config.homepage
  const pillars = visiblePillars(story)
  const storeLogo = resolveStoreLogo(settings.store.logo ?? '')
  const brandLogo = storeLogo || SPLARO_LOGO
  /** Globe panel inverts dark wordmark to white via CSS. */
  const earthLogo = storeLogo || SPLARO_LOGO

  if (!story.enabled || homepage?.ourStory === false) return null

  return (
    <section className="story-section" aria-labelledby="brand-story-heading">
      <div className="container-luxury">
        <div className="story-grid">
          <motion.div
            className="story-earth-wrap"
            variants={fade}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <div className="story-earth-panel">
              <div className="story-earth-panel__glow" aria-hidden />
              <StoryEarthGlobe />

              {story.showEarthLogo ? (
                <div className="story-earth-panel__logo">
                  <Image
                    src={earthLogo}
                    alt="SPLARO"
                    width={750}
                    height={423}
                    unoptimized
                    className="story-earth-panel__logo-img"
                  />
                </div>
              ) : null}

              <div className="story-earth-panel__heritage">
                <div className="story-earth-panel__mark">
                  <Image
                    src={SPLARO_MARK}
                    alt=""
                    width={MARK_SIZE}
                    height={MARK_SIZE}
                    aria-hidden
                    unoptimized
                    className="story-earth-panel__mark-img"
                  />
                </div>
                <p className="story-earth-panel__tagline">
                  {story.earthTagline1}
                  <br />
                  {story.earthTagline2}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="story-content"
            variants={fade}
            custom={0.08}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <div className="story-brand-lockup">
              <Image
                src={brandLogo}
                alt="SPLARO"
                width={LOGO_W}
                height={LOGO_H}
                unoptimized
                className="story-brand-lockup__logo"
              />
              <span className="story-brand-lockup__eyebrow">{story.eyebrow}</span>
            </div>

            <h2 id="brand-story-heading" className="story-title">
              {story.title}
            </h2>

            <div className="story-divider" aria-hidden />

            <StoryReadMore body1={story.body1} body2={story.body2} />

            {pillars.length ? (
              <div className="story-pillars">
                {pillars.map((pillar, index) => {
                  const Icon = PILLAR_ICONS[pillar.icon] ?? Star
                  return (
                    <motion.article
                      key={pillar.id}
                      className="story-pillar"
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.12 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="story-pillar__sheen" aria-hidden />
                      <Icon className="story-pillar__icon" strokeWidth={1.6} />
                      <div className="story-pillar__rule" aria-hidden />
                      <h3 className="story-pillar__title">{pillar.title}</h3>
                      <p className="story-pillar__body">{pillar.body}</p>
                    </motion.article>
                  )
                })}
              </div>
            ) : null}

            <blockquote className="story-quote">
              <p>&ldquo;{story.quote}&rdquo;</p>
              <footer>— {story.quoteAttribution}</footer>
            </blockquote>

            <CustomerStoriesDropdown
              enabled={story.customerStories.enabled}
              label={story.customerStories.label}
            />

            <SocialReelsDropdown />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
