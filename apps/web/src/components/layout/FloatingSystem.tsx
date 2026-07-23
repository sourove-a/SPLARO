'use client'

import { useEffect, useId, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useScrollPastViewport, useScrollToTop } from '@/hooks/useScrollY'
import { motion, AnimatePresence } from '@/lib/motion/react'
import { ChevronUp } from 'lucide-react'
import { MICRO } from '@/lib/motion/config'
import { cn } from '@/lib/utils/cn'
import { useUiStore } from '@/store/uiStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveWhatsAppNumber, whatsAppHref } from '@/lib/storefront/contact'

/**
 * ILYN-style liquid support FAB:
 * blurred color orbs behind translucent glass + gradient rim mask.
 * Shape: border-radius 50% 50% 4px (tip bottom-right).
 * @see https://ilyn.global/bd/en
 */
function SupportLiquidGlow({ uid, dimmed = false }: { uid: string; dimmed?: boolean }) {
  const f0 = `${uid}-f0`
  const f1 = `${uid}-f1`
  const f2 = `${uid}-f2`
  const paint = `${uid}-paint`
  return (
    <svg
      className={cn('support-glass-btn__glow', dimmed && 'support-glass-btn__glow--dim')}
      width="112"
      height="109"
      viewBox="0 0 112 109"
      fill="none"
      aria-hidden
    >
      <g filter={`url(#${f0})`}>
        <circle cx="69.6985" cy="48.5766" r="9.38791" fill="#00C8B3" />
      </g>
      <g filter={`url(#${f1})`}>
        <circle cx="45.0598" cy="67.3526" r="9.38791" fill="#0088FF" />
      </g>
      <g filter={`url(#${f2})`}>
        <circle cx="41.5364" cy="41.536" r="9.38791" fill={`url(#${paint})`} />
      </g>
      <defs>
        <filter
          id={f0}
          x="28.1624"
          y="7.04051"
          width="83.0717"
          height="83.0721"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="16.0741" result="effect1" />
        </filter>
        <filter
          id={f1}
          x="3.52373"
          y="25.8165"
          width="83.0717"
          height="83.0721"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="16.0741" result="effect1" />
        </filter>
        <filter
          id={f2}
          x="0"
          y="0"
          width="83.0717"
          height="83.0721"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="16.0741" result="effect1" />
        </filter>
        <linearGradient
          id={paint}
          x1="36.2674"
          y1="-1.47593"
          x2="57.0317"
          y2="1.0677"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A078C7" />
          <stop offset="0.5" stopColor="#FF631B" />
          <stop offset="1" stopColor="#C1B6AE" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function SupportTypingDots() {
  return (
    <span className="support-live-bubble" aria-hidden>
      <span className="support-live-bubble__dot" />
      <span className="support-live-bubble__dot" />
      <span className="support-live-bubble__dot" />
    </span>
  )
}

export function FloatingSystem() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const isPdp = pathname.startsWith('/products/')
  // Home + PDP: wait until the visitor scrolls before showing chat — the
  // bubble was covering the product description / CTA area on first paint.
  const pastHero = useScrollPastViewport(isPdp ? 0.35 : 0.7)
  const showTop = useScrollPastViewport(isHome ? 1.15 : 0.55)
  const showChat = (!isHome && !isPdp) || pastHero
  const scrollToTop = useScrollToTop()
  const isMobileMenuOpen = useUiStore((s) => s.isMobileMenuOpen)
  const settings = useStorefrontSettings()
  const [filterOpen, setFilterOpen] = useState(false)
  const glowId = useId().replace(/:/g, '')

  useEffect(() => {
    const sync = () => setFilterOpen(document.body.hasAttribute('data-filter-open'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-filter-open'] })
    return () => observer.disconnect()
  }, [])

  const whatsappUrl = whatsAppHref(resolveWhatsAppNumber(settings))
  const hasWhatsApp = whatsappUrl !== '#'
  const chatVisible = hasWhatsApp && showChat

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
            whileHover={{ opacity: 0.92 }}
            whileTap={{ opacity: 0.88 }}
            transition={MICRO}
            className="support-glass-btn support-glass-btn--circle support-glass-btn--scroll"
          >
            <SupportLiquidGlow uid={`${glowId}-top`} dimmed />
            <span className="support-glass-btn__border" aria-hidden="true" />
            <span className="support-glass-btn__face">
              <ChevronUp className="support-glass-btn__chevron" strokeWidth={2.1} />
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {chatVisible ? (
        <motion.a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          initial={isHome || isPdp ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ opacity: 0.95 }}
          whileTap={{ opacity: 0.9 }}
          transition={MICRO}
          className={cn('support-glass-btn support-glass-btn--main')}
        >
          <SupportLiquidGlow uid={`${glowId}-chat`} />
          <span className="support-glass-btn__border" aria-hidden="true" />
          <span className="support-glass-btn__face">
            <SupportTypingDots />
          </span>
        </motion.a>
      ) : null}
    </div>
  )
}
