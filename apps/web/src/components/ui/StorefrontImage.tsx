import Image, { type ImageProps } from 'next/image'
import {
  IMAGE_BLUR_PLACEHOLDER,
  IMAGE_QUALITY,
  IMAGE_SIZES,
  optimizeImageSrc,
  type ImageProfile,
} from '@/lib/assets/image-optimize'
import { cn } from '@/lib/utils/cn'

type StorefrontImageProps = Omit<ImageProps, 'src' | 'placeholder' | 'blurDataURL'> & {
  src: string
  profile?: ImageProfile
  withBlur?: boolean
}

export function StorefrontImage({
  src,
  profile = 'card',
  quality,
  sizes,
  withBlur = true,
  className,
  alt,
  ...rest
}: StorefrontImageProps) {
  const optimizedSrc = optimizeImageSrc(src, profile)
  const useBlur = withBlur && (rest.fill !== undefined || (rest.width !== undefined && rest.height !== undefined))

  const sizeMap: Record<ImageProfile, string> = {
    card: IMAGE_SIZES.card,
    gallery: IMAGE_SIZES.gallery,
    hero: IMAGE_SIZES.hero,
    thumb: IMAGE_SIZES.thumb,
    lightbox: IMAGE_SIZES.lightbox,
  }

  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      sizes={sizes ?? sizeMap[profile]}
      quality={quality ?? IMAGE_QUALITY[profile]}
      className={cn('sf-image', className)}
      {...(useBlur ? { placeholder: 'blur' as const, blurDataURL: IMAGE_BLUR_PLACEHOLDER } : {})}
      {...rest}
    />
  )
}
