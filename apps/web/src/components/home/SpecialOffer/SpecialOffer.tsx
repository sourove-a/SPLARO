'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import type { SpecialOfferConfig } from '@/lib/storefront/settings'

function useCountdown(targetIso?: string | null) {
  const target = targetIso ? new Date(targetIso).getTime() : 0

  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    if (!target) return undefined

    const tick = () => {
      const diff = Math.max(0, target - Date.now())
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      }
    }

    setTime(tick())
    const id = setInterval(() => setTime(tick()), 1000)
    return () => clearInterval(id)
  }, [target])

  return time
}

function SpecialOfferContent({ offer }: { offer: SpecialOfferConfig }) {
  const { days, hours, minutes, seconds } = useCountdown(offer.endsAt)
  const template = offer.template ?? 'countdown'

  if (template === 'minimal') {
    return (
      <section className="border-y border-black/8 bg-[#f7f8fa] py-10" aria-labelledby="special-offer-heading">
        <div className="container-luxury text-center">
          <h2 id="special-offer-heading" className="font-serif text-3xl font-semibold tracking-tight">
            {offer.title}
          </h2>
          {offer.subtitle ? <p className="mt-2 text-black/55">{offer.subtitle}</p> : null}
          {offer.ctaHref ? (
            <Link href={offer.ctaHref} className="mt-5 inline-flex items-center gap-2 font-bold underline underline-offset-4">
              {offer.ctaLabel ?? 'Shop now'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>
    )
  }

  if (template === 'banner') {
    return (
      <section className="bg-luxury-black py-12 text-white" aria-labelledby="special-offer-heading">
        <div className="container-luxury flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <div>
            {offer.badge ? <p className="text-xs font-black uppercase tracking-[0.2em] text-gold">{offer.badge}</p> : null}
            <h2 id="special-offer-heading" className="mt-2 font-serif text-3xl font-semibold">
              {offer.title}
            </h2>
            {offer.subtitle ? <p className="mt-2 text-white/70">{offer.subtitle}</p> : null}
          </div>
          {offer.discountLabel ? <p className="text-4xl font-black text-gold">{offer.discountLabel}</p> : null}
          {offer.ctaHref ? (
            <Link href={offer.ctaHref} className="glass-action-dark inline-flex min-h-[3rem] items-center rounded-2xl px-6 font-bold">
              {offer.ctaLabel ?? 'Shop now'}
            </Link>
          ) : null}
        </div>
      </section>
    )
  }

  const countdownBody = (
    <>
      {offer.badge ? <p className="label-luxury text-gold">{offer.badge}</p> : null}
      <h2 id="special-offer-heading" className="mt-3 max-w-2xl font-serif text-4xl font-semibold tracking-tight md:text-5xl">
        {offer.title}
      </h2>
      {offer.subtitle ? <p className="mt-4 max-w-xl text-white/70">{offer.subtitle}</p> : null}
      {offer.discountLabel ? <p className="mt-6 text-5xl font-black text-gold">{offer.discountLabel}</p> : null}
      {offer.endsAt ? (
        <div className="mt-8 flex gap-3">
          {[
            ['Days', days],
            ['Hours', hours],
            ['Min', minutes],
            ['Sec', seconds],
          ].map(([label, value]) => (
            <div key={label as string} className="min-w-[4.5rem] rounded-2xl border border-white/10 bg-white/5 px-3 py-4">
              <p className="text-2xl font-black">{String(value).padStart(2, '0')}</p>
              <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-white/50">{label as string}</p>
            </div>
          ))}
        </div>
      ) : null}
      {offer.ctaHref ? (
        <Link href={offer.ctaHref} className="glass-action-dark mt-10 inline-flex min-h-[3.2rem] items-center gap-2 rounded-2xl px-8 font-bold">
          {offer.ctaLabel ?? 'Shop now'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </>
  )

  return (
    <section className="relative overflow-hidden bg-luxury-black py-20 text-white" aria-labelledby="special-offer-heading">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #101114 0, #101114 1px, transparent 0, transparent 50%)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />
      <div className="container-luxury relative">
        <div className="flex flex-col items-center text-center">{countdownBody}</div>
      </div>
    </section>
  )
}

export function SpecialOffer() {
  const settings = useStorefrontSettings()
  const offer = settings.config.specialOffer

  if (!offer?.enabled || !offer.title?.trim()) return null

  return <SpecialOfferContent offer={offer} />
}
