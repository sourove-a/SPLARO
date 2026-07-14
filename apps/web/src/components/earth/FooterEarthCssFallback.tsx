/**
 * Cinematic footer earth — CSS-only background (designmonks-style horizon).
 * Day + night + clouds scroll inside one spin layer for smooth 360° + GPU savings.
 */
export function FooterEarthCssFallback({
  flow = true,
  hidden = false,
  layout = 'horizon',
}: {
  flow?: boolean
  hidden?: boolean
  /** full = entire footer stage; horizon = bottom arc; centered = auth */
  layout?: 'full' | 'horizon' | 'centered'
}) {
  const spinClass = flow
    ? 'site-footer__earth-fallback-spin'
    : 'site-footer__earth-fallback-spin site-footer__earth-fallback-spin--static'
  const cloudSpinClass = flow
    ? 'site-footer__earth-fallback-spin site-footer__earth-fallback-cloud-spin'
    : 'site-footer__earth-fallback-spin site-footer__earth-fallback-spin--static'

  const globe = (
    <div className="site-footer__earth-fallback-globe">
      <div className={spinClass}>
        <div className="site-footer__earth-fallback-map site-footer__earth-fallback-map--day" />
        <div className="site-footer__earth-fallback-map site-footer__earth-fallback-map--night" />
      </div>
      <div className={cloudSpinClass}>
        <div className="site-footer__earth-fallback-clouds" />
      </div>
      <div className="site-footer__earth-fallback-terminator" />
      <div className="site-footer__earth-fallback-curve" />
      <div className="site-footer__earth-fallback-shade" />
      <div className="site-footer__earth-fallback-highlight" />
      <div className="site-footer__earth-fallback-atmo" />
      <div className="site-footer__earth-fallback-limb" />
    </div>
  )

  return (
    <div
      className={`site-footer__earth-fallback${hidden ? ' site-footer__earth-fallback--hidden' : ''}`}
      data-earth-layout={layout}
      aria-hidden
    >
      <div className="site-footer__earth-fallback-bg" />
      {layout === 'horizon' ? (
        <div className="site-footer__earth-fallback-horizon">{globe}</div>
      ) : (
        globe
      )}
      {layout === 'horizon' || layout === 'full' ? (
        <div className="site-footer__earth-fallback-vignette" aria-hidden />
      ) : null}
      <div className="site-footer__earth-fallback-glow" />
    </div>
  )
}
