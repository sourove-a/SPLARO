'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Instagram } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'

function instagramProfile(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return { href: 'https://instagram.com/splaro.official', handle: '@splaro.official' }
  const href = trimmed.startsWith('http') ? trimmed : `https://instagram.com/${trimmed.replace(/^@/, '')}`
  const handle = trimmed.includes('instagram.com')
    ? `@${trimmed.split('/').filter(Boolean).pop() ?? 'splaro.official'}`
    : trimmed.startsWith('@')
      ? trimmed
      : `@${trimmed}`
  return { href, handle }
}

const posts = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&h=700&q=88&auto=format&fit=crop',
    alt: 'SPLARO editorial — Summer 2026',
    tall: true,
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&h=700&q=88&auto=format&fit=crop',
    alt: 'Women collection look',
    tall: false,
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=700&h=700&q=88&auto=format&fit=crop',
    alt: 'Resort set styling',
    tall: false,
  },
  {
    id: '4',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=700&h=700&q=88&auto=format&fit=crop',
    alt: 'Summer editorial',
    tall: false,
  },
  {
    id: '5',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=700&h=700&q=88&auto=format&fit=crop',
    alt: 'SPLARO look of the day',
    tall: false,
  },
  {
    id: '6',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=700&h=700&q=88&auto=format&fit=crop',
    alt: 'Dress collection',
    tall: false,
  },
]

export function InstagramSection() {
  const settings = useStorefrontSettings()
  const instagram = instagramProfile(settings.social.instagram ?? '')

  return (
    <section className="ig-section" aria-labelledby="ig-heading">
      {/* Header */}
      <motion.div
        className="ig-header"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="ig-eyebrow">
          <Instagram className="h-3.5 w-3.5" strokeWidth={1.8} />
          Follow our world
        </span>
        <h2 id="ig-heading" className="ig-title">{instagram.handle}</h2>
        <p className="ig-sub">Life through the lens of quiet luxury</p>
      </motion.div>

      {/* Grid */}
      <div className="ig-grid">
        {posts.map((post, i) => (
          <motion.a
            key={post.id}
            href={instagram.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={post.alt}
            className={`ig-tile ${post.tall ? 'ig-tile--tall' : ''}`}
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.55, delay: i * 0.055, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src={post.image}
              alt={post.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="ig-tile__img"
            />
            <div className="ig-tile__overlay">
              <Instagram className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
          </motion.a>
        ))}
      </div>

      {/* Follow CTA */}
      <motion.div
        className="ig-cta"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, delay: 0.3 }}
      >
        <Link
          href={instagram.href}
          target="_blank"
          rel="noopener noreferrer"
          className="ig-btn"
        >
          <Instagram className="h-3.5 w-3.5" strokeWidth={1.8} />
          Follow {instagram.handle}
        </Link>
      </motion.div>
    </section>
  )
}
