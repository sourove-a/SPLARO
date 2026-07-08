import type { CSSProperties } from 'react'

export function productMediaTransitionName(productId: string) {
  return `product-media-${productId}`
}

export function supportsViewTransitions() {
  return typeof document !== 'undefined' && 'startViewTransition' in document
}

export function startViewTransition(callback: () => void | Promise<void>) {
  if (!supportsViewTransitions()) {
    void callback()
    return
  }
  document.startViewTransition(callback)
}

/** Shared element name for card → PDP image morph (no-op when reduced motion). */
export function productMediaTransitionStyle(
  productId: string,
  reducedMotion?: boolean | null,
): CSSProperties | undefined {
  if (reducedMotion) return undefined
  return { viewTransitionName: productMediaTransitionName(productId) }
}
