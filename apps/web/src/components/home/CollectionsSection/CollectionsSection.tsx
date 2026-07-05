'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { collectionHref } from '@/lib/storefront/collection-paths'

const categories = [
  {
    name: 'Sarees',
    slug: 'sarees',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=700&h=950&q=90&fit=crop',
    subtitle: 'Heritage Weaves',
  },
  {
    name: 'Three Piece',
    slug: 'three-piece',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=700&h=950&q=90&fit=crop',
    subtitle: 'Coordinated Sets',
  },
  {
    name: 'Luxury Pret',
    slug: 'luxury-pret',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=700&h=950&q=90&fit=crop',
    subtitle: 'Ready to Wear',
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=700&h=950&q=90&fit=crop',
    subtitle: 'Complete the Look',
  },
  {
    name: 'New In',
    slug: 'new-arrivals',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=700&h=950&q=90&fit=crop',
    subtitle: 'Just Arrived',
  },
]

const container = staggerContainer
const card = fadeUp

export function CollectionsSection() {
  return (
    <ScrollReveal variant="fadeUp">
    <section className="section-padding" aria-labelledby="collections-heading">
      <div className="container-luxury">
        {/* Header */}
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="label-luxury mb-3 text-gold">Curated For You</p>
            <h2 id="collections-heading" className="heading-lg text-luxury-black">
              Shop by Category
            </h2>
          </div>
          <Link
            href="/collections"
            className="hidden items-center gap-2 rounded-full border border-[#C8A97E]/30 px-4 py-2 text-[0.5rem] font-bold uppercase tracking-[0.18em] text-[#6B6B6B] transition-all duration-300 hover:border-[#C8A97E] hover:text-[#111] sm:flex"
          >
            All Categories
            <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>

        {/* Category Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5"
        >
          {categories.map((cat) => (
            <motion.div key={cat.slug} variants={card}>
              <Link
                href={cat.slug === 'accessories' ? '/accessories' : collectionHref(cat.slug)}
                className="group block"
                aria-label={`Shop ${cat.name}`}
              >
                {/* Image container */}
                <div className="relative mb-4 aspect-[3/4] overflow-hidden bg-[#F0EDE8]" style={{ borderRadius: '18px' }}>
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/05 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" style={{ borderRadius: '18px' }} />

                  {/* Shop Now CTA */}
                  <div className="absolute bottom-5 left-0 right-0 flex justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                    <span
                      className="inline-flex items-center gap-1.5 text-[0.5rem] font-bold uppercase tracking-[0.18em] text-white"
                      style={{
                        background: 'rgba(255,255,255,0.20)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.35)',
                        borderRadius: '9999px',
                        padding: '6px 14px',
                      }}
                    >
                      Shop Now <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>

                {/* Label */}
                <div className="text-center">
                  <h3 className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[#111] transition-colors duration-200 group-hover:text-[#C8A97E]">
                    {cat.name}
                  </h3>
                  <p className="mt-1 text-[0.5rem] tracking-[0.14em] text-[#6B6B6B]">
                    {cat.subtitle}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Mobile view all */}
        <div className="mt-8 flex justify-center sm:hidden">
          <Link href="/collections" className="btn-luxury-outline text-[0.625rem]">
            All Categories
          </Link>
        </div>
      </div>
    </section>
    </ScrollReveal>
  )
}
