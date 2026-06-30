'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

type Category = 'All' | 'Sarees' | 'Three Piece' | 'Luxury Pret' | 'Accessories'

const categories: Category[] = ['All', 'Sarees', 'Three Piece', 'Luxury Pret', 'Accessories']

const products = [
  {
    id: 'bs1',
    name: 'Chantilly Embroidered Set',
    slug: 'chantilly-embroidered-set',
    price: 8500,
    image: 'https://images.unsplash.com/photo-1524504388-852ba15a6f8a?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1594938298603-c8148c4b941b?w=600&h=800&q=88&fit=crop',
    category: 'Luxury Pret' as Category,
    sold: 342,
  },
  {
    id: 'bs2',
    name: 'Kashmiri Silk Saree',
    slug: 'kashmiri-silk-saree',
    price: 14500,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=800&q=88&fit=crop',
    category: 'Sarees' as Category,
    sold: 189,
  },
  {
    id: 'bs3',
    name: 'Heritage Lawn Three Piece',
    slug: 'heritage-lawn-three-piece',
    price: 4200,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&h=800&q=88&fit=crop',
    category: 'Three Piece' as Category,
    sold: 489,
  },
  {
    id: 'bs4',
    name: 'Regal Kurta Set',
    slug: 'regal-kurta-set',
    price: 6800,
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1524504388-852ba15a6f8a?w=600&h=800&q=88&fit=crop',
    category: 'Luxury Pret' as Category,
    sold: 298,
  },
  {
    id: 'bs5',
    name: 'Dhakai Jamdani Saree',
    slug: 'dhakai-jamdani-saree',
    price: 22000,
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&q=88&fit=crop',
    category: 'Sarees' as Category,
    sold: 112,
  },
  {
    id: 'bs6',
    name: 'Summer Lawn Suit',
    slug: 'summer-lawn-suit',
    price: 2800,
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=800&q=88&fit=crop',
    category: 'Three Piece' as Category,
    sold: 720,
  },
  {
    id: 'bs7',
    name: 'Pearl Evening Bag',
    slug: 'pearl-evening-bag',
    price: 3500,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=800&q=88&fit=crop',
    category: 'Accessories' as Category,
    sold: 265,
  },
  {
    id: 'bs8',
    name: 'Midnight Festive Anarkali',
    slug: 'midnight-festive-anarkali',
    price: 15500,
    image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&h=800&q=88&fit=crop',
    imageHover: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&q=88&fit=crop',
    category: 'Luxury Pret' as Category,
    sold: 167,
  },
]

const containerVariants = staggerContainer
const cardVariants = fadeUp

export function BestSellers() {
  const [active, setActive] = useState<Category>('All')
  const filtered = active === 'All' ? products : products.filter((p) => p.category === active)

  return (
    <ScrollReveal variant="fadeUp">
    <section className="section-padding bg-ivory-100" aria-labelledby="best-sellers-heading">
      <div className="container-luxury">
        {/* Header */}
        <motion.div
          className="mb-12 flex items-end justify-between"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <p className="label-luxury mb-3 text-gold">Customer Favourites</p>
            <h2 id="best-sellers-heading" className="heading-xl text-luxury-black">
              Best Sellers
            </h2>
          </div>
          <Link
            href="/best-sellers"
            className="hidden items-center gap-2 text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-luxury-gray transition-colors hover:text-luxury-black sm:flex"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </motion.div>

        {/* Filter tabs */}
        <div className="mb-12 flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
          {categories.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={active === cat}
              onClick={() => setActive(cat)}
              className={cn(
                'rounded-full border px-5 py-2 text-[0.5rem] font-bold uppercase tracking-[0.14em] transition-all duration-300',
                active === cat
                  ? 'border-[#111] bg-[#111] text-white shadow-md'
                  : 'border-[rgba(17,17,17,0.12)] bg-white text-[#6B6B6B] hover:border-[#111] hover:text-[#111]',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <motion.div
          className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-12 md:grid-cols-3 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          key={active}
        >
          {filtered.map((product) => (
            <motion.article key={product.id} variants={cardVariants} className="group">
              <Link href={`/products/${product.slug}`} aria-label={product.name}>
                {/* Image with hover swap */}
                <div className="relative mb-4 aspect-[3/4] overflow-hidden bg-[#F0EDE8]" style={{ borderRadius: '16px' }}>
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover object-top transition-opacity duration-600 ease-out group-hover:opacity-0"
                  />
                  <Image
                    src={product.imageHover}
                    alt={`${product.name} — alternate view`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover object-top opacity-0 transition-opacity duration-600 ease-out group-hover:opacity-100"
                  />
                </div>

                {/* Info */}
                <div className="space-y-1.5">
                  <p className="text-[0.5rem] uppercase tracking-[0.2em] text-luxury-gray">
                    {product.category}
                  </p>
                  <h3 className="text-[0.8125rem] font-semibold tracking-wide text-[#111] transition-colors duration-200 group-hover:text-[#6B6B6B]">
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.8125rem] font-medium text-luxury-black">
                      {formatBDT(product.price)}
                    </span>
                    <span className="text-[0.5rem] text-luxury-gray/60 uppercase tracking-[0.1em]">
                      {product.sold} sold
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
    </ScrollReveal>
  )
}
