'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { HomepageCategoryTile } from '@/lib/catalog/homepage-department-rows'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { cn } from '@/lib/utils/cn'

interface HomeCategoryTileProps {
  tile: HomepageCategoryTile
  priority?: boolean
  active?: boolean
}

export function HomeCategoryTile({
  tile,
  priority = false,
  active = false,
}: HomeCategoryTileProps) {
  const [imgSrc, setImgSrc] = useState(() => optimizeImageSrc(tile.image, 'tile', tile.image))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setImgSrc(optimizeImageSrc(tile.image, 'tile', tile.image))
    setFailed(false)
  }, [tile.image])

  const handleError = () => {
    if (imgSrc !== tile.image && tile.image) {
      setImgSrc(tile.image)
    } else {
      setFailed(true)
    }
  }

  return (
    <Link
      href={tile.href}
      className={cn('home-dept-tile', active && 'is-active')}
    >
      <div className="home-dept-tile__media">
        {/* The VPS runs next/image unoptimized (sharp would peg the CPU), so the
            remote URL is what the browser downloads — ask the host for tile size. */}
        <Image
          src={failed ? PRODUCT_IMAGE_PLACEHOLDER : imgSrc}
          alt={tile.label}
          fill
          sizes="(max-width: 767px) 72vw, (max-width: 1279px) 28vw, 22vw"
          className="home-dept-tile__img"
          onError={handleError}
          {...(priority ? { priority: true } : { loading: 'lazy' as const })}
        />
        <span className="home-dept-tile__gradient" aria-hidden />
        <span className="home-dept-tile__label">{tile.label}</span>
      </div>
    </Link>
  )
}

