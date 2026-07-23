'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { motion, useReducedMotion } from '@/lib/motion/react'

import { AccountGlass } from '@/components/account/AccountGlass'
import { PremiumIcon } from '@/components/ui/PremiumIcon'
import type { SitePageSection } from '@/lib/content/site-pages'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'
import { GENTLE } from '@/lib/motion/config'

type ContentPremiumContactProps = {
  title: string
  description: string
  sections: SitePageSection[]
  badge?: string
  children?: ReactNode
}

export function ContentPremiumContact({
  title,
  description,
  sections,
  badge = 'Customer Care',
  children,
}: ContentPremiumContactProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="content-page contact-premium account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />
      <div className="contact-premium__mesh" aria-hidden="true" />

      <div className="contact-premium__layout">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={GENTLE}
        >
          <AccountGlass tilt className="contact-premium__hero">
            <Link href="/" className="content-page__back contact-premium__back">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
              Back to home
            </Link>

            <div className="contact-premium__hero-icon" aria-hidden="true">
              <PremiumIcon icon={MessageCircle} size="lg" />
            </div>

            <p className="contact-premium__badge">{badge}</p>
            <h1 className="contact-premium__title">{title}</h1>
            <p className="contact-premium__description">{description}</p>
          </AccountGlass>
        </motion.div>

        {sections.length > 0 ? (
          <motion.div
            className="contact-premium__info-grid"
            variants={staggerContainer}
            initial={reducedMotion ? false : 'hidden'}
            animate="visible"
          >
            {sections.map((section) => (
              <motion.div key={section.heading} variants={fadeUp}>
                <AccountGlass className="contact-premium__info-card">
                  <p className="contact-premium__info-kicker">{section.heading}</p>
                  <p className="contact-premium__info-body">{section.body}</p>
                </AccountGlass>
              </motion.div>
            ))}
          </motion.div>
        ) : null}

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
