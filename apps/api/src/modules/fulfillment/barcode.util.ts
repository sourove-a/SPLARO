import * as bwipjs from 'bwip-js'

/** Escape text for safe embedding inside HTML attribute / body. */
export function escapeLabelHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Code128 barcode as inline SVG (no native canvas).
 * Returns empty string if generation fails — labels still print text.
 */
export function code128Svg(
  text: string,
  opts?: { height?: number; scale?: number; includetext?: boolean },
): string {
  const raw = text?.trim()
  if (!raw) return ''
  try {
    return bwipjs.toSVG({
      bcid: 'code128',
      text: raw,
      scale: opts?.scale ?? 2,
      height: opts?.height ?? 10,
      includetext: opts?.includetext ?? true,
      textxalign: 'center',
    })
  } catch {
    return ''
  }
}

/** Wrap SVG in a sized container for label CSS. */
export function barcodeBlock(text: string, className = 'barcode', height = 10): string {
  const svg = code128Svg(text, { height, scale: 2, includetext: true })
  if (!svg) {
    return `<div class="${className} ${className}--fallback"><code>${escapeLabelHtml(text)}</code></div>`
  }
  return `<div class="${className}">${svg}</div>`
}
