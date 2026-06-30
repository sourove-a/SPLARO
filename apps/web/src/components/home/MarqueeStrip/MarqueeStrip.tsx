'use client'

import { useMemo } from 'react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'

const DEFAULT_FLOW_ITEMS = [
  'SPLARO — Quiet luxury for Bangladesh',
  'Cash on delivery nationwide',
  'Free delivery on qualifying orders',
  '100% authentic products',
  'Easy returns within policy',
  'Fast delivery to your door',
  'New season edit — shop now',
  'Crafted with premium materials',
] as const

function buildFlowItems(storeName: string, configured?: string[]): string[] {
  const source =
    configured && configured.length > 0
      ? configured
      : DEFAULT_FLOW_ITEMS.map((item) => item.replace(/^SPLARO/, storeName))

  return source.filter((item) => item.trim().length > 0)
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

  const repeated = [...items, ...items]

  return (
    <section className="home-flow-strip" aria-label="Store highlights">
      <div className="home-flow-strip__shine" aria-hidden />
      <div className="home-flow-strip__edge home-flow-strip__edge--left" aria-hidden />
      <div className="home-flow-strip__edge home-flow-strip__edge--right" aria-hidden />

      <div className="home-flow-strip__viewport">
        <div className="home-flow-strip__track">
          {repeated.map((text, index) => (
            <span key={`${text}-${index}`} className="home-flow-strip__item">
              <span className="home-flow-strip__dot" aria-hidden />
              <span className="home-flow-strip__text">{text}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
