'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  CreditCard,
  Database,
  FileText,
  Lock,
  Mail,
  Share2,
  Shield,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'

import { AccountGlass } from '@/components/account/AccountGlass'
import type { SitePageSection } from '@/lib/content/site-pages'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'

function resolveSectionIcon(heading: string): LucideIcon {
  const h = heading.toLowerCase()

  if (h.includes('overview') || h.includes('agreement') || h.includes('story')) return Shield
  if (h.includes('collect') || h.includes('information')) return Database
  if (h.includes('use') || h.includes('how it works') || h.includes('tiers')) return UserCheck
  if (h.includes('payment') || h.includes('refund') || h.includes('redeem')) return CreditCard
  if (h.includes('shar') || h.includes('third')) return Share2
  if (h.includes('retention') || h.includes('security') || h.includes('validity')) return Lock
  if (h.includes('right') || h.includes('account')) return UserCheck
  if (h.includes('contact') || h.includes('support') || h.includes('visit')) return Mail

  return FileText
}

function formatSectionIndex(index: number): string {
  return String(index + 1).padStart(2, '0')
}

type ContentSectionGridProps = {
  sections: SitePageSection[]
}

export function ContentSectionGrid({ sections }: ContentSectionGridProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className="content-page__section-grid"
      variants={staggerContainer}
      initial={reducedMotion ? false : 'hidden'}
      animate="visible"
    >
      {sections.map((section, index) => {
        const Icon = resolveSectionIcon(section.heading)

        const card = (
          <AccountGlass className="content-page__section-card">
            <div className="content-page__section-card-head">
              <span className="content-page__section-index">{formatSectionIndex(index)}</span>
              <span className="content-page__section-icon" aria-hidden="true">
                <Icon className="h-4 w-4" strokeWidth={2.1} />
              </span>
            </div>
            <h2 className="content-page__section-title">{section.heading}</h2>
            <p className="content-page__section-body">{section.body}</p>
          </AccountGlass>
        )

        if (reducedMotion) {
          return (
            <div key={section.heading} className="content-page__section-card-wrap">
              {card}
            </div>
          )
        }

        return (
          <motion.div
            key={section.heading}
            className="content-page__section-card-wrap"
            variants={fadeUp}
          >
            {card}
          </motion.div>
        )
      })}
    </motion.div>
  )
}
