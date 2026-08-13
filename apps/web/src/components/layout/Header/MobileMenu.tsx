'use client'

import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { ChevronRight } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'
import { DURATION, EASE_EXPO_OUT } from '@/lib/motion/config'
import { isNavActive } from '@/lib/navigation/is-nav-active'
import { cn } from '@/lib/utils/cn'
import { usePathname } from 'next/navigation'
import { useUiStore } from '@/store/uiStore'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
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
    // Let the drawer finish sliding out before expanding header search.
    window.setTimeout(() => setSearchOpen(true), reduceMotion ? 0 : 280)
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

  const backdropTransition = reduceMotion
    ? { duration: 0 }
    : { duration: DURATION.fast, ease: EASE_EXPO_OUT }

  // Horizontal slide — matches cart drawer (no vertical jump / fade pop).
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'tween' as const, duration: 0.34, ease: EASE_EXPO_OUT }

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="mm-drawer-backdrop z-menu-backdrop fixed inset-x-0 bottom-0"
            aria-label="Close menu"
            onClick={onClose}
          />

          <motion.aside
            key="mm-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
            tabIndex={-1}
            initial={reduceMotion ? { x: 0 } : { x: '-100%' }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { x: 0 } : { x: '-100%' }}
            transition={panelTransition}
            className="mm-drawer mm-drawer--left z-menu-panel fixed left-0 flex flex-col"
            data-lenis-prevent
            onTouchStart={handleDrawerTouchStart}
            onTouchEnd={handleDrawerTouchEnd}
          >
            <p className="mm-drawer__eyebrow">Menu</p>

            <nav className="mm-drawer__nav" data-lenis-prevent aria-label="Mobile navigation">
              <ul className="mm-drawer__list">
                <li className="mm-drawer__group">
                  <button
                    type="button"
                    className="mm-drawer__glass mm-drawer__glass--btn mm-drawer__glass--quiet"
                    onClick={openSearch}
                  >
                    <span className="mm-drawer__glass-label">Search</span>
                  </button>
                </li>
                {navItems.map((navItem) => {
                  const subs = navItem.megaMenu?.categories ?? []
                  const expanded = openLabel === navItem.label
                  const active = isNavActive(pathname, navItem.href)

                  return (
                    <li key={navItem.label} className="mm-drawer__group">
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
                            <span className="mm-drawer__glass-label">{navItem.label}</span>
                            <span
                              className="mm-drawer__chevron"
                              style={{
                                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: reduceMotion
                                  ? undefined
                                  : 'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                              }}
                            >
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                            </span>
                          </button>
                          <AnimatePresence initial={false}>
                            {expanded ? (
                              <motion.div
                                key={`${navItem.label}-sub`}
                                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={
                                  reduceMotion
                                    ? { duration: 0 }
                                    : { duration: 0.28, ease: EASE_EXPO_OUT }
                                }
                                className="mm-drawer__sub-wrap"
                              >
                                <div className="mm-drawer__sub">
                                  <Link
                                    href={navItem.href}
                                    onClick={onClose}
                                    className={cn(
                                      'mm-drawer__sub-link mm-drawer__sub-link--all',
                                      isNavActive(pathname, navItem.href) &&
                                        'mm-drawer__sub-link--active',
                                    )}
                                    aria-current={
                                      isNavActive(pathname, navItem.href) ? 'page' : undefined
                                    }
                                  >
                                    All {navItem.label}
                                  </Link>
                                  {subs.map((sub) => {
                                    const subActive = isNavActive(pathname, sub.href)
                                    return (
                                      <Link
                                        key={sub.href}
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
                                    )
                                  })}
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </>
                      ) : (
                        <Link
                          href={navItem.href}
                          onClick={onClose}
                          className={cn('mm-drawer__glass', active && 'mm-drawer__glass--active')}
                          aria-current={active ? 'page' : undefined}
                        >
                          <span className="mm-drawer__glass-label">{navItem.label}</span>
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </nav>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
