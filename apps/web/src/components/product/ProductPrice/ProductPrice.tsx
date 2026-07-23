import type { ReactNode } from 'react'
import { calcDiscountPercent, formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'

export type ProductPriceProps = {
  price: number
  compareAtPrice?: number | null | undefined
  className?: string
  priceClassName?: string
  compareClassName?: string
  badgeClassName?: string
  /** Extra class on the current price when a discount is active */
  salePriceClassName?: string
  /** Show “-%” / “% OFF” badge beside the prices (PDP-style) */
  showBadge?: boolean
  /** Visible badge uses “11% OFF” instead of “-11%” */
  badgeLabelStyle?: 'minus' | 'off'
  /** Optional trailing content in the price row (e.g. card meta) */
  children?: ReactNode
}

/**
 * Accessible product price block.
 * Keeps sale price, regular price, and discount badge as separate semantics
 * so screen readers / crawlers do not hear “BDT 3190 BDT 3590-11%”.
 */
export function ProductPrice({
  price,
  compareAtPrice,
  className,
  priceClassName,
  compareClassName,
  badgeClassName,
  salePriceClassName,
  showBadge = false,
  badgeLabelStyle = 'minus',
  children,
}: ProductPriceProps) {
  const hasDiscount = Boolean(compareAtPrice != null && compareAtPrice > price)
  const discountPct = hasDiscount
    ? calcDiscountPercent(Number(compareAtPrice), price)
    : 0
  const saleLabel = formatBDT(price)
  const regularLabel = hasDiscount ? formatBDT(Number(compareAtPrice)) : ''

  return (
    <div className={cn(className)} data-product-price="">
      <span
        className={cn(priceClassName, hasDiscount && salePriceClassName)}
        data-price="sale"
      >
        <span className="sr-only">{hasDiscount ? 'Sale price: ' : 'Price: '}</span>
        {saleLabel}
      </span>

      {hasDiscount ? (
        <del className={cn(compareClassName)} data-price="regular">
          <span className="sr-only">Regular price: </span>
          {regularLabel}
        </del>
      ) : null}

      {hasDiscount && showBadge && discountPct > 0 ? (
        <span className={cn(badgeClassName)} data-price="discount">
          <span className="sr-only">{discountPct}% OFF</span>
          <span aria-hidden="true">
            {badgeLabelStyle === 'off' ? `${discountPct}% OFF` : `-${discountPct}%`}
          </span>
        </span>
      ) : null}

      {children}
    </div>
  )
}

/** Image/overlay sale chip — announces “11% OFF”, not “minus eleven percent”. */
export function ProductDiscountBadge({
  compareAtPrice,
  price,
  className,
  labelStyle = 'minus',
}: {
  compareAtPrice: number
  price: number
  className?: string
  labelStyle?: 'minus' | 'off'
}) {
  const discountPct = calcDiscountPercent(compareAtPrice, price)
  if (discountPct <= 0) return null

  return (
    <span className={cn(className)} aria-label={`${discountPct}% off`}>
      <span aria-hidden="true">
        {labelStyle === 'off' ? `${discountPct}% OFF` : `-${discountPct}%`}
      </span>
    </span>
  )
}
