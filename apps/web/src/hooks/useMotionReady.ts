'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useReducedMotion } from '@/lib/motion/react'
import {
  isClientNavigationReady,
  markClientNavigationReady,
  subscribeClientNavigationReady,
} from '@/lib/motion/client-nav-ready'

function isPerfLite(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-perf') === 'lite'
}

/** Windows ANGLE + below-fold reveals = scroll stutter; treat like lite for reveals. */
function isWindowsPerfGate(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-os') === 'windows'
}

function subscribePerfLite(onChange: () => void) {
  if (typeof document === 'undefined') return () => {}
  const html = document.documentElement
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.type === 'attributes' && r.attributeName === 'data-perf')) {
      onChange()
    }
  })
  observer.observe(html, { attributes: true, attributeFilter: ['data-perf'] })
  return () => observer.disconnect()
}

/**
 * Motion gates:
 * - allowEnterAnimation — cross-route page enter only (template.tsx), after client nav click.
 * - allowRevealAnimation — scroll / section reveals on ANY load (hard refresh included).
 * - showMotion — hover/tap/micro after settle.
 */
export function useMotionReady() {
  const reducedMotion = useReducedMotion()
  const isClientNav = useSyncExternalStore(
    subscribeClientNavigationReady,
    isClientNavigationReady,
    () => false,
  )
  const [settled, setSettled] = useState(false)
  const [lite, setLite] = useState(false)
  const [windowsGate, setWindowsGate] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const syncLite = () => setLite(isPerfLite())
    syncLite()
    return subscribePerfLite(syncLite)
  }, [])

  useEffect(() => {
    setWindowsGate(isWindowsPerfGate())
  }, [])

  const motionOk = !reducedMotion && !lite
  // Enter/micro ok on Windows desktop; scroll-reveals off (GPU pressure).
  const allowEnterAnimation = isClientNav && motionOk
  const allowRevealAnimation = settled && motionOk && !windowsGate
  const showMotion = (isClientNav || settled) && motionOk

  return {
    mounted: settled || isClientNav,
    reducedMotion: reducedMotion ?? false,
    showMotion,
    allowEnterAnimation,
    allowRevealAnimation,
  }
}

/** Capture-phase: mark soft nav before Next.js swaps the tree. */
export function MotionNavClickGate() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return
      }
      markClientNavigationReady()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  return null
}
