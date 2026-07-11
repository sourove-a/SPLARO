'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** After hydration — safe to run Framer enter/reveal animations (avoids SSR style mismatch). */
export function useMotionReady() {
  const reducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const showMotion = mounted && !reducedMotion

  return {
    mounted,
    reducedMotion: reducedMotion ?? false,
    showMotion,
  }
}
