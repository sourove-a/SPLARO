'use client'

import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { Package } from 'lucide-react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'

type LineIcon = ComponentType<SVGProps<SVGSVGElement>>

export type PdpShippingLine = {
  icon: LineIcon
  text: string
}

type PdpShippingStoryProps = {
  active: boolean
  lines: PdpShippingLine[]
}

/**
 * PDP Shipping accordion — van story on open.
 * Rate / days / origin lines are always fully visible (never opacity-gated).
 */
export function PdpShippingStory({ active, lines }: PdpShippingStoryProps) {
  const reducedMotion = useReducedMotion()
  const [playKey, setPlayKey] = useState(0)

  useEffect(() => {
    if (!active || reducedMotion) return
    setPlayKey((k) => k + 1)
  }, [active, reducedMotion])

  return (
    <div className={cn('pp-ship-story', active && 'pp-ship-story--active')}>
      {!reducedMotion ? (
        <div
          className={cn('pp-ship-story__scene', !active && 'pp-ship-story__scene--idle')}
          aria-hidden
        >
          {active ? (
            <div key={playKey} className="pp-ship-story__scene-play">
              <span className="pp-ship-story__glow" />
              <span className="pp-ship-story__skyline" />
              <span className="pp-ship-story__road" />
              <span className="pp-ship-story__pin pp-ship-story__pin--origin" />
              <span className="pp-ship-story__pin pp-ship-story__pin--dest" />
              <motion.span
                className="pp-ship-story__van"
                initial={{ x: '-22%', opacity: 0.85 }}
                animate={{ x: '108%', opacity: 1 }}
                transition={{ duration: 1.35, ease: [0.22, 0.82, 0.28, 1], delay: 0.12 }}
              >
                <span className="pp-ship-story__van-cab" />
                <span className="pp-ship-story__van-bay">
                  <Package className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                </span>
                <span className="pp-ship-story__wheel pp-ship-story__wheel--l" />
                <span className="pp-ship-story__wheel pp-ship-story__wheel--r" />
              </motion.span>
              <span className="pp-ship-story__dust pp-ship-story__dust--1" />
              <span className="pp-ship-story__dust pp-ship-story__dust--2" />
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="pp-accordion__list pp-ship-story__list">
        {lines.map((line) => {
          const LineIcon = line.icon
          return (
            <li key={line.text} className="pp-accordion__item">
              <LineIcon
                className="pp-accordion__item-icon"
                strokeWidth={1.65}
                aria-hidden
              />
              <span>{line.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
