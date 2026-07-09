'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

export function useScrollReveal(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [coarsePointer, setCoarsePointer] = useState(false)
  const isInView = useInView(ref, {
    once: options?.once ?? true,
    margin: (options?.margin ?? '0px 0px -72px 0px') as `${number}px ${number}px ${number}px ${number}px`,
    amount: 0.12,
  })

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarsePointer(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return {
    ref,
    isInView: reducedMotion || coarsePointer ? true : isInView,
    reducedMotion: reducedMotion ?? false,
    coarsePointer,
  }
}
