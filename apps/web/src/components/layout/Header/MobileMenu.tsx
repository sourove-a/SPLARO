'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import { SplaroBrandLogo, logoUrlProp } from '@/components/brand/SplaroBrandLogo'
import { LiquidGlassPill } from '@/components/ui/LiquidGlass'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveWhatsAppNumber, whatsAppHref } from '@/lib/storefront/contact'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

const backdrop = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
}

const sheet = {
  hidden: { y: '-18%', opacity: 0, scale: 0.96 },
  show: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', damping: 28, stiffness: 260, mass: 0.85 },
  },
  exit: {
    y: '-12%',
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] },
  },
}

const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.12 } },
}

const item = {
  hidden: { opacity: 0, x: -14 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
  },
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const settings = useStorefrontSettings()
  const navItems = (settings.config.headerNav ?? []).filter((item) => !item.hidden)
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.dataset.menuOpen = 'true'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      delete document.body.dataset.menuOpen
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) setOpenLabel(null)
  }, [isOpen])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="mm-backdrop"
            variants={backdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mm-glass-overlay__blur z-menu-backdrop fixed inset-0"
            aria-hidden
            onClick={onClose}
          />

          <motion.div
            key="mm-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            variants={sheet}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mm-glass-overlay z-menu-panel fixed inset-0 flex flex-col overflow-hidden"
          >
            <div className="mm-glass-overlay__shine" aria-hidden />

            <div className="relative z-[2] flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.65rem)]">
              <SplaroBrandLogo
                href="/"
                size="header"
                tone="light"
                onClick={onClose}
                {...logoUrlProp(settings.store.logo)}
              />
              <button type="button" onClick={onClose} aria-label="Close menu" className="mm-glass-close">
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <nav
              className="relative z-[2] min-h-0 flex-1 overflow-y-auto px-4 pt-2"
              data-lenis-prevent
              aria-label="Mobile navigation"
            >
              <motion.div
                className="mm-glass-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.ul variants={list} initial="hidden" animate="show" className="mm-glass-list">
                  {navItems.map((navItem) => {
                    const subs = navItem.megaMenu?.categories ?? []
                    const isOpen_ = openLabel === navItem.label

                    return (
                      <motion.li key={navItem.label} variants={item}>
                        {subs.length > 0 ? (
                          <div>
                            <button
                              type="button"
                              className="mm-glass-pill mm-glass-pill--btn"
                              onClick={() => setOpenLabel(isOpen_ ? null : navItem.label)}
                              aria-expanded={isOpen_}
                            >
                              <span>{navItem.label}</span>
                              <motion.span animate={{ rotate: isOpen_ ? 180 : 0 }} transition={{ duration: 0.22 }}>
                                <ChevronDown className="h-4 w-4 opacity-45" strokeWidth={2} />
                              </motion.span>
                            </button>
                            <AnimatePresence initial={false}>
                              {isOpen_ && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                  className="mm-glass-sub overflow-hidden"
                                >
                                  <Link
                                    href={navItem.href}
                                    onClick={onClose}
                                    className="mm-glass-sub__item mm-glass-sub__item--all"
                                  >
                                    Shop all {navItem.label}
                                  </Link>
                                  {navItem.label === 'Accessories' ? (
                                    <div className="mega-menu-mobile-pills">
                                      {subs.map((sub) => (
                                        <LiquidGlassPill
                                          key={sub.href}
                                          href={sub.href}
                                          size="sm"
                                          onClick={onClose}
                                        >
                                          {sub.label}
                                        </LiquidGlassPill>
                                      ))}
                                    </div>
                                  ) : (
                                    <ul>
                                      {subs.map((sub) => (
                                        <li key={sub.label}>
                                          <Link href={sub.href} onClick={onClose} className="mm-glass-sub__item">
                                            {sub.label}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <Link href={navItem.href} onClick={onClose} className="mm-glass-pill">
                            {navItem.label}
                          </Link>
                        )}
                      </motion.li>
                    )
                  })}
                </motion.ul>
              </motion.div>
            </nav>

            <motion.div
              className="mm-glass-footer mm-glass-footer--dock relative z-[2] shrink-0 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              <a
                href={whatsAppHref(resolveWhatsAppNumber(settings))}
                target="_blank"
                rel="noopener noreferrer"
                className="mm-glass-support-btn"
                onClick={onClose}
              >
                Support
              </a>
              <div className="mm-glass-footer__links">
                <Link href="/login" onClick={onClose} className="mm-glass-footer__link">Sign in</Link>
                <span className="mm-glass-footer__dot" />
                <Link href="/contact" onClick={onClose} className="mm-glass-footer__link">Contact</Link>
                <span className="mm-glass-footer__dot" />
                <Link href="/shop" onClick={onClose} className="mm-glass-footer__link">All products</Link>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
