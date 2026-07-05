'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const HEADER_OFFSET = 'var(--site-header-offset, var(--header-height))'

export function HeroSection() {
  return (
    <section
      className="w-full overflow-hidden bg-luxury-dark"
      style={{ height: `calc(100dvh - ${HEADER_OFFSET})`, marginTop: HEADER_OFFSET, minHeight: '560px' }}
      aria-label="Featured campaign"
    >
      {/* Desktop: 60/40 grid | Mobile: stacked */}
      <div className="flex h-full flex-col lg:flex-row">

        {/* ── LEFT LARGE CARD (60%) — Summer Edition 2026 ── */}
        <motion.div
          className="group relative flex-[3] overflow-hidden lg:flex-[6]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Link href="/c/summer-edition" className="block h-full" tabIndex={0}>
            {/* Campaign image */}
            <Image
              src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&h=2000&q=90&fit=crop&crop=entropy"
              alt="Summer Edition 2026 — SPLARO"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover object-top transition-transform duration-[1400ms] ease-out will-change-transform group-hover:scale-[1.03]"
            />

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-luxury-black/85 via-luxury-black/15 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-luxury-black/20 to-transparent" />

            {/* Editorial content — bottom */}
            <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="label-luxury mb-4 text-gold">New Season — 2026</p>
                <h1
                  className="heading-editorial mb-6 text-white"
                >
                  Summer<br />Edition<br />2026
                </h1>
                <p className="mb-8 max-w-xs text-[0.875rem] leading-relaxed text-white/70 lg:text-base">
                  The season of light fabric, golden hour, and effortless grace.
                </p>
                <span className="hero-editorial-cta group/cta">
                  Explore Collection
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover/cta:translate-x-1" />
                </span>
              </motion.div>
            </div>
          </Link>
        </motion.div>

        {/* ── RIGHT COLUMN (40%) ── */}
        <div className="flex flex-row lg:flex-[4] lg:flex-col">

          {/* TOP CARD — Inside Story (editorial storytelling) */}
          <motion.div
            className="group relative flex-1 overflow-hidden lg:flex-[6]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Link href="/editorial" className="block h-full" tabIndex={0}>
              <Image
                src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&h=1100&q=90&fit=crop"
                alt="Inside Story — SPLARO Editorial"
                fill
                priority
                sizes="(max-width: 1024px) 50vw, 40vw"
                className="object-cover object-center transition-transform duration-[1400ms] ease-out will-change-transform group-hover:scale-[1.04]"
              />

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-black/80 via-luxury-black/25 to-transparent" />

              {/* Thin gold top bar */}
              <div className="absolute left-0 right-0 top-0 h-px bg-gold/40" />

              {/* Content */}
              <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="label-luxury mb-2.5 text-gold">Editorial</p>
                  <h2
                    className="mb-3 font-serif font-semibold leading-tight text-white"
                    style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}
                  >
                    Inside Story
                  </h2>
                  <p className="mb-4 text-[0.75rem] leading-relaxed text-white/65">
                    The art of dressing — behind every stitch.
                  </p>
                  <span className="inline-flex items-center gap-2 text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-white/70 transition-all duration-300 hover:text-gold">
                    Read Story
                    <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </motion.div>
              </div>
            </Link>
          </motion.div>

          {/* BOTTOM CARD — Featured Collection */}
          <motion.div
            className="group relative flex-1 overflow-hidden bg-ivory-200 lg:flex-[4]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Link href="/c/luxury-pret" className="block h-full" tabIndex={0}>
              {/* Background image with subtle reveal */}
              <Image
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&h=600&q=85&fit=crop"
                alt="Artful Living — SPLARO Luxury Pret"
                fill
                sizes="(max-width: 1024px) 50vw, 40vw"
                className="object-cover object-top opacity-40 transition-all duration-[1200ms] ease-out group-hover:scale-[1.04] group-hover:opacity-55"
              />

              {/* Light overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-ivory-100/95 via-ivory-100/70 to-ivory-100/30" />

              {/* Gold accent line */}
              <div className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent lg:left-8" />

              {/* Content */}
              <div className="relative flex h-full flex-col justify-end p-6 lg:p-8">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="label-luxury mb-2 text-gold">Featured Collection</p>
                  <h2
                    className="mb-1.5 font-serif font-semibold leading-tight text-[#111]"
                    style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)' }}
                  >
                    Artful Living
                  </h2>
                  <p className="mb-1 text-[0.75rem] text-luxury-gray">Timeless Elegance</p>
                  <p className="mb-5 text-[0.6875rem] text-luxury-gray/70">Luxury Craftsmanship</p>
                  <span className="inline-flex items-center gap-2 text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-luxury-black transition-all duration-300 group-hover:text-gold">
                    Discover
                    <ArrowRight className="h-2.5 w-2.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </span>
                </motion.div>
              </div>
            </Link>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
