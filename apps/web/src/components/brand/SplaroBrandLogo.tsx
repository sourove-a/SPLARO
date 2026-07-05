import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

const logoAssets = {
  /** Header/footer — SPLARO wordmark on light backgrounds */
  light: {
    src: '/images/logo/splaro-logo-dark.svg',
    width: 200,
    height: 50,
  },
  dark: {
    src: '/images/logo/splaro-logo-white.svg',
    width: 200,
    height: 50,
  },
  /** Auth / login pages */
  brand: {
    src: '/images/logo/splaro-brand.svg',
    width: 200,
    height: 50,
  },
} as const

const sizes = {
  header: 'h-12 w-auto sm:h-[3.35rem] md:h-[3.65rem] lg:h-[4rem] xl:h-[4.25rem]',
  footer: 'h-10 w-auto sm:h-12',
  footerLuxury: 'h-12 w-auto sm:h-14 md:h-[3.75rem]',
  auth: 'h-auto w-[200px] sm:w-[244px] md:w-[280px]',
} as const

interface SplaroBrandLogoProps {
  href?: string
  className?: string
  size?: keyof typeof sizes
  tone?: 'light' | 'dark'
  priority?: boolean
  onClick?: () => void
  logoUrl?: string
}

/** Never use favicon/mark assets as the header/footer wordmark. */
function isHeaderLogoUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    !lower.includes('favicon') &&
    !lower.includes('brand-mark') &&
    !lower.includes('arabic-logo') &&
    !lower.endsWith('splaro-mark.png')
  )
}

export function resolveStoreLogo(logo: string): string {
  const trimmed = logo.trim()
  if (!trimmed || !isHeaderLogoUrl(trimmed)) return ''
  return trimmed
}

/** Safe spread for exactOptionalPropertyTypes — omit prop when logo is empty. */
export function logoUrlProp(logo: string): Pick<SplaroBrandLogoProps, 'logoUrl'> {
  const resolved = resolveStoreLogo(logo)
  return resolved ? { logoUrl: resolved } : {}
}

export function SplaroBrandLogo({
  href = '/',
  className = '',
  size = 'auth',
  tone = 'light',
  priority = false,
  onClick,
  logoUrl,
}: SplaroBrandLogoProps) {
  const asset = size === 'auth' ? logoAssets.brand : logoAssets[tone]
  const src = logoUrl?.trim() || asset.src

  const logo = (
    <Image
      src={src}
      alt="SPLARO"
      width={asset.width}
      height={asset.height}
      priority={priority}
      quality={100}
      sizes="(max-width: 1023px) 168px, 200px"
      unoptimized
      className={cn(
        'object-contain',
        size === 'header' ? 'object-center splaro-logo-crisp' : 'object-left',
        sizes[size],
        className,
      )}
    />
  )

  if (href) {
    return (
      <Link
        href={href}
        {...(onClick ? { onClick } : {})}
        aria-label="SPLARO — Home"
        className={cn(
          'inline-flex',
          size === 'header' ? 'justify-center lg:justify-start' : 'justify-center',
        )}
      >
        {logo}
      </Link>
    )
  }

  return logo
}
