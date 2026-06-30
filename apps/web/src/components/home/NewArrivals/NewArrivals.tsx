'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { IlynProductCard } from '@/components/product/ProductCard/IlynProductCard'

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
          {products.map((product) => (
            <motion.div key={product.id} variants={cardVariants}>
              <IlynProductCard
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={product.price}
                {...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {})}
                image={product.image}
                imageHover={product.imageHover}
                collection={product.category}
                status={product.isNew ? 'New' : 'Ready'}
                fit="cover"
              />
            </motion.div>
          ))}
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
