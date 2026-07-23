'use client'

import { useEffect, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import {
  IMAGE_BLUR_PLACEHOLDER,
  IMAGE_QUALITY,
  IMAGE_SIZES,
  isProductPipelineSrc,
  mobileImageProfile,
  optimizeImageSrc,
  productPipelinePictureSources,
  type ImageProfile,
} from '@/lib/assets/image-optimize'
import { useMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'

type StorefrontImageProps = Omit<ImageProps, 'src' | 'placeholder' | 'blurDataURL'> & {
  src: string
  profile?: ImageProfile
  withBlur?: boolean
  fit?: 'contain' | 'cover'
  /** Allow Pexels/Unsplash sources (hero/editorial backdrops) — blocked by default for product imagery. */
  allowStockMedia?: boolean
}

export function StorefrontImage({
  src,
  profile = 'card',
  quality,
  sizes,
  withBlur = true,
  fit,
  className,
  alt,
  allowStockMedia,
  priority,
  fetchPriority,
  ...rest
}: StorefrontImageProps) {
  const isMobile = useMobileViewport()
  const mounted = useMounted()
  // Mobile-first until mount proves desktop — premium LCP (never start at 1920/900).
  const effectiveProfile =
    !mounted || isMobile ? mobileImageProfile(profile) : profile
  const optimizedSrc = optimizeImageSrc(
    src,
    effectiveProfile,
    undefined,
    allowStockMedia ? { allowStockMedia: true } : undefined,
  )
  const [failed, setFailed] = useState(false)
  const pipelinePicture =
    !failed && isProductPipelineSrc(optimizedSrc)
      ? productPipelinePictureSources(optimizedSrc, effectiveProfile)
      : null

  useEffect(() => {
    setFailed(false)
  }, [optimizedSrc])

  const useBlur = withBlur && (rest.fill !== undefined || (rest.width !== undefined && rest.height !== undefined))
  let priorityProps: Pick<ImageProps, 'priority' | 'fetchPriority'> = {}

  if (priority) {
    priorityProps = {
      priority: true,
      fetchPriority: fetchPriority ?? 'high',
    }
  } else if (fetchPriority) {
    priorityProps = { fetchPriority }
  }

  const sizeMap: Record<ImageProfile, string> = {
    card: IMAGE_SIZES.card,
    cardMobile: IMAGE_SIZES.cardMobile,
    gallery: IMAGE_SIZES.gallery,
    galleryMobile: IMAGE_SIZES.galleryMobile,
    hero: IMAGE_SIZES.hero,
    heroMobile: IMAGE_SIZES.heroMobile,
    thumb: IMAGE_SIZES.thumb,
    lightbox: IMAGE_SIZES.lightbox,
  }

  const image = (
    <Image
      src={failed ? PRODUCT_IMAGE_PLACEHOLDER : optimizedSrc}
      alt={alt}
      onError={() => setFailed(true)}
      sizes={sizes ?? sizeMap[effectiveProfile]}
      quality={quality ?? IMAGE_QUALITY[effectiveProfile]}
      className={cn(
        'sf-image',
        fit === 'cover' && 'sf-image--cover',
        fit === 'contain' && 'sf-image--contain',
        className,
      )}
      {...priorityProps}
      {...(useBlur ? { placeholder: 'blur' as const, blurDataURL: IMAGE_BLUR_PLACEHOLDER } : {})}
      {...rest}
    />
  )

  if (!pipelinePicture) return image

  // Prefer AVIF when the browser supports it; WebP (and Next/Image) remain the fallback.
  return (
    <picture
      className={cn(
        'sf-image-picture',
        rest.fill !== undefined && 'sf-image-picture--fill',
      )}
    >
      <source srcSet={pipelinePicture.avif} type="image/avif" />
      <source srcSet={pipelinePicture.webp} type="image/webp" />
      {image}
    </picture>
  )
}
