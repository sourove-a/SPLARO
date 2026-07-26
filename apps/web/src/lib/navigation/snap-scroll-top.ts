/** Instant document scroll snap — no smooth behavior (CLS / jump-safe). */
export function snapDocumentScrollToTop() {
  if (typeof window === 'undefined') return

  const root = document.scrollingElement ?? document.documentElement
  root.scrollTop = 0
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

  // Lenis owns visual scroll on Mac/Linux fine desktop — native scrollTop alone
  // leaves the viewport mid-page after overlay unlock / client navigation.
  const lenis = (
    window as Window & {
      __SPLARO_LENIS?: { scrollTo: (v: number, o?: { immediate?: boolean }) => void }
    }
  ).__SPLARO_LENIS
  if (lenis?.scrollTo) {
    lenis.scrollTo(0, { immediate: true })
  }

  document.documentElement.setAttribute('data-scroll-lock-y', '0')
}
