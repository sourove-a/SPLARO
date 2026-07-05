'use client'

import { useEffect, useState, type ElementType } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Baby,
  ChevronRight,
  Footprints,
  Gem,
  Home,
  ShoppingBag,
  Sparkles,
  Sun,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { SplaroBrandLogo, logoUrlProp } from '@/components/brand/SplaroBrandLogo'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { cn } from '@/lib/utils/cn'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

function navIcon(label: string, href: string): ElementType {
  const key = `${label} ${href}`.toLowerCase()
  if (key.includes('home') || href === '/') return Home
  if (key.includes('summer')) return Sun
  if (key.includes('footwear') || key.includes('shoe')) return Footprints
  if (key.includes('accessor') || key.includes('jewel')) return Gem
  if (key.includes('kid') || key.includes('child') || key.includes('baby')) return Baby
  if (key.includes('women') || key.includes('woman')) return Sparkles
  if (key.includes('men') || key.includes('man')) return Users
  if (key.includes('shop')) return ShoppingBag
  return ShoppingBag
}

const backdrop = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
}

const drawer = {
  hidden: { x: '-100%' },
  show: {
    x: 0,
    transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    x: '-100%',
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
  },
}

const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
}

const itemMotion = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  },
}

function GlassNavIcon({ label, href }: { label: string; href: string }) {
  const Icon = navIcon(label, href)
  return (
    <span className="mm-drawer__glass-icon" aria-hidden>
      <Icon className="h-[0.95rem] w-[0.95rem]" strokeWidth={1.85} />
    </span>
  )
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
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
            className="mm-drawer-backdrop z-menu-backdrop fixed inset-0"
            aria-hidden
            onClick={onClose}
          />

          <motion.aside
            key="mm-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            variants={drawer}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mm-drawer mm-drawer--left z-menu-panel fixed inset-y-0 left-0 flex flex-col"
          >
            <div className="mm-drawer__shine" aria-hidden />

            <header className="mm-drawer__head">
              <SplaroBrandLogo
                href="/"
                size="header"
                tone="light"
                onClick={onClose}
                className="mm-drawer__logo"
                {...logoUrlProp(settings.store.logo)}
              />
              <button type="button" onClick={onClose} aria-label="Close menu" className="mm-drawer__close">
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>

            <p className="mm-drawer__eyebrow">Menu</p>

            <nav className="mm-drawer__nav" data-lenis-prevent aria-label="Mobile navigation">
              <motion.ul variants={list} initial="hidden" animate="show" className="mm-drawer__list">
                {navItems.map((navItem) => {
                  const subs = navItem.megaMenu?.categories ?? []
                  const expanded = openLabel === navItem.label

                  return (
                    <motion.li key={navItem.label} variants={itemMotion} className="mm-drawer__group">
                      {subs.length > 0 ? (
                        <>
                          <button
                            type="button"
                            className={cn('mm-drawer__glass mm-drawer__glass--btn', expanded && 'mm-drawer__glass--open')}
                            onClick={() => setOpenLabel(expanded ? null : navItem.label)}
                            aria-expanded={expanded}
                          >
                            <GlassNavIcon label={navItem.label} href={navItem.href} />
                            <span className="mm-drawer__glass-label">{navItem.label}</span>
                            <motion.span
                              className="mm-drawer__chevron"
                              animate={{ rotate: expanded ? 90 : 0 }}
                              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                            </motion.span>
                          </button>
                          <AnimatePresence initial={false}>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                                className="mm-drawer__sub overflow-hidden"
                              >
                                <Link href={navItem.href} onClick={onClose} className="mm-drawer__sub-link mm-drawer__sub-link--all">
                                  All {navItem.label}
                                </Link>
                                {subs.map((sub) => (
                                  <Link key={sub.href} href={sub.href} onClick={onClose} className="mm-drawer__sub-link">
                                    {sub.label}
                                  </Link>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      ) : (
                        <Link href={navItem.href} onClick={onClose} className="mm-drawer__glass">
                          <GlassNavIcon label={navItem.label} href={navItem.href} />
                          <span className="mm-drawer__glass-label">{navItem.label}</span>
                          <ChevronRight className="mm-drawer__chevron-icon h-3.5 w-3.5" strokeWidth={2} />
                        </Link>
                      )}
                    </motion.li>
                  )
                })}
              </motion.ul>
            </nav>

            <footer className="mm-drawer__foot">
              <div className="mm-drawer__foot-glass">
                <Link href="/login" onClick={onClose} className="mm-drawer__signin">
                  <span className="mm-drawer__signin-icon" aria-hidden>
                    <UserRound className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.75} />
                  </span>
                  <span className="mm-drawer__signin-copy">
                    <span className="mm-drawer__signin-title">Sign in</span>
                    <span className="mm-drawer__signin-hint">Account & orders</span>
                  </span>
                  <ChevronRight className="mm-drawer__signin-arrow h-3.5 w-3.5" strokeWidth={2} />
                </Link>

                <div className="mm-drawer__quick">
                  <Link href="/contact" onClick={onClose} className="mm-drawer__quick-link">
                    Contact
                  </Link>
                  <Link href="/shop" onClick={onClose} className="mm-drawer__quick-link">
                    Shop all
                  </Link>
                </div>
              </div>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
