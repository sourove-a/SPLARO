'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView, useReducedMotion } from '@/lib/motion/react'

/** If IntersectionObserver never fires (RDP, broken IO), reveal after this delay. */
const IO_FALLBACK_MS = 2500

export function useScrollReveal(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const inViewOptions = useMemo(
    () => ({
      once: options?.once ?? true,
      margin: (options?.margin ?? '0px 0px -72px 0px') as `${number}px ${number}px ${number}px ${number}px`,
      amount: 0.12 as const,
    }),
    [options?.once, options?.margin],
  )
  const isInView = useInView(ref, inViewOptions)
  const [ioFallback, setIoFallback] = useState(false)

  useEffect(() => {
    if (reducedMotion || isInView) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight
    if (rect.top < vh * 0.92 && rect.bottom > vh * 0.05) {
      setIoFallback(true)
      return
    }
    const timer = window.setTimeout(() => setIoFallback(true), IO_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, isInView])

  return {
    ref,
    isInView: reducedMotion ? true : isInView || ioFallback,
    reducedMotion: reducedMotion ?? false,
  }
}
