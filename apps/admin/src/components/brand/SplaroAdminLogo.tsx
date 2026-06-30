import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

/**
 * Official SPLARO Arabic + wordmark assets.
 * Light UI: splaro-brand-mark-transparent.png (real PNG alpha).
 * Do NOT use splaro-brand-mark.png — it is a JPEG export with a baked-in checkerboard.
 */
const LOGO = {
  full: {
    light: '/images/logo/splaro-brand-mark-transparent.png',
    dark: '/images/logo/splaro-logo-white.png',
    width: 1024,
    height: 682,
  },
  mark: {
    light: '/images/logo/splaro-brand-mark-transparent.png',
    dark: '/images/logo/splaro-brand-mark-transparent.png',
    width: 1024,
    height: 682,
    invertInDark: true,
  },
} as const

const variants = {
  sidebar: {
    ...LOGO.full,
    className: 'h-8 w-auto max-w-[168px] sm:h-9',
  },
  login: {
    ...LOGO.full,
    className: 'h-auto w-[170px] sm:w-[210px] md:w-[240px]',
  },
  mark: {
    ...LOGO.mark,
    className: 'h-8 w-auto max-w-[2.5rem]',
  },
  avatar: {
    ...LOGO.mark,
    className: 'h-6 w-auto max-w-[2.25rem]',
  },
  empty: {
    ...LOGO.mark,
    className: 'h-14 w-auto max-w-[140px] opacity-35',
  },
} as const

export type SplaroAdminLogoVariant = keyof typeof variants

interface SplaroAdminLogoProps {
  variant?: SplaroAdminLogoVariant
  className?: string
  priority?: boolean
}

export function SplaroAdminLogo({
  variant = 'sidebar',
  className,
  priority = false,
}: SplaroAdminLogoProps) {
  const asset = variants[variant]
  const invertInDark = 'invertInDark' in asset && asset.invertInDark
  const imageClass = cn('object-contain object-left', asset.className, className)
  const darkImageClass = cn(
    imageClass,
    invertInDark && 'splaro-admin-logo--invert-dark',
  )

  return (
    <span className={cn('splaro-admin-logo inline-flex', `splaro-admin-logo--${variant}`)}>
      <Image
        src={asset.light}
        alt="SPLARO"
        width={asset.width}
        height={asset.height}
        priority={priority}
        unoptimized
        className={cn(imageClass, 'dark:hidden')}
      />
      <Image
        src={asset.dark}
        alt=""
        aria-hidden
        width={asset.width}
        height={asset.height}
        priority={priority}
        unoptimized
        className={cn(darkImageClass, 'hidden dark:block')}
      />
    </span>
  )
}
