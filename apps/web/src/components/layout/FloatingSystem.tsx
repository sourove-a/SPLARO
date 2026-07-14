'use client'

import { useEffect, useState } from 'react'
import { useScrollPastViewport, useScrollToTop } from '@/hooks/useScrollY'
import { motion, AnimatePresence } from '@/lib/motion/react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SupportBubbleIcon } from '@/components/ui/LuxuryIcons'
import { useUiStore } from '@/store/uiStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveWhatsAppNumber, whatsAppHref } from '@/lib/storefront/contact'

const EASE = [0.16, 1, 0.3, 1] as const

export function FloatingSystem() {
  const showTop = useScrollPastViewport(0.55)
  const scrollToTop = useScrollToTop()
  const isMobileMenuOpen = useUiStore((s) => s.isMobileMenuOpen)
  const settings = useStorefrontSettings()
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    const sync = () => setFilterOpen(document.body.hasAttribute('data-filter-open'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-filter-open'] })
    return () => observer.disconnect()
  }, [])

  const whatsappUrl = whatsAppHref(resolveWhatsAppNumber(settings))
  const hasWhatsApp = whatsappUrl !== '#'

  if (isMobileMenuOpen || filterOpen) return null

  return (
    <div data-floating-system className="support-floating-system z-floating-actions">
      <AnimatePresence>
        {showTop ? (
          <motion.button
            type="button"
            onClick={scrollToTop}
            aria-label="Back to top"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            whileHover={{ opacity: 0.9 }}
            whileTap={{ scale: 0.992 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="support-glass-btn support-glass-btn--circle support-glass-btn--scroll"
          >
            <span className="support-glass-btn__shine" aria-hidden="true" />
            <ChevronUp className="support-glass-btn__chevron" strokeWidth={2.25} />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {hasWhatsApp ? (
      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        whileHover={{ opacity: 0.92 }}
        whileTap={{ scale: 0.992 }}
        className={cn('support-glass-btn support-glass-btn--main support-glass-btn--pulse')}
      >
        <span className="support-glass-btn__shine" aria-hidden="true" />
        <span className="support-glass-btn__icon">
          <SupportBubbleIcon />
        </span>
      </motion.a>
      ) : null}
    </div>
  )
}
