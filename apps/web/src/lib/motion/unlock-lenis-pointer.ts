/** Clear stuck Lenis / overlay pointer locks (Windows dead-click guard). */
export function unlockLenisPointer(): void {
  if (typeof document === 'undefined') return

  const { body, documentElement: html } = document
  const lenisActive =
    html.classList.contains('lenis') ||
    html.getAttribute('data-scroll-engine') === 'lenis'
  const overlayLocked = html.getAttribute('data-scroll-lock') === 'overlay'

  if (body.style.pointerEvents === 'none') {
    body.style.pointerEvents = ''
  }
  if (html.style.pointerEvents === 'none') {
    html.style.pointerEvents = ''
  }

  // Never clear overflow while Search/Cart/SizeGuide holds scroll-lock —
  // GlobalPointerSafety runs on every pointerdown and would unlock the page under the modal.
  if (overlayLocked) return

  if (!lenisActive) {
    if (html.style.overflowY === 'hidden') html.style.overflowY = ''
    if (body.style.overflowY === 'hidden') body.style.overflowY = ''
    if (html.style.height === '100%') html.style.height = ''
    if (body.style.height === '100%') body.style.height = ''
  }
}
