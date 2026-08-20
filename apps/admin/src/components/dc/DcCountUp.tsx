'use client'

import { useCountUp } from '@/lib/hooks/use-count-up'

/**
 * Animated figure. `format` runs on every frame, so the money and unit
 * formatting the card already used stays the single source of truth for how
 * the number reads — the animation never invents its own formatting.
 */
export function DcCountUp({
  value,
  format,
}: {
  value: number
  format?: (n: number) => string
}) {
  const shown = useCountUp(value)
  const rendered = format ? format(shown) : String(Math.round(shown))
  return <>{rendered}</>
}
