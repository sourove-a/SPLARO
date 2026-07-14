/** Footer Earth — locked to the provided reference image (1024×438). */
export const FOOTER_EARTH_TEXTURE_WEBP = '/images/footer/earth.webp'
export const FOOTER_EARTH_TEXTURE_PNG = '/images/footer/earth.png'
export const FOOTER_EARTH_IMAGE_ASPECT = 3200 / 1369

/** Full 360° spin — luxury-slow, almost imperceptible. */
export const FOOTER_EARTH_ROTATION_SECONDS = 600

/** CSS variable parity — do not change without updating earth-backdrop.css. */
export const FOOTER_EARTH_DISC_SIZE_VW = {
  desktop: 220,
  tablet: 260,
  phone: 320,
} as const

export const FOOTER_EARTH_DISC_RISE = {
  desktop: 0.18,
  phone: 0.16,
} as const
