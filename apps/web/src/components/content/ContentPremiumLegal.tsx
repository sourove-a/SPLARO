'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Copyright,
  FileText,
  Landmark,
  PackageCheck,
  Scale,
  ScrollText,
  Tag,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

import { AccountGlass } from '@/components/account/AccountGlass'
import type { SitePageSection } from '@/lib/content/site-pages'
import { fadeUp, type staggerContainer } from '@/lib/motion/variants'
import { splitLegalLines } from '@/components/content/split-legal-lines'

function resolveClauseIcon(heading: string): LucideIcon {
  const h = heading.toLowerCase()

  if (h.includes('agreement')) return ScrollText
  if (h.includes('product') || h.includes('pricing')) return Tag
  if (h.includes('order')) return PackageCheck
  if (h.includes('account')) return UserCog
  if (h.includes('intellectual') || h.includes('property')) return Copyright
  if (h.includes('liability') || h.includes('limitation')) return AlertTriangle
  if (h.includes('governing') || h.includes('law')) return Landmark
  if (h.includes('payment') || h.includes('refund')) return Scale

  return FileText
}

function formatClauseIndex(index: number): string {
  return String(index + 1).padStart(2, '0')
}

const lineStagger: typeof staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
}

type PremiumClauseProps = {
  section: SitePageSection
  index: number
  total: number
}

function PremiumClause({ section, index, total }: PremiumClauseProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px -6% 0px' })
  const reducedMotion = useReducedMotion()
  const Icon = resolveClauseIcon(section.heading)
  const lines = splitLegalLines(section.body)
  const animate = reducedMotion ? true : inView

  return (
    <motion.article
      ref={ref}
      className="legal-premium__clause"
      initial={reducedMotion ? false : { opacity: 0, y: 28 }}
      animate={animate ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1], delay: reducedMotion ? 0 : index * 0.04 }}
    >
      <div className="legal-premium__node" aria-hidden="true">
        <span className="legal-premium__node-ring" />
        <span className="legal-premium__node-icon">
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </span>
        {index < total - 1 ? <span className="legal-premium__node-line" /> : null}
      </div>

      <div className="legal-premium__clause-rim">
        <AccountGlass className="legal-premium__clause-glass">
          <div className="legal-premium__clause-shimmer" aria-hidden="true" />
          <div className="legal-premium__clause-head">
            <p className="legal-premium__clause-index">Clause {formatClauseIndex(index)}</p>
            <h2 className="legal-premium__clause-title">{section.heading}</h2>
          </div>

          <motion.ul
            className="legal-premium__lines"
            variants={lineStagger}
            initial={reducedMotion ? false : 'hidden'}
            animate={animate ? 'visible' : 'hidden'}
          >
            {lines.map((line, lineIndex) => (
              <motion.li
                key={`${section.heading}-${lineIndex}`}
                className="legal-premium__line"
                variants={fadeUp}
              >
                <span className="legal-premium__line-dot" aria-hidden="true" />
                <span className="legal-premium__line-copy">{line}</span>
              </motion.li>
            ))}
          </motion.ul>
        </AccountGlass>
      </div>
    </motion.article>
  )
}

type ContentPremiumLegalProps = {
  title: string
  description: string
  sections: SitePageSection[]
  badge?: string
}

export function ContentPremiumLegal({
  title,
  description,
  sections,
  badge = 'Legal · 2026',
}: ContentPremiumLegalProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="content-page legal-premium account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />
      <div className="legal-premium__mesh" aria-hidden="true" />
      <div className="legal-premium__grain" aria-hidden="true" />

      <div className="legal-premium__watermark" aria-hidden="true">
        <Image
          src="/images/logo/splaro-brand-mark-transparent.png"
          alt=""
          width={280}
          height={112}
          className="legal-premium__watermark-logo"
          unoptimized
        />
      </div>

      <div className="legal-premium__layout">
        <motion.div
          className="legal-premium__hero-wrap"
          initial={reducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
        >
          <AccountGlass className="legal-premium__hero">
            <div className="legal-premium__hero-shimmer" aria-hidden="true" />

            <Link href="/" className="content-page__back legal-premium__back">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
              Back to home
            </Link>

            <div className="legal-premium__crest" aria-hidden="true">
              <span className="legal-premium__crest-orbit" />
              <span className="legal-premium__crest-ring" />
              <span className="legal-premium__crest-glass">
                <Image
                  src="/images/logo/splaro-brand-mark-transparent.png"
                  alt=""
                  width={168}
                  height={68}
                  priority
                  className="legal-premium__crest-logo"
                  unoptimized
                />
              </span>
            </div>

            <p className="legal-premium__badge">{badge}</p>
            <h1 className="legal-premium__title">{title}</h1>
            <p className="legal-premium__description">{description}</p>
          </AccountGlass>
        </motion.div>

        <div className="legal-premium__timeline">
          {sections.map((section, index) => (
            <PremiumClause
              key={section.heading}
              section={section}
              index={index}
              total={sections.length}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
