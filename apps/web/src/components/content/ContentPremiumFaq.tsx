'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, ChevronDown, HelpCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'

import { AccountGlass } from '@/components/account/AccountGlass'
import type { SitePageSection } from '@/lib/content/site-pages'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'
import { cn } from '@/lib/utils/cn'

type FaqItemProps = {
  section: SitePageSection
  index: number
  open: boolean
  onToggle: () => void
}

function FaqItem({ section, index, open, onToggle }: FaqItemProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div variants={fadeUp} className="faq-premium__item-wrap">
      <AccountGlass className={cn('faq-premium__item', open && 'faq-premium__item--open')}>
        <button
          type="button"
          className="faq-premium__trigger"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className="faq-premium__index">{String(index + 1).padStart(2, '0')}</span>
          <span className="faq-premium__question">{section.heading}</span>
          <span className={cn('faq-premium__chevron', open && 'faq-premium__chevron--open')}>
            <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="body"
              className="faq-premium__panel"
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              {...(reducedMotion ? {} : { exit: { height: 0, opacity: 0 } })}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="faq-premium__answer">{section.body}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </AccountGlass>
    </motion.div>
  )
}

type ContentPremiumFaqProps = {
  title: string
  description: string
  sections: SitePageSection[]
  badge?: string
}

export function ContentPremiumFaq({
  title,
  description,
  sections,
  badge = 'Help Center',
}: ContentPremiumFaqProps) {
  const reducedMotion = useReducedMotion()
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="content-page faq-premium account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />
      <div className="faq-premium__mesh" aria-hidden="true" />

      <div className="faq-premium__layout">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
        >
          <AccountGlass className="faq-premium__hero">
            <Link href="/" className="content-page__back faq-premium__back">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
              Back to home
            </Link>

            <div className="faq-premium__hero-icon" aria-hidden="true">
              <HelpCircle className="h-6 w-6" strokeWidth={2} />
            </div>

            <p className="faq-premium__badge">{badge}</p>
            <h1 className="faq-premium__title">{title}</h1>
            <p className="faq-premium__description">{description}</p>
          </AccountGlass>
        </motion.div>

        <motion.div
          className="faq-premium__list"
          variants={staggerContainer}
          initial={reducedMotion ? false : 'hidden'}
          animate="visible"
        >
          {sections.map((section, index) => (
            <FaqItem
              key={section.heading}
              section={section}
              index={index}
              open={openIndex === index}
              onToggle={() => setOpenIndex((current) => (current === index ? -1 : index))}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
