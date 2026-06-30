'use client'

import { Gem } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'

interface MarqueeStripProps {
  dark?: boolean
}

export function MarqueeStrip({ dark = false }: MarqueeStripProps) {
  const settings = useStorefrontSettings()
  const marquee = settings.config.marquee

  if (!marquee?.enabled || !marquee.items.length) return null

  const repeated = [...marquee.items, ...marquee.items]

  return (
    <div
      className={`relative overflow-hidden border-y ${
        dark ? 'border-white/8 bg-luxury-black' : 'border-luxury-border bg-luxury-black'
      } py-3`}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-luxury-black to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-luxury-black to-transparent" />

      <div className="animate-marquee flex w-max items-center gap-0">
        {repeated.map((text, i) => (
          <div key={`${text}-${i}`} className="flex shrink-0 items-center gap-3 px-6">
            <Gem className="h-3 w-3 text-gold/80" strokeWidth={2} />
            <span className="whitespace-nowrap text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/88">
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
