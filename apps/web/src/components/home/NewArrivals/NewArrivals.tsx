'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

const products = [
  {
    id: '1',
    name: 'Ivory Embroidered Kurta',
    slug: 'ivory-embroidered-kurta',
    price: 5800,
    compareAtPrice: 7200,
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b941b?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&h=800&q=88&fit=crop',
    isNew: true,
    category: 'Luxury Pret',
  },
  {
    id: '2',
    name: 'Rose Lawn Three Piece',
    slug: 'rose-lawn-three-piece',
    price: 3200,
    compareAtPrice: null,
    image: 'https://images.unsplash.com/photo-1524504388-852ba15a6f8a?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&q=88&fit=crop',
    isNew: true,
    category: 'Three Piece',
  },
  {
    id: '3',
    name: 'Midnight Silk Saree',
    slug: 'midnight-silk-saree',
    price: 12500,
    compareAtPrice: 14800,
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&q=88&fit=crop',
    isNew: true,
    category: 'Sarees',
  },
  {
    id: '4',
    name: 'Pearl Festive Set',
    slug: 'pearl-festive-set',
    price: 9900,
    compareAtPrice: null,
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=800&q=88&fit=crop',
    isNew: true,
    category: 'Luxury Pret',
  },
]

const containerVariants = staggerContainer
const cardVariants = fadeUp

export function NewArrivals() {
  return (
    <ScrollReveal variant="fadeUp">
    <section className="section-padding" aria-labelledby="new-arrivals-heading">
      <div className="container-luxury">
        {/* Header */}
        <motion.div
          className="mb-14 flex items-end justify-between"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <p className="label-luxury mb-3 text-gold">Just Arrived</p>
            <h2 id="new-arrivals-heading" className="heading-xl text-luxury-black">
              New Arrivals
            </h2>
          </div>
          <Link
            href="/new-arrivals"
            className="hidden items-center gap-2 text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-luxury-gray transition-colors hover:text-luxury-black sm:flex"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </motion.div>

        {/* Product Grid */}
        <motion.div
          className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {products.map((product) => {
            const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
            const discount = hasDiscount
              ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
              : 0

            return (
              <motion.article key={product.id} variants={cardVariants} className="group">
                <Link href={`/products/${product.slug}`} aria-label={product.name}>
                  {/* Image — second image hover reveal */}
                  <div className="relative mb-4 aspect-[3/4] overflow-hidden bg-[#F0EDE8]" style={{ borderRadius: '16px' }}>
                    {/* Primary image */}
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover object-top transition-opacity duration-600 ease-out group-hover:opacity-0"
                    />
                    {/* Hover image */}
                    <Image
                      src={product.imageHover}
                      alt={`${product.name} — alternate view`}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover object-top opacity-0 transition-opacity duration-600 ease-out group-hover:opacity-100"
                    />

                    {/* Badge — New */}
                    <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                      <span className="rounded-full bg-[#111] px-2.5 py-1 text-[0.46rem] font-bold uppercase tracking-[0.18em] text-white">
                        New
                      </span>
                      {hasDiscount && (
                        <span className="rounded-full bg-[#C8A97E] px-2.5 py-1 text-[0.46rem] font-bold uppercase tracking-[0.18em] text-white">
                          -{discount}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Product info — minimal */}
                  <div className="space-y-1.5">
                    <p className="text-[0.5rem] font-semibold uppercase tracking-[0.2em] text-[#6B6B6B]">
                      {product.category}
                    </p>
                    <h3 className="text-[0.8125rem] font-semibold tracking-wide text-[#111] transition-colors duration-200 group-hover:text-[#6B6B6B]">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[0.8125rem] font-bold text-[#111]">
                        {formatBDT(product.price)}
                      </span>
                      {hasDiscount && (
                        <span className="text-[0.6875rem] text-[#6B6B6B] line-through">
                          {formatBDT(product.compareAtPrice!)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.article>
            )
          })}
        </motion.div>

        {/* Mobile CTA */}
        <div className="mt-10 flex justify-center sm:hidden">
          <Link href="/new-arrivals" className="btn-luxury-outline inline-flex items-center gap-2 text-[0.5625rem]">
            View All New Arrivals
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
    </ScrollReveal>
  )
}
