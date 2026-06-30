'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { cn } from '@/lib/utils/cn'
import { MegaMenu } from './MegaMenu'
import type { MegaMenuConfig } from '@/lib/storefront/settings'

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

  useEffect(() => {
    onMegaMenuChange?.(openIndex !== null)
  }, [openIndex, onMegaMenuChange])

  const openMenu = useCallback((index: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenIndex(index)
  }, [])

  const closeMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenIndex(null)
  }, [])

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpenIndex(null), 300)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  if (!navItems.length) return null

  const activeMegaMenu: MegaMenuConfig | null =
    openIndex !== null ? (navItems[openIndex]?.megaMenu ?? null) : null

  return (
    <div className="site-header-glass__nav-layer" onMouseLeave={scheduleClose}>
      <div className="site-header-glass__nav-center">
        <nav aria-label="Main navigation">
          <ul className="site-header-glass__nav-list">
            {navItems.map((item, i) => {
              const hasMega = Boolean(item.megaMenu)
              const isOpen = openIndex === i
              const isActive = isNavActive(pathname, item.href)

              return (
                <motion.li
                  key={`${item.label}-${item.href}`}
                  initial={false}
                  animate={{ y: isOpen ? -1 : 0, opacity: 1 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => (hasMega ? openMenu(i) : setOpenIndex(null))}
                >
                  <Link
                    href={item.href}
                    scroll={false}
                    onClick={closeMenu}
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
                </motion.li>
              )
            })}
          </ul>
        </nav>
      </div>

      <AnimatePresence mode="wait">
        {activeMegaMenu && openIndex !== null ? (
          <motion.div
            key={openIndex}
            className="site-header-glass__mega"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <MegaMenu
              menuKey={navItems[openIndex]?.label}
              config={activeMegaMenu}
              isOpen
              onClose={closeMenu}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
