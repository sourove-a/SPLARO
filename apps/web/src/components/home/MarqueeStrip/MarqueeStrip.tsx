'use client'

import { useMemo } from 'react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'

/**
 * One slim desktop brand ribbon. Trust copy stays on TrustBar.
 * Hidden on mobile (vertical space) — see `.home-flow-strip` CSS.
 */
const QUIET_FLOW_ITEMS = [
  'Quiet luxury for Bangladesh',
  'New season edit',
  'Crafted for everyday elegance',
] as const

function dedupeItems(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const text = raw.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function buildFlowItems(storeName: string, configured?: string[]): string[] {
  const source =
    configured && configured.length > 0
      ? configured
      : QUIET_FLOW_ITEMS.map((item) =>
          item.toLowerCase().includes('bangladesh') ? `${storeName} — ${item}` : item,
        )

  return dedupeItems(source).slice(0, 3)
}

function MarqueeGroup({ items }: { items: string[] }) {
  return (
    <div className="home-flow-strip__group">
      {items.map((text) => (
        <span key={text} className="home-flow-strip__item">
          <span className="home-flow-strip__dot" aria-hidden />
          <span className="home-flow-strip__text">{text}</span>
        </span>
      ))}
    </div>
  )
}

export function MarqueeStrip() {
  const settings = useStorefrontSettings()
  const storeName = settings.store.name?.trim() || 'SPLARO'
  const configuredMarquee = settings.config.marquee

  const items = useMemo(() => {
    const fromAdmin =
      configuredMarquee?.enabled && configuredMarquee.items.length
        ? configuredMarquee.items
        : undefined
    return buildFlowItems(storeName, fromAdmin)
  }, [configuredMarquee?.enabled, configuredMarquee?.items, storeName])

  if (items.length === 0) return null

  // One spoken summary — animated duplicate track is decorative only.
  const announcement = items.join('. ')

  return (
    <section className="home-flow-strip home-flow-strip--slim" aria-label={announcement}>
      <div className="home-flow-strip__shine" aria-hidden />
      <div className="home-flow-strip__edge home-flow-strip__edge--left" aria-hidden />
      <div className="home-flow-strip__edge home-flow-strip__edge--right" aria-hidden />

      <div className="home-flow-strip__viewport" aria-hidden="true" inert>
        <div className="home-flow-strip__track">
          <MarqueeGroup items={items} />
          {/* Seamless -50% loop clone — decorative, never announced twice. */}
          <MarqueeGroup items={items} />
        </div>
      </div>
    </section>
  )
}
