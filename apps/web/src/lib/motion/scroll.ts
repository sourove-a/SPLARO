/** Scroll profile helpers — native document scroll only (Lenis removed). */

export type ScrollProfile = 'mac' | 'windows' | 'mobile'

function getScrollMedia() {
  if (typeof window === 'undefined') return null
  return {
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)'),
    coarse: window.matchMedia('(pointer: coarse)'),
    mobileLayout: window.matchMedia('(max-width: 1023px)'),
  }
}

export function isPrivateNetworkHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return false
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}

export function isTouchScrollProfile() {
  return detectScrollProfile() === 'mobile'
}

/** Runtime profile — boot script sets data-scroll-profile; JS refines on resize. */
export function detectScrollProfile(): ScrollProfile {
  if (typeof window === 'undefined') return 'mac'

  const mq = getScrollMedia()
  if (mq && (mq.coarse.matches || mq.mobileLayout.matches)) return 'mobile'

  const attr = document.documentElement.getAttribute('data-scroll-profile')
  if (attr === 'windows') return 'windows'
  if (attr === 'mobile') return 'mobile'
  if (attr === 'mac') return 'mac'

  const os = document.documentElement.getAttribute('data-os')
  if (os === 'windows') return 'windows'

  return 'mac'
}

export function applyScrollProfileAttributes(profile: ScrollProfile) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-scroll-profile', profile)
}

export function subscribeScrollProfile(onChange: (profile: ScrollProfile) => void) {
  if (typeof window === 'undefined') {
    onChange('mac')
    return () => {}
  }

  const update = () => {
    const profile = detectScrollProfile()
    applyScrollProfileAttributes(profile)
    onChange(profile)
  }

  update()

  const mq = getScrollMedia()
  const onMedia = () => update()
  mq?.coarse.addEventListener('change', onMedia)
  mq?.mobileLayout.addEventListener('change', onMedia)
  window.addEventListener('resize', onMedia, { passive: true })
  window.addEventListener('orientationchange', onMedia)

  return () => {
    mq?.coarse.removeEventListener('change', onMedia)
    mq?.mobileLayout.removeEventListener('change', onMedia)
    window.removeEventListener('resize', onMedia)
    window.removeEventListener('orientationchange', onMedia)
  }
}
