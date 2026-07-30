'use client'

import Link from 'next/link'

import { FONT } from './tokens'

/**
 * Tab strip across the Content group — the prototype's `subnav()`.
 *
 * Order and labels come from the design's `CN` list. Routes that exist but are
 * deliberately kept out of the primary nav carry the `beta` marker the design
 * gives them, so nobody mistakes them for finished work.
 */
const CONTENT_TABS: Array<{ id: string; label: string; href: string; beta?: boolean }> = [
  { id: 'homepage', label: 'Home Page', href: '/dashboard/home-page' },
  { id: 'hero', label: 'Hero Slider', href: '/dashboard/hero-slider' },
  { id: 'menu', label: 'Menu Control', href: '/dashboard/menu-control' },
  { id: 'legal', label: 'Legal Pages', href: '/dashboard/legal-pages' },
  { id: 'media', label: 'Media Library', href: '/dashboard/media-library' },
  { id: 'footwear', label: 'Footwear', href: '/dashboard/footwear-page', beta: true },
  { id: 'theme', label: 'Theme', href: '/dashboard/theme-builder', beta: true },
  { id: 'lookbooks', label: 'Lookbooks', href: '/dashboard/lookbooks', beta: true },
  { id: 'reels', label: 'Reels', href: '/dashboard/reels', beta: true },
  { id: 'blog', label: 'Blog', href: '/dashboard/blog', beta: true },
  { id: 'cms', label: 'CMS', href: '/dashboard/cms', beta: true },
  { id: 'landing', label: 'Landing', href: '/dashboard/landing-pages', beta: true },
]

export function DcContentNav({ active }: { active: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        padding: 5,
        border: '1px solid var(--line)',
        borderRadius: 14,
        background: 'var(--surface)',
        backgroundImage: 'var(--card-sheen)',
      }}
    >
      {CONTENT_TABS.map((t) => {
        const on = t.id === active
        return (
          <Link
            key={t.id}
            href={t.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 31,
              padding: '0 12px',
              borderRadius: 8,
              font: `600 12px/1 ${FONT}`,
              border: `1px solid ${on ? 'var(--violet-solid)' : 'transparent'}`,
              background: on ? 'var(--violet-solid)' : 'transparent',
              color: on ? 'var(--on-violet)' : 'var(--ink-2)',
            }}
          >
            <span>{t.label}</span>
            {t.beta ? (
              <span
                style={{
                  font: `700 9px/1 ${FONT}`,
                  letterSpacing: '.07em',
                  color: on ? 'var(--on-violet)' : 'var(--warn)',
                  opacity: on ? 0.75 : 1,
                }}
              >
                BETA
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
