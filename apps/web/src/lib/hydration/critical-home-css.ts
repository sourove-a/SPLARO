/** Inline fallback so marquee/hero never collapse when a stale CSS chunk 404s.
 *  Also paints html/body immediately — stops the hard-reload white flash before CSS.
 *  Home topbar: dark from first paint (before React sets data-home-hero). */
export const CRITICAL_HOME_CSS = `
html,body{background:#fff;color:#111;scroll-behavior:auto!important}
.home-flow-strip{overflow:hidden;margin:0 auto 1rem;max-width:min(1180px,calc(100% - 1.5rem));border-radius:999px}
.home-flow-strip__viewport{overflow:hidden;padding:.78rem 0}
.home-flow-strip__track{display:flex;width:max-content;align-items:center;flex-wrap:nowrap;animation:home-flow-marquee 42s linear infinite}
.home-flow-strip__item{display:inline-flex;align-items:center;gap:.65rem;padding:0 1.35rem;flex-shrink:0;white-space:nowrap}
.home-flow-strip__text{white-space:nowrap;font-size:.68rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
@keyframes home-flow-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.home-hero-slider{position:relative;overflow:hidden;background:#111}
@media (min-width:1024px){.home-hero-slider{min-height:clamp(420px,72vh,760px)}}
@media (max-width:1023px){.home-hero-slider{min-height:0;margin:.55rem .7rem .75rem;border-radius:.95rem}}
.home-hero-slider .hero-slide{position:absolute;inset:0}
.home-hero-slider .hero-bg-image,.home-hero-slider .hero-bg-video{width:100%;height:100%;object-fit:cover}
@media (min-width:1024px){
html:not([data-home-hero=scrolled]):has(.home-hero-slider) .site-topbar{
background:rgba(12,12,14,.88)!important;border-bottom:1px solid rgba(255,255,255,.1)!important;box-shadow:none!important
}
html:not([data-home-hero=scrolled]):has(.home-hero-slider) .site-topbar__inner,
html:not([data-home-hero=scrolled]):has(.home-hero-slider) .site-topbar__label,
html:not([data-home-hero=scrolled]):has(.home-hero-slider) .site-topbar__link,
html:not([data-home-hero=scrolled]):has(.home-hero-slider) .site-topbar__icon-only{
color:rgba(255,255,255,.78)!important
}
html:not([data-home-hero=scrolled]):has(.home-hero-slider) .site-topbar__divider{
background:rgba(255,255,255,.18)!important
}
}
`
