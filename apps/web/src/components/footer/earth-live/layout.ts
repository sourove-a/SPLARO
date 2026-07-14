import {
  FOOTER_EARTH_DISC_RISE,
  FOOTER_EARTH_DISC_SIZE_VW,
} from '@/components/footer/earth-live/constants'

export type EarthDiscLayout = {
  discSize: number
  discRadius: number
  /** Screen-space Y (orthographic, origin at stage center). */
  discCenterY: number
  rise: number
}

function discSizeVw(viewportWidth: number): number {
  if (viewportWidth <= 767) return FOOTER_EARTH_DISC_SIZE_VW.phone
  if (viewportWidth < 1280) return FOOTER_EARTH_DISC_SIZE_VW.tablet
  return FOOTER_EARTH_DISC_SIZE_VW.desktop
}

/**
 * Mirrors `.earth-backdrop__disc-anchor` — bottom-anchored, identical to CSS.
 * translateY(100% - rise) pushes the disc down so only the top `rise` arc is visible.
 * Disc center sits below the footer bottom by (0.5 - rise) × diameter.
 */
export function computeEarthDiscLayout(
  viewportWidth: number,
  stageHeight: number,
): EarthDiscLayout {
  const vw = Math.max(viewportWidth, 1)
  const height = Math.max(stageHeight, 1)
  const rise = vw <= 767 ? FOOTER_EARTH_DISC_RISE.phone : FOOTER_EARTH_DISC_RISE.desktop
  const discSize = (discSizeVw(vw) / 100) * vw
  const discCenterBelowBottom = discSize * (0.5 - rise)
  const discCenterY = -height / 2 - discCenterBelowBottom

  return {
    discSize,
    discRadius: discSize / 2,
    discCenterY,
    rise,
  }
}
