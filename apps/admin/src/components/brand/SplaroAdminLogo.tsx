'use client'

import Image from 'next/image'
import { useState } from 'react'
import { SPLARO_TAB_ICONS } from '@splaro/config'
import { cn } from '@/lib/utils/cn'

/**
 * Official SPLARO Arabic + wordmark.
 * Black premium on light surfaces; white premium on always-dark shells (login).
 * Dark theme inverts the black wordmark to white via CSS (except onLightSurface).
 * Square variants fall back to initials if the asset fails — never broken-image alt text.
 */
const LOGO_WORDMARK_BLACK = '/images/logo/splaro-logo-black-premium.webp'
const LOGO_WORDMARK_WHITE = '/images/logo/splaro-logo-white-premium.webp'
/** Square mark — already white glyph; no CSS invert needed */
const LOGO_AVATAR = '/images/logo/splaro-logo-white-mark.webp'
const LOGO_MARK = SPLARO_TAB_ICONS.icon192
const WORDMARK_WIDTH = 220
const WORDMARK_HEIGHT = 117
const ICON_SIZE = 192

const variants = {
  sidebar: {
    src: LOGO_WORDMARK_BLACK,
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    className: 'h-8 w-auto max-w-[168px] sm:h-9',
    onLightSurface: false,
  },
  login: {
    src: LOGO_WORDMARK_WHITE,
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    className: 'h-auto w-[170px] sm:w-[210px] md:w-[240px]',
    onLightSurface: true,
  },
  pos: {
    src: LOGO_WORDMARK_BLACK,
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    className: 'h-8 w-auto max-w-[150px] sm:h-9',
    onLightSurface: true,
  },
  mark: {
    src: LOGO_MARK,
    width: ICON_SIZE,
    height: ICON_SIZE,
    className: 'h-9 w-9',
    onLightSurface: true,
    square: true,
  },
  avatar: {
    src: LOGO_AVATAR,
    width: ICON_SIZE,
    height: ICON_SIZE,
    className: 'h-full w-full',
    onLightSurface: true,
    square: true,
    /** White asset — do not invert */
    preinverted: true,
  },
  empty: {
    src: LOGO_WORDMARK_BLACK,
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
  connectionLive?: boolean
}

export function SplaroAdminLogo({
  variant = 'sidebar',
  className,
  priority = false,
  connectionLive = false,
}: SplaroAdminLogoProps) {
  const config = variants[variant]
  const [failed, setFailed] = useState(false)
  const isSquare = 'square' in config && config.square
  const preinverted = 'preinverted' in config && config.preinverted

  return (
    <span
      className={cn(
        'splaro-admin-logo inline-flex',
        `splaro-admin-logo--${variant}`,
        config.onLightSurface && 'splaro-admin-logo--on-light',
        isSquare && 'splaro-admin-logo--square',
        preinverted && 'splaro-admin-logo--preinverted',
        connectionLive && (variant === 'mark' || variant === 'avatar') && 'splaro-admin-logo--live',
      )}
    >
      {failed && isSquare ? (
        <span className="admin-avatar" aria-hidden>
          SP
        </span>
      ) : (
        <Image
          src={config.src}
          alt=""
          width={config.width}
          height={config.height}
          priority={priority}
          unoptimized
          onError={() => setFailed(true)}
          className={cn(
            'splaro-admin-logo__img object-contain',
            isSquare ? 'object-center' : 'object-left',
            config.className,
            className,
          )}
        />
      )}
    </span>
  )
}
