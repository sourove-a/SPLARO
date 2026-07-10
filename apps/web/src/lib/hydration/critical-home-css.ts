/** Inline fallback so marquee/hero never collapse when a stale CSS chunk 404s. */
export const CRITICAL_HOME_CSS = `
.home-flow-strip{overflow:hidden;margin:0 auto 1rem;max-width:min(1180px,calc(100% - 1.5rem));border-radius:999px}
.home-flow-strip__viewport{overflow:hidden;padding:.78rem 0}
.home-flow-strip__track{display:flex;width:max-content;align-items:center;flex-wrap:nowrap}
.home-flow-strip__item{display:inline-flex;align-items:center;gap:.65rem;padding:0 1.35rem;flex-shrink:0;white-space:nowrap}
.home-flow-strip__text{white-space:nowrap;font-size:.68rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.home-hero-slider{position:relative;overflow:hidden;min-height:clamp(420px,72vh,760px)}
.home-hero-slider .hero-slide{position:absolute;inset:0}
.home-hero-slider .hero-bg-image,.home-hero-slider .hero-bg-video{width:100%;height:100%;object-fit:cover}
`
