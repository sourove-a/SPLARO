'use client'

import { useEffect, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import {
  IMAGE_BLUR_PLACEHOLDER,
  IMAGE_QUALITY,
  IMAGE_SIZES,
  mobileImageProfile,
  optimizeImageSrc,
  type ImageProfile,
} from '@/lib/assets/image-optimize'
import { useMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'

type StorefrontImageProps = Omit<ImageProps, 'src' | 'placeholder' | 'blurDataURL'> & {
  src: string
  profile?: ImageProfile
  withBlur?: boolean
  fit?: 'contain' | 'cover'
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
  ...rest
}: StorefrontImageProps) {
  const isMobile = useMobileViewport()
  const mounted = useMounted()
  const effectiveProfile =
    mounted && isMobile ? mobileImageProfile(profile) : profile
  const optimizedSrc = optimizeImageSrc(src, effectiveProfile)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [optimizedSrc])

  const useBlur = withBlur && (rest.fill !== undefined || (rest.width !== undefined && rest.height !== undefined))

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

  return (
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
      {...(useBlur ? { placeholder: 'blur' as const, blurDataURL: IMAGE_BLUR_PLACEHOLDER } : {})}
      {...rest}
    />
  )
}
