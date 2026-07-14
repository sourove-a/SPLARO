'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutGroup, motion, useReducedMotion } from '@/lib/motion/react'
import {
  ChevronLeft,
  ChevronRight,
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
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import type { MegaMenuConfig, MegaMenuHero } from '@/lib/storefront/settings'

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

function MegaMenuHeroCard({
  hero,
  onClose,
  priority = false,
}: {
  hero: MegaMenuHero
  onClose?: () => void
  priority?: boolean
}) {
  return (
    <Link
      href={hero.href}
      scroll={false}
      className="mega-menu-hero-card"
      onClick={() => onClose?.()}
    >
      {hero.image ? (
        <Image
          src={hero.image}
          alt={hero.label}
          fill
          sizes="(min-width: 1280px) 320px, 28vw"
          quality={88}
          priority={priority}
          className="object-cover object-top"
        />
      ) : (
        <div className="mega-menu-hero-fallback mega-menu-hero-fallback--text">
          <span>{hero.label}</span>
        </div>
      )}
      <div className="mega-menu-hero-shutter" aria-hidden />
      <div className="mega-menu-hero-overlay" />
      <span className="mega-menu-hero-label">{hero.label}</span>
    </Link>
  )
}

function MegaMenuHeroSlider({
  heroes,
  onClose,
  reducedMotion,
}: {
  heroes: MegaMenuHero[]
  onClose?: () => void
  reducedMotion: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const syncArrows = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const maxScroll = track.scrollWidth - track.clientWidth
    setCanPrev(track.scrollLeft > 4)
    setCanNext(track.scrollLeft < maxScroll - 4)
  }, [])

  useHorizontalWheelScroll(trackRef)

  useEffect(() => {
    syncArrows()
    const track = trackRef.current
    if (!track) return
    track.addEventListener('scroll', syncArrows, { passive: true })
    window.addEventListener('resize', syncArrows)
    return () => {
      track.removeEventListener('scroll', syncArrows)
      window.removeEventListener('resize', syncArrows)
    }
  }, [heroes, syncArrows])

  const scrollBy = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const amount = Math.max(track.clientWidth * 0.72, 240)
    track.scrollBy({
      left: direction * amount,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  if (heroes.length < 3) {
    return (
      <div
        className={cn(
          'mega-menu-heroes',
          heroes.length === 1 && 'mega-menu-heroes--1',
          heroes.length === 2 && 'mega-menu-heroes--2',
        )}
      >
        {heroes.map((hero) => (
          <MegaMenuHeroCard
            key={hero.href}
            hero={hero}
            {...(onClose ? { onClose } : {})}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mega-menu-heroes-slider">
      <button
        type="button"
        className="mega-menu-heroes-slider__btn"
        aria-label="Previous featured tiles"
        disabled={!canPrev}
        onClick={() => scrollBy(-1)}
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>
      <div ref={trackRef} className="mega-menu-heroes-slider__track" data-h-scroll="true" data-lenis-prevent>
        {heroes.map((hero, index) => (
          <div key={hero.href} className="mega-menu-heroes-slider__slide">
            <MegaMenuHeroCard
              hero={hero}
              priority={index < 3}
              {...(onClose ? { onClose } : {})}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mega-menu-heroes-slider__btn"
        aria-label="Next featured tiles"
        disabled={!canNext}
        onClick={() => scrollBy(1)}
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

export function MegaMenu({ config, isOpen, menuKey, onClose }: MegaMenuProps) {
  const reducedMotion = useReducedMotion()
  const [hovered, setHovered] = useState<string | null>(config.categories[0]?.href ?? null)

  const active = config.categories.find((c) => c.href === hovered) ?? config.categories[0]
  const hasHeroes = config.heroes.length > 0

  useEffect(() => {
    setHovered(config.categories[0]?.href ?? null)
  }, [menuKey, config])

  return (
    <>
      <div
        className={cn('mega-menu-backdrop', isOpen && 'mega-menu-backdrop--open')}
        aria-hidden
      />

      <div
        className="mega-menu-panel"
        role="region"
        aria-label="Category menu"
        tabIndex={-1}
      >
        <div className="mega-menu-panel__shine" aria-hidden />

        <div
          key={menuKey ?? 'mega-default'}
          className={cn(
            'mega-menu-inner',
            'mega-menu-inner--swap',
            !hasHeroes && 'mega-menu-inner--no-heroes',
          )}
        >
          <aside className="mega-menu-col mega-menu-col--cats">
                <LayoutGroup id="mega-menu-cats">
                  <ul className="mega-menu-cat-list">
                    {config.categories.map((cat) => {
                      const isActive =
                        cat.href === hovered ||
                        (!hovered && config.categories[0]?.href === cat.href)
                      const IconComponent = cat.icon ? ICON_MAP[cat.icon] : null

                      return (
                        <li
                          key={cat.href}
                          className="mega-menu-cat-row"
                          onMouseEnter={() => setHovered(cat.href)}
                        >
                          {isActive ? (
                            <motion.span
                              layoutId="mega-menu-cat-pill"
                              className="mega-menu-cat-pill"
                              transition={{
                                duration: 0.28,
                                ease: [0.16, 1, 0.3, 1],
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
                        </li>
                      )
                    })}
                  </ul>
                </LayoutGroup>
              </aside>

              <div className="mega-menu-col mega-menu-col--subs">
                {active ? (
                  <div key={active.href} className="mega-menu-sub-swap">
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
                          <Link
                            href={active.href}
                            scroll={false}
                            className="mega-menu-sub-item"
                            onClick={() => onClose?.()}
                          >
                            All
                          </Link>
                        </li>
                        {active.subcategories?.map((sub) => (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              scroll={false}
                              className="mega-menu-sub-item"
                              onClick={() => onClose?.()}
                            >
                              {sub.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                  </div>
                ) : null}
              </div>

              {hasHeroes ? (
                <div className="mega-menu-col mega-menu-col--heroes">
                  <MegaMenuHeroSlider
                    heroes={config.heroes}
                    reducedMotion={Boolean(reducedMotion)}
                    {...(onClose ? { onClose } : {})}
                  />
                </div>
              ) : null}
        </div>
      </div>
    </>
  )
}
