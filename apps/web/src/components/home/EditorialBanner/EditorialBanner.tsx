'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

export function EditorialBanner() {
  return (
    <ScrollReveal variant="fadeUp">
    <section
      className="relative flex min-h-[70vh] items-end overflow-hidden lg:min-h-[80vh]"
      aria-label="Editorial campaign"
    >
      {/* Full-width background image */}
      <Image
        src="https://images.unsplash.com/photo-1445205170230-053b83016050?w=1920&h=1280&q=92&fit=crop"
        alt="SPLARO — Luxury Editorial Campaign"
        fill
        sizes="100vw"
        className="object-cover object-center"
        quality={92}
      />

      {/* Layered gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-luxury-black/90 via-luxury-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-luxury-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full pb-16 lg:pb-24">
        <div className="container-luxury">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Label */}
              <p className="label-luxury mb-6 text-gold">Luxury Campaign 2026</p>

              {/* Large editorial headline */}
              <h2
                className="mb-6 font-serif font-semibold leading-[0.95] text-white"
                style={{ fontSize: 'clamp(3rem, 7vw, 7rem)' }}
              >
                Dress For<br />
                Your<br />
                Moment
              </h2>

              {/* Small editorial copy */}
              <p className="mb-10 max-w-sm text-[0.9375rem] leading-relaxed text-white/70">
                Exquisite embroideries and silhouettes that hold the poetry of celebration. 
                Every thread, a memory.
              </p>

              {/* iOS 26 glass pill CTA */}
              <Link
                href="/collections"
                className="group inline-flex items-center gap-4 px-9 py-4 text-[0.625rem] font-bold uppercase tracking-[0.25em] text-white transition-all duration-400"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.32)',
                  borderRadius: '9999px',
                  boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.35), 0 4px 20px rgba(0,0,0,0.15)',
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  const t = e.currentTarget as HTMLElement
                  t.style.background = 'rgba(255,255,255,0.95)'
                  t.style.color = '#111'
                  t.style.borderColor = 'rgba(255,255,255,1)'
                  t.style.boxShadow = '0 12px 40px rgba(255,255,255,0.22), inset 0 1.5px 0 rgba(255,255,255,1)'
                }}
                onMouseLeave={(e) => {
                  const t = e.currentTarget as HTMLElement
                  t.style.background = 'rgba(255,255,255,0.14)'
                  t.style.color = 'white'
                  t.style.borderColor = 'rgba(255,255,255,0.32)'
                  t.style.boxShadow = 'inset 0 1.5px 0 rgba(255,255,255,0.35), 0 4px 20px rgba(0,0,0,0.15)'
                }}
              >
                Explore the Collection
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Gold accent bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
    </section>
    </ScrollReveal>
  )
}
