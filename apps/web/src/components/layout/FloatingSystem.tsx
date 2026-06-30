'use client'

import { useState } from 'react'
import { useScrollPastViewport, useScrollToTop } from '@/hooks/useScrollY'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, Phone, MessageCircle, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SupportBubbleIcon } from '@/components/ui/LuxuryIcons'
import { useUiStore } from '@/store/uiStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveWhatsAppNumber, resolveSupportPhone, whatsAppHref } from '@/lib/storefront/contact'

const radialPositions = [
  { x: -78, y: -8 },
  { x: -72, y: -62 },
  { x: -8, y: -98 },
]

export function FloatingSystem() {
  const showTop = useScrollPastViewport(0.55)
  const scrollToTop = useScrollToTop()
  const [open, setOpen] = useState(false)
  const isMobileMenuOpen = useUiStore((s) => s.isMobileMenuOpen)
  const settings = useStorefrontSettings()
  const telegram = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME ?? 'splaro_support'

  const actions = [
    {
      id: 'whatsapp',
      icon: MessageCircle,
      label: 'WhatsApp',
      href: () => whatsAppHref(resolveWhatsAppNumber(settings)),
      external: true,
    },
    {
      id: 'telegram',
      icon: Send,
      label: 'Telegram',
      href: () => `https://t.me/${telegram}`,
      external: true,
    },
    {
      id: 'phone',
      icon: Phone,
      label: 'Call',
      href: () => `tel:${resolveSupportPhone(settings).replace(/[^0-9+]/g, '')}`,
      external: false,
    },
  ]

  if (isMobileMenuOpen) return null

  return (
    <div
      data-floating-system
      className="support-floating-system z-floating-actions fixed flex flex-col items-end gap-3"
    >
      <AnimatePresence>
        {showTop && (
          <motion.button
            onClick={scrollToTop}
            aria-label="Back to top"
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.85 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lux-icon-btn lux-icon-btn--round h-10 w-10"
          >
            <ChevronUp className="h-4 w-4 text-[#101114]" strokeWidth={2.2} />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="relative">
        <AnimatePresence>
          {open && (
            <div className="pointer-events-none absolute bottom-0 right-0 h-[180px] w-[170px]">
              {actions.map(({ id, icon: Icon, label, href, external }, index) => {
                const url = href()
                const position = radialPositions[index]!
                const sharedClass =
                  'pointer-events-auto group absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full lux-icon-btn lux-icon-btn--round'
                const motionProps = {
                  initial: { opacity: 0, x: 0, y: 0, scale: 0.5 },
                  animate: { opacity: 1, x: position.x, y: position.y, scale: 1 },
                  exit: { opacity: 0, x: 0, y: 0, scale: 0.55 },
                  transition: {
                    duration: 0.16,
                    delay: index * 0.02,
                    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                  },
                  whileHover: { scale: 1.06 },
                  whileTap: { scale: 0.94 },
                }

                const inner = (
                  <>
                    <span className="pointer-events-none absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-black/8 bg-black/84 px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.08em] text-white/85 opacity-0 shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition-all duration-200 group-hover:-translate-x-0.5 group-hover:opacity-100">
                      {label}
                    </span>
                    <Icon className="relative z-10 h-4 w-4 text-[#101114]" strokeWidth={2.1} />
                    <span className="sr-only">{label}</span>
                  </>
                )

                return (
                  <motion.a
                    key={id}
                    href={url}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    className={sharedClass}
                    {...motionProps}
                  >
                    {inner}
                  </motion.a>
                )
              })}
            </div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setOpen((value) => !value)}
          aria-label="Open support"
          aria-expanded={open}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className={cn('support-float-btn', !open && 'support-float-btn--sway')}
          data-open={open}
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.14 }}
              >
                <X className="h-4 w-4 text-[#101114]" strokeWidth={2.4} />
              </motion.span>
            ) : (
              <motion.span
                key="chat"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.14 }}
              >
                <SupportBubbleIcon />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  )
}
