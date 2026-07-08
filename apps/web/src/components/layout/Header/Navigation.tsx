'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { cn } from '@/lib/utils/cn'
import { MegaMenu } from './MegaMenu'
import type { MegaMenuConfig } from '@/lib/storefront/settings'

const CLOSE_DELAY_MS = 150

function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface NavigationProps {
  onMegaMenuChange?: (open: boolean) => void
}

export function Navigation({ onMegaMenuChange }: NavigationProps) {
  const pathname = usePathname()
  const settings = useStorefrontSettings()
  const navItems = (settings.config.headerNav ?? []).filter((item) => !item.hidden)

  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navLayerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onMegaMenuChange?.(openIndex !== null)
  }, [openIndex, onMegaMenuChange])

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

  // Retain the last opened menu so its content stays rendered during the close fade.
  const [lastMega, setLastMega] = useState<{ key: string; config: MegaMenuConfig } | null>(null)
  useEffect(() => {
    if (activeMegaMenu && openIndex !== null) {
      setLastMega({
        key: navItems[openIndex]?.label ?? `nav-${openIndex}`,
        config: activeMegaMenu,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, activeMegaMenu])

  if (!navItems.length) return null

  return (
    <div ref={navLayerRef} className="site-header-glass__nav-layer">
      <div className="site-header-glass__nav-center">
        <nav aria-label="Main navigation">
          <ul className="site-header-glass__nav-list">
            {navItems.map((item, i) => {
              const hasMega = Boolean(item.megaMenu)
              const isOpen = openIndex === i
              const isActive = isNavActive(pathname, item.href)

              return (
                <li
                  key={`${item.label}-${item.href}`}
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
                        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.82 }}
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
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {/* Always mounted — open/close is a pure CSS class flip (ILYN-style curtain).
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
