import Image from 'next/image'
import { SPLARO_TAB_ICONS } from '@splaro/config'
import { cn } from '@/lib/utils/cn'

/**
 * Official SPLARO Arabic + wordmark — one asset for large logos.
 * Small surfaces (tab, profile pill) use baked icon — never theme-swaps.
 */
const LOGO_WORDMARK = '/images/logo/splaro-brand-mark-transparent.png'
const LOGO_ICON = SPLARO_TAB_ICONS.profile
const WORDMARK_WIDTH = 1024
const WORDMARK_HEIGHT = 682
const ICON_SIZE = 64

const variants = {
  sidebar: {
    src: LOGO_WORDMARK,
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    className: 'h-8 w-auto max-w-[168px] sm:h-9',
    onLightSurface: false,
  },
  login: {
    src: LOGO_WORDMARK,
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    className: 'h-auto w-[170px] sm:w-[210px] md:w-[240px]',
    onLightSurface: true,
  },
  mark: {
    src: LOGO_ICON,
    width: ICON_SIZE,
    height: ICON_SIZE,
    className: 'h-9 w-9',
    onLightSurface: true,
    square: true,
  },
  avatar: {
    src: LOGO_ICON,
    width: ICON_SIZE,
    height: ICON_SIZE,
    className: 'h-full w-full',
    onLightSurface: true,
    square: true,
  },
  empty: {
    src: LOGO_WORDMARK,
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    className: 'h-14 w-auto max-w-[140px] opacity-35',
    onLightSurface: false,
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
  const config = variants[variant]

  return (
    <span
      className={cn(
        'splaro-admin-logo inline-flex',
        `splaro-admin-logo--${variant}`,
        config.onLightSurface && 'splaro-admin-logo--on-light',
        'square' in config && config.square && 'splaro-admin-logo--square',
      )}
    >
      <Image
        src={config.src}
        alt="SPLARO"
        width={config.width}
        height={config.height}
        priority={priority}
        unoptimized
        className={cn(
          'splaro-admin-logo__img object-contain',
          'square' in config && config.square ? 'object-center' : 'object-left',
          config.className,
          className,
        )}
      />
    </span>
  )
}
