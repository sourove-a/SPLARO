'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import {
  Glasses,
  ShoppingBag,
  Backpack,
  Watch,
  Wallet,
  CreditCard,
  Gem,
  CircleDot,
  BookOpen,
  Lamp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { MegaMenuConfig } from '@/lib/storefront/settings'

const EXPO_OUT = [0.22, 1, 0.36, 1] as const
const SHUTTER_EASE = [0.16, 1, 0.3, 1] as const

const panelTransition = {
  duration: 0.62,
  ease: SHUTTER_EASE,
}

const sweepTransition = {
  duration: 0.58,
  ease: SHUTTER_EASE,
}

const columnVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.48,
      ease: EXPO_OUT,
      delay,
    },
  }),
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.36, ease: EXPO_OUT },
  },
}

const ICON_MAP: Record<string, LucideIcon> = {
  Glasses,
  ShoppingBag,
  Backpack,
  Watch,
  Wallet,
  CreditCard,
  Gem,
  CircleDot,
  BookOpen,
  Lamp,
}

interface MegaMenuProps {
  config: MegaMenuConfig
  isOpen: boolean
  menuKey?: string
  onClose?: () => void
}

export function MegaMenu({ config, isOpen, menuKey, onClose }: MegaMenuProps) {
  const [hovered, setHovered] = useState<string | null>(
    config.categories[0]?.href ?? null,
  )

  const active = config.categories.find((c) => c.href === hovered) ?? config.categories[0]
  const hasHeroes = config.heroes.length > 0

  useEffect(() => {
    setHovered(config.categories[0]?.href ?? null)
  }, [menuKey, config])

  return (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <>
          <motion.div
            key="mega-backdrop"
            className="mega-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.34, ease: SHUTTER_EASE, delay: 0.04 }}
            aria-hidden
          />

          <motion.div
            key="mega-panel"
            initial={{ clipPath: 'inset(0 0 100% 0 round 0 0 0 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0 round 0 0 0 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0 round 0 0 0 0)' }}
            transition={panelTransition}
            className="mega-menu-panel"
            role="region"
            aria-label="Category menu"
          >
            <motion.div
              className="mega-menu-panel__sweep"
              initial={{ y: '-110%' }}
              animate={{ y: '110%' }}
              transition={sweepTransition}
              aria-hidden
            />
            <div className="mega-menu-panel__shine" aria-hidden />

            <motion.div
              key={menuKey ?? 'mega-default'}
              className={cn(
                'mega-menu-inner',
                !hasHeroes && 'mega-menu-inner--no-heroes',
              )}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: SHUTTER_EASE, delay: 0.14 }}
            >
              <motion.aside
                className="mega-menu-col mega-menu-col--cats"
                custom={0.04}
                variants={columnVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <LayoutGroup id="mega-menu-cats">
                <ul className="mega-menu-cat-list">
                  {config.categories.map((cat, index) => {
                    const isActive =
                      cat.href === hovered ||
                      (!hovered && config.categories[0]?.href === cat.href)
                    const IconComponent = cat.icon ? ICON_MAP[cat.icon] : null

                    return (
                      <motion.li
                        key={cat.href}
                        className="mega-menu-cat-row"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.32,
                          ease: EXPO_OUT,
                          delay: 0.04 + index * 0.03,
                        }}
                        onMouseEnter={() => setHovered(cat.href)}
                      >
                        {isActive ? (
                          <motion.span
                            layoutId="mega-menu-cat-pill"
                            className="mega-menu-cat-pill"
                            transition={{
                              type: 'spring',
                              stiffness: 320,
                              damping: 38,
                              mass: 0.82,
                            }}
                            aria-hidden
                          />
                        ) : null}
                        <Link
                          href={cat.href}
                          scroll={false}
                          className={cn(
                            'mega-menu-cat-item',
                            isActive && 'mega-menu-cat-item--active',
                            IconComponent && 'mega-menu-cat-item--has-icon',
                          )}
                          onClick={() => onClose?.()}
                        >
                          {IconComponent ? (
                            <span className="mega-menu-cat-icon" aria-hidden>
                              <IconComponent size={15} strokeWidth={1.75} />
                            </span>
                          ) : null}
                          <span className="mega-menu-cat-label">{cat.label}</span>
                        </Link>
                      </motion.li>
                    )
                  })}
                </ul>
                </LayoutGroup>
              </motion.aside>

              <motion.div
                className="mega-menu-col mega-menu-col--subs"
                custom={0.1}
                variants={columnVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <AnimatePresence mode="wait">
                  {active ? (
                    <motion.div
                      key={active.href}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ duration: 0.32, ease: EXPO_OUT }}
                    >
                      <Link
                        href={active.href}
                        scroll={false}
                        className="mega-menu-section-title"
                        onClick={() => onClose?.()}
                      >
                        {active.label}
                      </Link>
                      <ul className="mega-menu-sub-list">
                        <li>
                          <Link href={active.href} scroll={false} className="mega-menu-sub-item" onClick={() => onClose?.()}>
                            All
                          </Link>
                        </li>
                        {active.subcategories?.map((sub) => (
                          <li key={sub.href}>
                            <Link href={sub.href} scroll={false} className="mega-menu-sub-item" onClick={() => onClose?.()}>
                              {sub.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>

              {hasHeroes ? (
                <motion.div
                  className="mega-menu-col mega-menu-col--heroes"
                  custom={0.14}
                  variants={columnVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <div
                    className={cn(
                      'mega-menu-heroes',
                      config.heroes.length === 1 && 'mega-menu-heroes--1',
                      config.heroes.length === 2 && 'mega-menu-heroes--2',
                      config.heroes.length >= 3 && 'mega-menu-heroes--3',
                    )}
                  >
                    {config.heroes.map((hero, index) => (
                      <motion.div
                        key={hero.href}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.38,
                          ease: EXPO_OUT,
                          delay: 0.12 + index * 0.05,
                        }}
                      >
                        <Link
                          href={hero.href}
                          scroll={false}
                          className="mega-menu-hero-card group"
                          onClick={() => onClose?.()}
                        >
                          {hero.image ? (
                            <Image
                              src={hero.image}
                              alt={hero.label}
                              fill
                              sizes="(min-width: 1280px) 320px, 25vw"
                              className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="mega-menu-hero-fallback" aria-hidden />
                          )}
                          <div className="mega-menu-hero-shutter" aria-hidden />
                          <div className="mega-menu-hero-overlay" />
                          <span className="mega-menu-hero-label">{hero.label}</span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
