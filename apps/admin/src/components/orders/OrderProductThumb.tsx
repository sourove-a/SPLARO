'use client'

import { Package } from 'lucide-react'
import { resolveAssetUrl } from '@/lib/utils/assets'
import { cn } from '@/lib/utils/cn'

interface OrderProductThumbProps {
  src?: string | null
  alt?: string
  className?: string
  size?: 'sm' | 'md'
}

export function OrderProductThumb({ src, alt = '', className, size = 'sm' }: OrderProductThumbProps) {
  const resolved = resolveAssetUrl(src)

  return (
    <div
      className={cn(
        'admin-product-thumb',
        size === 'md' && 'admin-product-thumb--md',
        !resolved && 'admin-product-thumb--fallback',
        className,
      )}
      aria-hidden={!alt}
    >
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolved} alt={alt} className="admin-product-thumb__img" loading="lazy" />
      ) : (
        <Package className="admin-product-thumb__icon" aria-hidden />
      )}
    </div>
  )
}

interface ProductThumbsProps {
  images: string[]
  count: number
}

export function ProductThumbs({ images, count }: ProductThumbsProps) {
  const unique = [...new Set(images.map((u) => resolveAssetUrl(u)).filter(Boolean))]
  const shown = unique.slice(0, 3)
  const extra = Math.max(0, count - shown.length)

  if (shown.length === 0) {
    return (
      <div className="admin-product-thumbs">
        <OrderProductThumb />
      </div>
    )
  }

  return (
    <div className="admin-product-thumbs">
      {shown.map((src, i) => (
        <OrderProductThumb
          key={`${src}-${i}`}
          src={src}
          {...(i === 0 ? { className: '!ml-0' } : {})}
        />
      ))}
      {extra > 0 ? (
        <div className="admin-product-thumb admin-product-thumb--more">+{extra}</div>
      ) : null}
    </div>
  )
}
