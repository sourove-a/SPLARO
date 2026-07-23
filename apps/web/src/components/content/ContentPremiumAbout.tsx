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
  ShieldCheck,
  Sparkles,
  Sprout,
  Sunrise,
  type LucideIcon,
} from 'lucide-react'
import { motion, useInView, useReducedMotion } from '@/lib/motion/react'

import { AccountGlass } from '@/components/account/AccountGlass'
import { PremiumIcon } from '@/components/ui/PremiumIcon'
import { Button } from '@/components/ui/Button'
import { ElectricBorder } from '@/components/ui/ElectricBorder'
import { AboutParticlesField } from '@/components/content/AboutParticlesField'
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
  if (h.includes('trust') || h.includes('earn')) return { Icon: ShieldCheck, tone: 'community' }
  if (h.includes('sustain')) return { Icon: Sprout, tone: 'sustain' }
  if (h.includes('community')) return { Icon: HeartHandshake, tone: 'community' }
  if (h.includes('visit') || h.includes('store')) return { Icon: MapPinned, tone: 'visit' }
  if (h.includes('fabric') || h.includes('fit')) return { Icon: PenTool, tone: 'design' }
  if (h.includes('summer') || h.includes('wardrobe') || h.includes('minimal'))
    return { Icon: Sparkles, tone: 'story' }
  if (h.includes('contributor')) return { Icon: HeartHandshake, tone: 'community' }

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
  const borderLive = useInView(ref, { once: false, amount: 0.2, margin: '12% 0px' })
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
      <ElectricBorder
        className="about-premium__story-electric"
        color="#96acfc"
        speed={0.85}
        chaos={0.1}
        borderRadius={32}
        active={borderLive && !reducedMotion}
        style={{ borderRadius: 32 }}
      >
        <div className="about-premium__story-rim">
          <AccountGlass className="about-premium__story-glass">
            <div className="about-premium__story-shimmer" aria-hidden="true" />

            <div className="about-premium__story-head">
              <span className={`about-premium__story-icon about-premium__story-icon--${tone}`}>
                <PremiumIcon icon={Icon} size="md" />
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
      </ElectricBorder>
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
          <AccountGlass tilt className="about-premium__hero">
            <div className="about-premium__hero-shimmer" aria-hidden="true" />

            <Link href="/" className="content-page__back about-premium__back">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
              Back to home
            </Link>

            <div className="about-premium__constellation" aria-hidden="true">
              <AboutParticlesField className="about-premium__particles" />
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
                      <PremiumIcon icon={Icon} size="xs" />
                    </span>
                  </motion.span>
                )
              })}
              <span className="about-premium__constellation-core">
                <PremiumIcon icon={Crown} size="lg" />
              </span>
            </div>

            <p className="about-premium__badge">{badge}</p>
            <h1 className="about-premium__title">{title}</h1>
            <p className="about-premium__description">{description}</p>

            <div className="about-premium__hero-pills" aria-label="Store promises">
              <span className="about-premium__hero-pill">Authentic products</span>
              <span className="about-premium__hero-pill">COD nationwide</span>
              <span className="about-premium__hero-pill">7-day returns</span>
            </div>

            <div className="about-premium__hero-actions">
              <Button href="/stores" variant="primary" className="about-premium__hero-cta">
                Visit Uttara studio
              </Button>
              <Button href="/contact" variant="secondary" className="about-premium__hero-cta">
                Talk to care
              </Button>
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
