/**
 * Header chrome is driven imperatively (class toggles + `<html>` attributes) so
 * crossing the hero does not re-render Navigation. That only works while the
 * lookups reach the header the shopper can see.
 *
 * A Suspense boundary that re-suspends keeps the previous tree mounted but
 * hidden (`display: none`) instead of deleting it, so the document can hold a
 * complete second copy of the topbar, header, main and footer. `querySelector`
 * returns the first match in document order — the dead copy — and every class
 * toggle lands on markup nobody renders, while the `<html>` attributes still
 * apply to the live header. That mismatch is what makes the bar jump.
 *
 * Resolve against the visible copy instead.
 */
export function liveChromeElement<T extends Element>(selector: string): T | null {
  if (typeof document === 'undefined') return null

  const nodes = document.querySelectorAll<T>(selector)
  if (nodes.length === 0) return null
  if (nodes.length === 1) return nodes[0] ?? null

  // Later copies are the newer mounts, so search from the end.
  // `getClientRects()` is empty for `display: none` and, unlike `offsetParent`,
  // still reports boxes for `position: fixed` chrome.
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]
    if (node && node.getClientRects().length > 0) return node
  }

  return nodes[nodes.length - 1] ?? null
}

export function liveHeaderChrome(): HTMLElement | null {
  return liveChromeElement<HTMLElement>('[data-header-chrome]')
}

export function liveTopBar(): HTMLElement | null {
  return liveChromeElement<HTMLElement>('[data-top-bar]')
}

export function liveHomeHero(): HTMLElement | null {
  return liveChromeElement<HTMLElement>('.home-hero-slider')
}
