/**
 * Home desktop keeps the nav bar below the utility topbar (`top: var(--topbar-height)`).
 * Client navigation to PDP used to animate the topbar away while the header jumped
 * to `top: 0` — read as the header sliding up. Snap both instantly before paint.
 */
export function snapHeaderChromeLeavingHome() {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const header = document.querySelector<HTMLElement>('[data-header-chrome]')
  const topbar = document.querySelector<HTMLElement>('[data-top-bar]')

  root.setAttribute('data-topbar', 'hidden')
  root.removeAttribute('data-home-hero')
  root.setAttribute('data-chrome-snap', '1')

  header?.classList.add('site-header-glass--topbar-collapsed')
  header?.classList.remove('site-header-glass--over-hero')
  header?.classList.remove('site-header-glass--hero-copy-under')
  header?.classList.remove('site-header-glass--scrolled')

  topbar?.classList.add('site-topbar--hidden')

  requestAnimationFrame(() => {
    root.removeAttribute('data-chrome-snap')
  })
}
