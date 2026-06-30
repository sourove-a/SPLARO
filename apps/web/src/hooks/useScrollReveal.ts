'use client'

import { useRef } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

export function useScrollReveal(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const isInView = useInView(ref, {
    once: options?.once ?? true,
    margin: (options?.margin ?? '0px 0px -80px 0px') as `${number}px ${number}px ${number}px ${number}px`,
  })

  return {
    ref,
    isInView: reducedMotion ? true : isInView,
    reducedMotion: reducedMotion ?? false,
  }
}
