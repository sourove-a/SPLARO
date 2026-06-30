'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useRef } from 'react'

const looks = [
  {
    id: '1',
    title: 'The Golden Hour Edit',
    category: 'Summer Edition',
    href: '/c/summer-edition',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&h=700&q=88&fit=crop',
    tag: 'New Season',
  },
  {
    id: '2',
    title: 'Heritage Weave Sarees',
    category: 'Sarees',
    href: '/c/sarees',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&h=700&q=88&fit=crop',
    tag: 'Signature',
  },
  {
    id: '3',
    title: 'Quiet Elegance',
    category: 'Luxury Pret',
    href: '/c/luxury-pret',
    image: 'https://images.unsplash.com/photo-1524504388-852ba15a6f8a?w=500&h=700&q=88&fit=crop',
    tag: 'Bestseller',
  },
  {
    id: '4',
    title: 'The Complete Woman',
    category: 'Three Piece',
    href: '/c/three-piece',
    image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=500&h=700&q=88&fit=crop',
    tag: 'Editorial',
  },
  {
    id: '5',
    title: 'Festive Moments',
    category: 'Festive',
    href: '/collections',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500&h=700&q=88&fit=crop',
    tag: 'Limited',
  },
  {
    id: '6',
    title: 'Modern Accessories',
    category: 'Accessories',
    href: '/accessories',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&h=700&q=88&fit=crop',
    tag: 'New In',
  },
]

export function Lookbook() {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <section className="overflow-hidden py-16 lg:py-20" aria-labelledby="lookbook-heading">
      {/* Header */}
      <div className="container-luxury mb-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-luxury mb-3 text-gold">The Edit</p>
            <h2 id="lookbook-heading" className="heading-lg text-luxury-black">
              Lookbook
            </h2>
          </div>
          <Link
            href="/editorial"
            className="hidden items-center gap-2 text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-luxury-gray transition-colors hover:text-luxury-black sm:flex"
          >
            Full Lookbook
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Horizontal scroll strip */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-[var(--container-px,2rem)] pb-4 lg:gap-5 lg:px-[var(--container-px,4rem)]"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {looks.map((look, i) => (
          <motion.div
            key={look.id}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0"
            style={{ width: 'clamp(220px, 22vw, 280px)' }}
          >
            <Link href={look.href} className="group block">
              {/* Image */}
              <div className="relative mb-4 overflow-hidden bg-[#F0EDE8]" style={{ aspectRatio: '5/7', borderRadius: '18px' }}>
                <Image
                  src={look.image}
                  alt={look.title}
                  fill
                  sizes="280px"
                  className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />

                {/* Tag */}
                <div className="absolute left-3 top-3">
                  <span
                    className="text-[0.45rem] font-bold uppercase tracking-[0.2em] text-white"
                    style={{
                      background: 'rgba(17,17,17,0.75)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      borderRadius: '9999px',
                      padding: '4px 10px',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {look.tag}
                  </span>
                </div>

                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" style={{ borderRadius: '0 0 18px 18px' }} />

                {/* Shop CTA on hover */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 transition-all duration-400 group-hover:opacity-100">
                  <span
                    className="inline-flex items-center gap-1.5 text-[0.5rem] font-bold uppercase tracking-[0.18em] text-white"
                    style={{
                      background: 'rgba(255,255,255,0.18)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.30)',
                      borderRadius: '9999px',
                      padding: '5px 14px',
                    }}
                  >
                    Shop Look <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </div>

              {/* Info */}
              <p className="text-[0.45rem] font-bold uppercase tracking-[0.2em] text-[#C8A97E]">
                {look.category}
              </p>
              <h3 className="mt-1 text-[0.8125rem] font-semibold text-[#111] transition-colors duration-200 group-hover:text-[#C8A97E]">
                {look.title}
              </h3>
            </Link>
          </motion.div>
        ))}

        {/* Final CTA card */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: looks.length * 0.06 }}
          className="flex shrink-0 items-center justify-center border border-luxury-border bg-ivory-100"
          style={{ width: 'clamp(160px, 18vw, 220px)', aspectRatio: '5/7' }}
        >
          <Link href="/editorial" className="group flex flex-col items-center gap-4 p-6 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center transition-all duration-300 group-hover:bg-gold"
              style={{ border: '1px solid rgba(200,169,126,0.4)' }}
            >
              <ArrowRight className="h-4 w-4 text-gold transition-colors duration-200 group-hover:text-white" />
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-luxury-black">
                Full Lookbook
              </p>
              <p className="mt-1 text-[0.5rem] text-luxury-gray">
                Explore all looks
              </p>
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
