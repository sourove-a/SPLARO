/** Fashion colour names for auto-fill from hex / EyeDropper. */

export type NamedColour = { name: string; hex: string }

export const FASHION_COLOURS: NamedColour[] = [
  { name: 'Black', hex: '#0a0a0a' },
  { name: 'Charcoal', hex: '#36454f' },
  { name: 'Navy', hex: '#1b2a4a' },
  { name: 'Midnight Blue', hex: '#191970' },
  { name: 'Royal Blue', hex: '#4169e1' },
  { name: 'Sky Blue', hex: '#87ceeb' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Emerald', hex: '#50c878' },
  { name: 'Olive', hex: '#808000' },
  { name: 'Forest Green', hex: '#228b22' },
  { name: 'Mint', hex: '#98ff98' },
  { name: 'Ivory', hex: '#fffff0' },
  { name: 'Cream', hex: '#fffdd0' },
  { name: 'Beige', hex: '#f5f5dc' },
  { name: 'Sand', hex: '#c2b280' },
  { name: 'Khaki', hex: '#c3b091' },
  { name: 'Camel', hex: '#c19a6b' },
  { name: 'Brown', hex: '#8b4513' },
  { name: 'Chocolate', hex: '#7b3f00' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Wine', hex: '#722f37' },
  { name: 'Red', hex: '#c41e3a' },
  { name: 'Coral', hex: '#ff7f50' },
  { name: 'Orange', hex: '#ff8c00' },
  { name: 'Mustard', hex: '#ffdb58' },
  { name: 'Gold', hex: '#d4af37' },
  { name: 'Yellow', hex: '#ffd700' },
  { name: 'Pink', hex: '#ffc0cb' },
  { name: 'Blush', hex: '#de5d83' },
  { name: 'Rose', hex: '#ff007f' },
  { name: 'Lavender', hex: '#e6e6fa' },
  { name: 'Purple', hex: '#6b3fa0' },
  { name: 'Lilac', hex: '#c8a2c8' },
  { name: 'Grey', hex: '#808080' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Off White', hex: '#f8f8f0' },
]

export const DEFAULT_COLOUR_HEX = '#1a1a1a'

/**
 * Canonical product swatch hex: `#rrggbb` lowercase.
 * Accepts `#rgb`, `#rrggbb`, `#rrggbbaa` (alpha dropped), with or without `#`.
 * Rejects CSS vars and incomplete/garbage values.
 */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/\s+/g, '')
  if (!raw || raw.startsWith('var(')) return null
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  const eight = /^#([0-9a-f]{8})$/i.exec(withHash)
  if (eight?.[1]) return `#${eight[1].slice(0, 6).toLowerCase()}`
  const short = /^#([0-9a-f]{3})$/i.exec(withHash)
  if (short?.[1]) {
    const [r, g, b] = short[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^#[0-9a-f]{6}$/i.test(withHash)) return withHash.toLowerCase()
  return null
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== null
}

/**
 * Keep the hex text field editable while typing — only `#` + hex digits, max 7 chars.
 * Does not expand `#rgb` mid-keystroke (that happens on blur / when complete).
 */
export function sanitizeHexTyping(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/^#/, '').replace(/[^0-9a-fA-F]/gi, '')
  return `#${digits.slice(0, 6)}`
}

/** `<input type="color">` and swatch backgrounds — always a valid `#rrggbb`. */
export function colourInputValue(hex: string): string {
  return normalizeHex(hex) ?? DEFAULT_COLOUR_HEX
}

/** Alias for swatch / preview CSS backgrounds. */
export function swatchCss(hex: string): string {
  return colourInputValue(hex)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex)
  if (!n) return null
  return {
    r: Number.parseInt(n.slice(1, 3), 16),
    g: Number.parseInt(n.slice(3, 5), 16),
    b: Number.parseInt(n.slice(5, 7), 16),
  }
}

/** Nearest named fashion colour for auto-fill. */
export function nearestColourName(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return 'Custom'
  let best = FASHION_COLOURS[0]!
  let bestDist = Number.POSITIVE_INFINITY
  for (const c of FASHION_COLOURS) {
    const t = hexToRgb(c.hex)
    if (!t) continue
    const d = (rgb.r - t.r) ** 2 + (rgb.g - t.g) ** 2 + (rgb.b - t.b) ** 2
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best.name
}

type EyeDropperResult = { sRGBHex: string }

/** Browser EyeDropper — pick colour from anywhere on screen (product photo, etc.). */
export async function pickColourWithEyeDropper(): Promise<{ hex: string; name: string } | null> {
  if (typeof window === 'undefined') return null
  const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<EyeDropperResult> } })
    .EyeDropper
  if (!EyeDropperCtor) return null
  try {
    const result = await new EyeDropperCtor().open()
    const hex = normalizeHex(result.sRGBHex) ?? DEFAULT_COLOUR_HEX
    return { hex, name: nearestColourName(hex) }
  } catch {
    // User cancelled
    return null
  }
}

export function eyeDropperSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as unknown as { EyeDropper?: unknown }).EyeDropper)
}
