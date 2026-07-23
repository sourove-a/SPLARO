'use client'

import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import {
  Baby,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Compass,
  Footprints,
  Gem,
  Home,
  Search,
  ShoppingBag,
  Sparkles,
  Sun,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import { PremiumIcon } from '@/components/ui/PremiumIcon'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'
import { isNavActive } from '@/lib/navigation/is-nav-active'
import { cn } from '@/lib/utils/cn'
import { usePathname } from 'next/navigation'
import { useUiStore } from '@/store/uiStore'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

/** Soft ease — opacity + subtle translate only (no spring bounce). */
const PANEL_EASE = [0.22, 1, 0.36, 1] as const

/** Secondary mobile-only groups — keeps Discover / Our Story off the top rail. */
const MOBILE_EXTRA_GROUPS: Array<{
  label: string
  href: string
  icon: LucideIcon
  links: Array<{ label: string; href: string }>
}> = [
  {
    label: 'Discover',
    href: '/shop',
    icon: Compass,
    links: [
      { label: 'New Arrivals', href: '/new-arrivals' },
      { label: 'Best Sellers', href: '/best-sellers' },
      { label: 'Collections', href: '/collections' },
      { label: 'Shop all', href: '/shop' },
    ],
  },
  {
    label: 'Our Story',
    href: '/about',
    icon: BookOpen,
    links: [
      { label: 'About SPLARO', href: '/about' },
      { label: 'Journal', href: '/editorial' },
      { label: 'Stores', href: '/stores' },
      { label: 'Contact', href: '/contact' },
    ],
  },
]

function navIcon(label: string, href: string): LucideIcon {
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

function GlassNavIcon({ label, href }: { label: string; href: string }) {
  const Icon = navIcon(label, href)
  return <PremiumIcon icon={Icon} size="sm" className="mm-drawer__glass-icon" />
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const pathname = usePathname()
  const settings = useStorefrontSettings()
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const navItems = (settings.config.headerNav ?? []).filter((item) => !item.hidden)
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const reduceMotion = useReducedMotion()
  const drawerRef = useRef<HTMLElement>(null)
  const touchStartX = useRef(0)
  useDialogFocusTrap(isOpen, drawerRef, onClose)
  useOverlayScrollLock(isOpen)

  const openSearch = () => {
    onClose()
    // Let the drawer unmount finish before expanding header search.
    window.setTimeout(() => setSearchOpen(true), 80)
  }

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!isOpen) return
    document.body.dataset.menuOpen = 'true'
    return () => {
      delete document.body.dataset.menuOpen
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) setOpenLabel(null)
  }, [isOpen])

  const fadeTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: PANEL_EASE }

  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: PANEL_EASE }

  const backdrop = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: fadeTransition,
    },
    exit: {
      opacity: 0,
      transition: reduceMotion ? { duration: 0 } : { duration: 0.2, ease: PANEL_EASE },
    },
  }

  const drawer = {
    hidden: { opacity: 0, y: -10 },
    show: {
      opacity: 1,
      y: 0,
      transition: panelTransition,
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: reduceMotion ? { duration: 0 } : { duration: 0.22, ease: PANEL_EASE },
    },
  }

  const list = {
    hidden: {},
    show: {
      transition: reduceMotion
        ? { duration: 0 }
        : { staggerChildren: 0.03, delayChildren: 0.04 },
    },
  }

  const itemMotion = {
    hidden: { opacity: 0, y: 4 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduceMotion
        ? { duration: 0 }
        : { duration: 0.22, ease: PANEL_EASE },
    },
  }

  const subList = {
    hidden: {},
    show: {
      transition: reduceMotion
        ? { duration: 0 }
        : { staggerChildren: 0.025, delayChildren: 0.02 },
    },
  }

  const subItem = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: reduceMotion
        ? { duration: 0 }
        : { duration: 0.18, ease: PANEL_EASE },
    },
  }

  const handleDrawerTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? 0
  }

  const handleDrawerTouchEnd = (event: TouchEvent) => {
    const endX = event.changedTouches[0]?.clientX ?? 0
    if (touchStartX.current - endX > 64) onClose()
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence mode="sync">
      {isOpen ? (
        <>
          <motion.button
            key="mm-backdrop"
            type="button"
            variants={backdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mm-drawer-backdrop z-menu-backdrop fixed inset-x-0 bottom-0"
            aria-label="Close menu"
            onClick={onClose}
          />

          <motion.aside
            key="mm-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            variants={drawer}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mm-drawer mm-drawer--left z-menu-panel fixed left-0 flex flex-col"
            data-lenis-prevent
            onTouchStart={handleDrawerTouchStart}
            onTouchEnd={handleDrawerTouchEnd}
          >
            <div className="mm-drawer__sheen" aria-hidden />
            <div className="mm-drawer__shine" aria-hidden />
            <div className="mm-drawer__sweep" aria-hidden />

            <header className="mm-drawer__head">
              <SplaroBrandLogo
                href="/"
                size="header"
                tone="light"
                onClick={onClose}
                className="mm-drawer__logo"
              />
              <div className="mm-drawer__head-actions">
                <button
                  type="button"
                  onClick={openSearch}
                  aria-label="Search"
                  className="mm-drawer__icon-btn"
                >
                  <Search className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="mm-drawer__icon-btn"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </header>

            <p className="mm-drawer__eyebrow">Menu</p>

            <nav className="mm-drawer__nav" data-lenis-prevent aria-label="Mobile navigation">
              <motion.ul variants={list} initial="hidden" animate="show" className="mm-drawer__list">
                <motion.li variants={itemMotion} className="mm-drawer__group">
                  <button
                    type="button"
                    className="mm-drawer__glass mm-drawer__glass--btn"
                    onClick={openSearch}
                  >
                    <PremiumIcon icon={Search} size="sm" className="mm-drawer__glass-icon" />
                    <span className="mm-drawer__glass-label">Search</span>
                    <span className="mm-drawer__chevron" aria-hidden>
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                  </button>
                </motion.li>
                {navItems.map((navItem) => {
                  const subs = navItem.megaMenu?.categories ?? []
                  const expanded = openLabel === navItem.label
                  const active = isNavActive(pathname, navItem.href)

                  return (
                    <motion.li key={navItem.label} variants={itemMotion} className="mm-drawer__group">
                      {subs.length > 0 ? (
                        <>
                          <button
                            type="button"
                            className={cn(
                              'mm-drawer__glass mm-drawer__glass--btn',
                              expanded && 'mm-drawer__glass--open',
                              active && 'mm-drawer__glass--active',
                            )}
                            onClick={() => setOpenLabel(expanded ? null : navItem.label)}
                            aria-expanded={expanded}
                            aria-current={active ? 'page' : undefined}
                          >
                            <GlassNavIcon label={navItem.label} href={navItem.href} />
                            <span className="mm-drawer__glass-label">{navItem.label}</span>
                            <span
                              className="mm-drawer__chevron"
                              style={{
                                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: reduceMotion
                                  ? undefined
                                  : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                              }}
                            >
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                            </span>
                          </button>
                          {expanded ? (
                            <div className="mm-drawer__sub-wrap">
                              <motion.div
                                variants={subList}
                                initial="hidden"
                                animate="show"
                                className="mm-drawer__sub"
                              >
                                <motion.div variants={subItem}>
                                  <Link
                                    href={navItem.href}
                                    onClick={onClose}
                                    className={cn(
                                      'mm-drawer__sub-link mm-drawer__sub-link--all',
                                      isNavActive(pathname, navItem.href) && 'mm-drawer__sub-link--active',
                                    )}
                                    aria-current={isNavActive(pathname, navItem.href) ? 'page' : undefined}
                                  >
                                    All {navItem.label}
                                  </Link>
                                </motion.div>
                                {subs.map((sub) => {
                                  const subActive = isNavActive(pathname, sub.href)
                                  return (
                                    <motion.div key={sub.href} variants={subItem}>
                                      <Link
                                        href={sub.href}
                                        onClick={onClose}
                                        className={cn(
                                          'mm-drawer__sub-link',
                                          subActive && 'mm-drawer__sub-link--active',
                                        )}
                                        aria-current={subActive ? 'page' : undefined}
                                      >
                                        {sub.label}
                                      </Link>
                                    </motion.div>
                                  )
                                })}
                              </motion.div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <Link
                          href={navItem.href}
                          onClick={onClose}
                          className={cn('mm-drawer__glass', active && 'mm-drawer__glass--active')}
                          aria-current={active ? 'page' : undefined}
                        >
                          <GlassNavIcon label={navItem.label} href={navItem.href} />
                          <span className="mm-drawer__glass-label">{navItem.label}</span>
                          <ChevronRight className="mm-drawer__chevron-icon h-3.5 w-3.5" strokeWidth={2} />
                        </Link>
                      )}
                    </motion.li>
                  )
                })}

                {MOBILE_EXTRA_GROUPS.map((group) => {
                  const Icon = group.icon
                  const expanded = openLabel === group.label
                  const active = group.links.some((link) => isNavActive(pathname, link.href))

                  return (
                    <motion.li key={group.label} variants={itemMotion} className="mm-drawer__group">
                      <div
                        className={cn(
                          'mm-drawer__drop',
                          expanded && 'mm-drawer__drop--open',
                          active && 'mm-drawer__drop--active',
                        )}
                      >
                        <button
                          type="button"
                          className="mm-drawer__drop-head"
                          onClick={() => setOpenLabel(expanded ? null : group.label)}
                          aria-expanded={expanded}
                          aria-controls={`mm-drop-${group.label}`}
                        >
                          <PremiumIcon icon={Icon} size="sm" className="mm-drawer__glass-icon" />
                          <span className="mm-drawer__glass-label">{group.label}</span>
                          <span
                            className="mm-drawer__drop-chevron"
                            style={{
                              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: reduceMotion
                                ? undefined
                                : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                            }}
                            aria-hidden
                          >
                            <ChevronDown className="h-4 w-4" strokeWidth={2} />
                          </span>
                        </button>

                        {expanded ? (
                          <div
                            id={`mm-drop-${group.label}`}
                            role="region"
                            aria-label={group.label}
                            className="mm-drawer__drop-body-wrap"
                          >
                            <motion.div
                              variants={subList}
                              initial="hidden"
                              animate="show"
                              className="mm-drawer__drop-body"
                            >
                              {group.links.map((link) => {
                                const subActive = isNavActive(pathname, link.href)
                                return (
                                  <motion.div key={link.href} variants={subItem}>
                                    <Link
                                      href={link.href}
                                      onClick={onClose}
                                      className={cn(
                                        'mm-drawer__sub-link',
                                        subActive && 'mm-drawer__sub-link--active',
                                      )}
                                      aria-current={subActive ? 'page' : undefined}
                                    >
                                      {link.label}
                                    </Link>
                                  </motion.div>
                                )
                              })}
                            </motion.div>
                          </div>
                        ) : null}
                      </div>
                    </motion.li>
                  )
                })}
              </motion.ul>
            </nav>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
