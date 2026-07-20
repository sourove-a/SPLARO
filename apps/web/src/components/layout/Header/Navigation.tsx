'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, LayoutGroup, motion } from '@/lib/motion/react'
import { ChevronDown } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { cn } from '@/lib/utils/cn'
import { MegaMenu } from './MegaMenu'
import type { MegaMenuConfig } from '@/lib/storefront/settings'
import { isNavActive } from '@/lib/navigation/is-nav-active'

const CLOSE_DELAY_MS = 150

interface NavigationProps {
  onMegaMenuChange?: (open: boolean) => void
}

export function Navigation({ onMegaMenuChange }: NavigationProps) {
  const pathname = usePathname()
  const settings = useStorefrontSettings()
  const navItems = (settings.config.headerNav ?? []).filter((item) => !item.hidden)
  const navSignature = navItems.map((item) => `${item.label}:${item.href}`).join('|')

  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navLayerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onMegaMenuChange?.(openIndex !== null)
  }, [openIndex, onMegaMenuChange])

  // Hidden/reordered items — close mega so index never points at the wrong link
  useEffect(() => {
    setOpenIndex(null)
  }, [navSignature])

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  const openMenu = useCallback((index: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenIndex(index)
  }, [])

  const closeMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenIndex(null)
  }, [])

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenIndex(null), CLOSE_DELAY_MS)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  useEffect(() => {
    if (openIndex === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openIndex, closeMenu])

  useEffect(() => {
    const layer = navLayerRef.current
    if (!layer || openIndex === null) return

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null
      if (next && layer.contains(next)) return
      scheduleClose()
    }

    layer.addEventListener('focusout', onFocusOut)
    return () => layer.removeEventListener('focusout', onFocusOut)
  }, [openIndex, scheduleClose])

  const activeMegaMenu: MegaMenuConfig | null =
    openIndex !== null ? (navItems[openIndex]?.megaMenu ?? null) : null

  // Keep a mega shell mounted so first open is CSS-only (no late-mount jump).
  // Do NOT depend on `navItems` (new array every render) — that caused infinite setState.
  const [lastMega, setLastMega] = useState<{ key: string; config: MegaMenuConfig } | null>(() => {
    const item = (settings.config.headerNav ?? []).find((nav) => !nav.hidden && nav.megaMenu)
    return item?.megaMenu ? { key: item.label, config: item.megaMenu } : null
  })

  useEffect(() => {
    if (openIndex === null || !activeMegaMenu) return
    const key =
      (settings.config.headerNav ?? []).filter((item) => !item.hidden)[openIndex]?.label ??
      `nav-${openIndex}`
    setLastMega((prev) => {
      if (prev?.key === key && prev.config === activeMegaMenu) return prev
      return { key, config: activeMegaMenu }
    })
  }, [openIndex, activeMegaMenu, settings.config.headerNav])

  if (!navItems.length) return null

  const navMotion = {
    duration: 0.28,
    ease: [0.4, 0, 0.2, 1] as const,
  }

  return (
    <div ref={navLayerRef} className="site-header-glass__nav-layer">
      <div className="site-header-glass__nav-center">
        <nav aria-label="Main navigation">
          <LayoutGroup id="site-header-nav">
            <ul className="site-header-glass__nav-list">
              <AnimatePresence initial={false} mode="popLayout">
                {navItems.map((item, i) => {
                  const hasMega = Boolean(item.megaMenu)
                  const isOpen = openIndex === i
                  const isActive = isNavActive(pathname, item.href)

                  return (
                    <motion.li
                      key={`${item.label}-${item.href}`}
                      layout
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
                      transition={navMotion}
                      onMouseEnter={() => (hasMega ? openMenu(i) : setOpenIndex(null))}
                      onMouseLeave={() => {
                        if (hasMega) scheduleClose()
                      }}
                    >
                      <Link
                        href={item.href}
                        scroll={false}
                        onClick={closeMenu}
                        onFocus={() => {
                          if (hasMega) openMenu(i)
                        }}
                        aria-haspopup={hasMega ? 'true' : undefined}
                        aria-expanded={hasMega ? isOpen : undefined}
                        className={cn(
                          'site-header-glass__nav-link',
                          isActive && 'site-header-glass__nav-link--active',
                          isOpen && 'site-header-glass__nav-link--open',
                        )}
                      >
                        {isOpen ? (
                          <motion.span
                            layoutId="nav-mega-pill"
                            className="site-header-glass__nav-pill"
                            transition={navMotion}
                            aria-hidden
                          />
                        ) : null}
                        <span className="site-header-glass__nav-link-text">{item.label}</span>
                        {item.badge ? (
                          <span className="site-header-glass__nav-badge">{item.badge}</span>
                        ) : null}
                        {hasMega ? (
                          <ChevronDown
                            className="site-header-glass__nav-chevron"
                            strokeWidth={2}
                            aria-hidden
                          />
                        ) : null}
                      </Link>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        </nav>
      </div>

      {/* Always mounted — open/close is a pure CSS class flip (premium curtain).
          lastMega keeps the final content visible through the fade-out. */}
      {lastMega ? (
        <div
          className={cn(
            'site-header-glass__mega',
            activeMegaMenu && openIndex !== null && 'site-header-glass__mega--open',
          )}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <MegaMenu
            menuKey={lastMega.key}
            config={lastMega.config}
            isOpen={activeMegaMenu !== null && openIndex !== null}
            onClose={closeMenu}
          />
        </div>
      ) : null}
    </div>
  )
}
