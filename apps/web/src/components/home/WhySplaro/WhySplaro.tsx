'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveStoreLogo } from '@/components/brand/SplaroBrandLogo'
import { resolveOurStory } from '@/lib/storefront/homepage-defaults'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useMotionReady } from '@/hooks/useMotionReady'
import { CustomerStoriesDropdown } from './CustomerStoriesDropdown'
import { SocialReelsDropdown } from './SocialReelsDropdown'
import { StoryPillarsDropdown } from './StoryPillarsDropdown'
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

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const

function StoryRevealColumn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const { showMotion } = useMotionReady()
  const { ref, isInView } = useScrollReveal({ once: true, margin: '-60px 0px -60px 0px' })

  if (!showMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={
        isInView
          ? { opacity: 1, y: 0, transition: { duration: 0.55, delay, ease: REVEAL_EASE } }
          : { opacity: 0, y: 20 }
      }
    >
      {children}
    </motion.div>
  )
}

export function WhySplaro() {
  const settings = useStorefrontSettings()
  const story = resolveOurStory(settings.config.ourStory)
  const homepage = settings.config.homepage
  const storeLogo = resolveStoreLogo(settings.store.logo ?? '')
  const brandLogo = storeLogo || SPLARO_LOGO
  /** Globe panel inverts dark wordmark to white via CSS. */
  const earthLogo = storeLogo || SPLARO_LOGO

  if (!story.enabled || homepage?.ourStory === false) return null

  return (
    <section className="story-section" aria-labelledby="brand-story-heading">
      <div className="container-luxury">
        <div className="story-grid">
          <StoryRevealColumn className="story-earth-wrap">
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
          </StoryRevealColumn>

          <StoryRevealColumn className="story-content" delay={0.08}>
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

            <StoryPillarsDropdown story={story} />

            <CustomerStoriesDropdown
              enabled={story.customerStories.enabled}
              label={story.customerStories.label}
            />

            <SocialReelsDropdown />
          </StoryRevealColumn>
        </div>
      </div>
    </section>
  )
}
