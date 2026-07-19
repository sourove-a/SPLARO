/** Instant document scroll snap — no smooth behavior (CLS / jump-safe). */
export function snapDocumentScrollToTop() {
  if (typeof window === 'undefined') return

  const root = document.scrollingElement ?? document.documentElement
  root.scrollTop = 0
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}
