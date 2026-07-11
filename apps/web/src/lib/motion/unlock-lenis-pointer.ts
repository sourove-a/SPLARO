/** Clear stuck Lenis / overlay pointer locks (Windows dead-click guard). */
export function unlockLenisPointer(): void {
  if (typeof document === 'undefined') return

  const { body, documentElement: html } = document

  if (body.style.pointerEvents === 'none') {
    body.style.pointerEvents = ''
  }
  if (html.style.pointerEvents === 'none') {
    html.style.pointerEvents = ''
  }
}
