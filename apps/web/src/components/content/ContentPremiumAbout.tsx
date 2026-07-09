'use client'

import Link from 'next/link'
import { useRef } from 'react'
import {
  ArrowLeft,
  Crown,
  Gem,
  HeartHandshake,
  Leaf,
  MapPinned,
  PenTool,
  Sparkles,
  Sprout,
  Sunrise,
  type LucideIcon,
} from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

import { AccountGlass } from '@/components/account/AccountGlass'
import { splitLegalLines } from '@/components/content/split-legal-lines'
import type { SitePageSection } from '@/lib/content/site-pages'
import { fadeUp, type staggerContainer } from '@/lib/motion/variants'

const HERO_ORBIT_ICONS = [
  { Icon: Sparkles, position: 'a' },
  { Icon: Gem, position: 'b' },
  { Icon: PenTool, position: 'c' },
  { Icon: Leaf, position: 'd' },
  { Icon: HeartHandshake, position: 'e' },
] as const

type AboutTone = 'story' | 'design' | 'sustain' | 'community' | 'visit' | 'default'

function resolveAboutIcon(heading: string): { Icon: LucideIcon; tone: AboutTone } {
  const h = heading.toLowerCase()

  if (h.includes('story')) return { Icon: Sunrise, tone: 'story' }
  if (h.includes('design')) return { Icon: PenTool, tone: 'design' }
  if (h.includes('sustain')) return { Icon: Sprout, tone: 'sustain' }
  if (h.includes('community')) return { Icon: HeartHandshake, tone: 'community' }
  if (h.includes('visit')) return { Icon: MapPinned, tone: 'visit' }

  return { Icon: Sparkles, tone: 'default' }
}

function formatStoryIndex(index: number): string {
  return String(index + 1).padStart(2, '0')
}

const lineStagger: typeof staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

type AboutStoryCardProps = {
  section: SitePageSection
  index: number
}

function AboutStoryCard({ section, index }: AboutStoryCardProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8% 0px -6% 0px' })
  const reducedMotion = useReducedMotion()
  const { Icon, tone } = resolveAboutIcon(section.heading)
  const lines = splitLegalLines(section.body)
  const animate = reducedMotion ? true : inView

  return (
    <motion.article
      ref={ref}
      className="about-premium__story"
      initial={reducedMotion ? false : { opacity: 0, y: 32 }}
      animate={animate ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{
        duration: 0.64,
        ease: [0.16, 1, 0.3, 1],
        delay: reducedMotion ? 0 : index * 0.06,
      }}
    >
      <div className="about-premium__story-rim">
        <AccountGlass className="about-premium__story-glass">
          <div className="about-premium__story-shimmer" aria-hidden="true" />

          <div className="about-premium__story-head">
            <span className={`about-premium__story-icon about-premium__story-icon--${tone}`}>
              <Icon className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <div className="about-premium__story-meta">
              <p className="about-premium__story-index">Chapter {formatStoryIndex(index)}</p>
              <h2 className="about-premium__story-title">{section.heading}</h2>
            </div>
          </div>

          <motion.ul
            className="about-premium__lines"
            variants={lineStagger}
            initial={reducedMotion ? false : 'hidden'}
            animate={animate ? 'visible' : 'hidden'}
          >
            {lines.map((line, lineIndex) => (
              <motion.li
                key={`${section.heading}-${lineIndex}`}
                className="about-premium__line"
                variants={fadeUp}
              >
                <span className={`about-premium__line-accent about-premium__line-accent--${tone}`} />
                <span className="about-premium__line-copy">{line}</span>
              </motion.li>
            ))}
          </motion.ul>
        </AccountGlass>
      </div>
    </motion.article>
  )
}

type ContentPremiumAboutProps = {
  title: string
  description: string
  sections: SitePageSection[]
  badge?: string
}

export function ContentPremiumAbout({
  title,
  description,
  sections,
  badge = 'Crafted in Dhaka',
}: ContentPremiumAboutProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="content-page about-premium account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />
      <div className="about-premium__mesh" aria-hidden="true" />
      <div className="about-premium__grain" aria-hidden="true" />

      <div className="about-premium__layout">
        <motion.div
          className="about-premium__hero-wrap"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
        >
          <AccountGlass className="about-premium__hero">
            <div className="about-premium__hero-shimmer" aria-hidden="true" />

            <Link href="/" className="content-page__back about-premium__back">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
              Back to home
            </Link>

            <div className="about-premium__constellation" aria-hidden="true">
              <span className="about-premium__constellation-ring" />
              {HERO_ORBIT_ICONS.map(({ Icon, position }, orbitIndex) => {
                const floatMotion = reducedMotion
                  ? {}
                  : {
                      animate: {
                        y: [0, -7, 0] as [number, number, number],
                        rotate: [0, orbitIndex % 2 === 0 ? 5 : -5, 0] as [number, number, number],
                      },
                      transition: {
                        duration: 4.2 + orbitIndex * 0.35,
                        repeat: Infinity,
                        ease: 'easeInOut' as const,
                      },
                    }

                return (
                  <motion.span
                    key={position}
                    className={`about-premium__orbit about-premium__orbit--${position}`}
                    {...floatMotion}
                  >
                    <span className="about-premium__orbit-glass">
                      <Icon className="h-4 w-4" strokeWidth={2.1} />
                    </span>
                  </motion.span>
                )
              })}
              <span className="about-premium__constellation-core">
                <Crown className="h-6 w-6" strokeWidth={2} />
              </span>
            </div>

            <p className="about-premium__badge">{badge}</p>
            <h1 className="about-premium__title">{title}</h1>
            <p className="about-premium__description">{description}</p>

            <div className="about-premium__hero-pills" aria-hidden="true">
              <span>Premium everyday</span>
              <span>Designed in Dhaka</span>
              <span>Made for Bangladesh</span>
            </div>
          </AccountGlass>
        </motion.div>

        <div className="about-premium__stories">
          {sections.map((section, index) => (
            <AboutStoryCard key={section.heading} section={section} index={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
