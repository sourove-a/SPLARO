'use client'

import { useEffect } from 'react'

const PRESS_SELECTOR = [
  'button',
  'a',
  '[role="button"]',
  'summary',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'select',
].join(', ')

/** Soft press — opacity only, never scale (no click “jump”). */
const PRESS_DOWN_OPACITY = 0.95
const PRESS_REST_OPACITY = 1
const DOWN_MS = 110
const RELEASE_MS = 220
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** Skip elements that manage their own tap motion (Motion) or opt out. */
function shouldSkip(el: Element): boolean {
  if ((el as HTMLButtonElement).disabled) return true
  if (el.closest('[data-no-press]')) return true
  if (el.closest('.mm-drawer, .mobile-bottom-nav, .site-header-glass')) return true

  // Product cards — Motion / CSS hit-layer handles tap
  if (
    el.classList.contains('splaro-card__link') ||
    el.classList.contains('splaro-card__link') ||
    el.classList.contains('shop-product-card__link') ||
    el.classList.contains('pc-media__link') ||
    el.classList.contains('pc-info') ||
    el.closest(
      '.splaro-card__link, .splaro-card__link, .shop-product-card__link, .pc-media__link, .pc-info, .product-transition-link__hit',
    )
  ) {
    return true
  }

  if (
    el.classList.contains('shop-bag-btn') ||
    el.classList.contains('shop-wishlist-btn') ||
    el.classList.contains('splaro-card__wish') ||
    el.classList.contains('splaro-card__wish') ||
    el.classList.contains('pc-cart-btn') ||
    el.classList.contains('pc-wish-btn')
  ) {
    return true
  }

  // Size pills — CSS bg/color fade only; opacity flash reads as a jump
  if (el.classList.contains('pp-size-btn') || el.classList.contains('pdp-size-btn')) {
    return true
  }

  // Large tap targets — scale whole anchor feels cheap
  if (el.tagName === 'A') {
    const rect = el.getBoundingClientRect()
    if (rect.width > 140 && rect.height > 140) return true
  }

  return false
}

/**
 * Global soft press on interactive elements — one listener pair.
 * No overshoot / bounce on release (jump-free).
 */
export function GlobalPressFeedback() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let pressedEl: Element | null = null
    let pressAnim: Animation | null = null

    const release = () => {
      const el = pressedEl
      pressedEl = null
      if (!el) return
      try {
        pressAnim?.cancel()
        pressAnim = null
        const anim = el.animate(
          [{ opacity: PRESS_DOWN_OPACITY }, { opacity: PRESS_REST_OPACITY }],
          {
            duration: RELEASE_MS,
            easing: EASE,
          },
        )
        anim.finished
          .then(() => {
            if (el instanceof HTMLElement) el.style.removeProperty('opacity')
          })
          .catch(() => {
            if (el instanceof HTMLElement) el.style.removeProperty('opacity')
          })
      } catch {
        if (el instanceof HTMLElement) el.style.removeProperty('opacity')
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      const target = (event.target as Element | null)?.closest?.(PRESS_SELECTOR)
      if (!target || shouldSkip(target)) return
      release()
      pressedEl = target
      try {
        pressAnim = target.animate(
          [{ opacity: PRESS_REST_OPACITY }, { opacity: PRESS_DOWN_OPACITY }],
          {
            duration: DOWN_MS,
            easing: EASE,
            fill: 'forwards',
          },
        )
      } catch {
        pressedEl = null
        pressAnim = null
      }
    }

    document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true })
    document.addEventListener('pointerup', release, { passive: true, capture: true })
    document.addEventListener('pointercancel', release, { passive: true, capture: true })
    window.addEventListener('blur', release)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true } as EventListenerOptions)
      document.removeEventListener('pointerup', release, { capture: true } as EventListenerOptions)
      document.removeEventListener('pointercancel', release, { capture: true } as EventListenerOptions)
      window.removeEventListener('blur', release)
    }
  }, [])

  return null
}
