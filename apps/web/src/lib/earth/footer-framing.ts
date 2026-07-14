import { isPhoneViewport } from '@/lib/earth/globe-performance'

/** Full 360° Y spin — shared by CSS animation + WebGL RAF. */
export const FOOTER_EARTH_SPIN_SECONDS = 72
export const FOOTER_EARTH_ROTATION_SPEED_Y = (2 * Math.PI) / FOOTER_EARTH_SPIN_SECONDS

/** Reference anchor from tuned desktop footer (do not use as hardcoded output). */
const REF = {
  width: 1440,
  height: 680,
  groupScale: 3.95,
  groupY: -0.48,
  cameraY: 0.22,
  cameraZ: 1.62,
  lookAtY: -0.22,
  fov: 34,
  tiltX: -0.38,
  tiltDeg: 16,
  /** Full round globe — diameter as fraction of stage height / width (whichever is tighter). */
  heightFill: 0.9,
  widthFill: 0.9,
  heightFillPhone: 0.72,
  widthFillPhone: 0.94,
  /** Gap below the globe as fraction of stage height. */
  bottomGap: 0.05,
} as const

export type FooterEarthLayout = {
  diameterPx: number
  topPx: number
  /** Screen-space y (px from stage top) where the earth apex should sit. */
  apexPx: number
  stageHeight: number
  tiltDeg: number
  groupScale: number
  groupY: number
  cameraZ: number
  cameraY: number
  lookAtY: number
  fov: number
  tiltX: number
  compact: boolean
  phone: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Container-driven footer earth layout — one source for CSS vars + WebGL framing.
 * Target: full round globe, fully visible, resting near the bottom of the stage.
 */
export function computeFooterEarthLayout(width: number, height: number): FooterEarthLayout {
  const safeW = Math.max(width, 1)
  const safeH = Math.max(height, 1)
  const compact = safeW < 1024
  const phone = isPhoneViewport(safeW)

  const heightFill = phone ? REF.heightFillPhone : REF.heightFill
  const widthFill = phone ? REF.widthFillPhone : REF.widthFill
  const diameterPx = Math.min(safeH * heightFill, safeW * widthFill)

  // Globe sits low: fixed gap below, rest of the space above becomes starfield.
  const apexPx = safeH - diameterPx - safeH * REF.bottomGap
  const topPx = apexPx
  const tiltDeg = phone ? 14 : 16

  // Rough seed for the WebGL binary searches (they refine from here):
  // world height visible at z=0 for this camera, mapped to the target pixel diameter.
  const visibleWorldH = 2 * Math.tan(((REF.fov / 2) * Math.PI) / 180) * REF.cameraZ
  const groupScale = clamp((diameterPx / safeH) * (visibleWorldH / 2), 0.1, 12)

  const groupY = compact ? -0.44 : REF.groupY
  const cameraZ = compact ? 1.55 : REF.cameraZ
  const cameraY = compact ? 0.26 : REF.cameraY

  return {
    diameterPx,
    topPx,
    apexPx,
    stageHeight: safeH,
    tiltDeg,
    groupScale,
    groupY,
    cameraZ,
    cameraY,
    lookAtY: REF.lookAtY,
    fov: REF.fov,
    tiltX: REF.tiltX,
    compact,
    phone,
  }
}

/** Binary-search groupScale so projected sphere span matches target width (WebGL resize only). */
export function searchFooterEarthGroupScale(
  layout: FooterEarthLayout,
  width: number,
  measureSpan: (scale: number) => number,
  targetFill?: number,
): number {
  // Default: projected span matches the CSS diameter — big flat horizon, edges off-screen.
  const target = width * (targetFill ?? layout.diameterPx / Math.max(width, 1))
  let lo = layout.groupScale * 0.55
  let hi = layout.groupScale * 5
  let best = layout.groupScale

  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    const span = measureSpan(mid)
    if (span >= target) {
      best = mid
      hi = mid
    } else {
      lo = mid
    }
  }

  return best
}

/** Binary-search groupY so the projected sphere apex lands at layout.apexPx (WebGL resize only). */
export function searchFooterEarthGroupY(
  layout: FooterEarthLayout,
  measureApexY: (groupY: number) => number,
  /** Final group scale — bigger sphere needs a wider vertical search window. */
  scale = layout.groupScale,
): number {
  const target = layout.apexPx
  let lo = layout.groupY - scale * 2 - 1
  let hi = layout.groupY + scale * 2 + 1
  let best = layout.groupY

  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2
    const apexY = measureApexY(mid)
    best = mid
    // Screen y grows downward: apex above target → push earth lower (smaller groupY).
    if (apexY < target) {
      hi = mid
    } else {
      lo = mid
    }
  }

  return best
}

export function footerEarthLayoutToCssVars(layout: FooterEarthLayout): Record<string, string> {
  return {
    '--footer-earth-diameter': `${layout.diameterPx}px`,
    '--footer-earth-top': `${layout.topPx}px`,
    '--footer-earth-tilt': `${layout.tiltDeg}deg`,
    '--footer-earth-spin': `${FOOTER_EARTH_SPIN_SECONDS}s`,
  }
}
