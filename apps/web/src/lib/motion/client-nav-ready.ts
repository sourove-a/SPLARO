'use client'

/**
 * Client-navigation marker — set on internal link click BEFORE the route changes.
 * Hard refresh never sets this, so enter animations stay off (no opacity:0 flash).
 */
let clientNavigationReady = false
const listeners = new Set<() => void>()

export function markClientNavigationReady() {
  if (clientNavigationReady) {
    listeners.forEach((listener) => listener())
    return
  }
  clientNavigationReady = true
  listeners.forEach((listener) => listener())
}

export function isClientNavigationReady() {
  return clientNavigationReady
}

export function subscribeClientNavigationReady(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}
