/** CSS earth globe for footer — visible while WebGL loads or when GPU/WebGL unavailable. */
export function FooterEarthCssFallback({
  flow = true,
  hidden = false,
}: {
  flow?: boolean
  hidden?: boolean
}) {
  return (
    <div
      className={`site-footer__earth-fallback${hidden ? ' site-footer__earth-fallback--hidden' : ''}`}
      aria-hidden
    >
      <div className="site-footer__earth-fallback-bg" />
      <div className="site-footer__earth-fallback-globe">
        <div
          className={`site-footer__earth-fallback-map${flow ? '' : ' site-footer__earth-fallback-map--static'}`}
        />
        <div className="site-footer__earth-fallback-shade" />
        <div className="site-footer__earth-fallback-highlight" />
        <div className="site-footer__earth-fallback-atmo" />
      </div>
      <div className="site-footer__earth-fallback-glow" />
    </div>
  )
}
