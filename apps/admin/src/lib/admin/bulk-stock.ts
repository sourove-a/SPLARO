/**
 * Bulk stock paste for the create-variant matrix.
 *
 * Stock arrives from a supplier as "S 10, M 20, L 15" in a message or a sheet
 * cell. Typing it back one stepper at a time is where a 5-size × 3-colour run
 * costs real minutes — and where transposed numbers creep in.
 *
 * The parser never writes anything by itself: it returns what it understood so
 * the form can show a preview and let the operator confirm.
 */

export interface BulkStockEntry {
  size: string
  qty: number
  /** Size text as typed, kept so the preview can show an unmatched token. */
  raw: string
  matched: boolean
}

export interface BulkStockParse {
  entries: BulkStockEntry[]
  /** Tokens that carried no readable quantity. */
  ignored: string[]
  /** True when quantities were read positionally against the size run. */
  positional: boolean
}

function normalizeSize(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * Accepts `S 10`, `S=10`, `S:10`, `S-10`, `S/10`, `S x10`, one per line or
 * comma separated. A list of bare numbers maps onto the size run in order.
 */
export function parseBulkStock(input: string, sizeList: string[]): BulkStockParse {
  const tokens = input
    .split(/[,\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  if (tokens.length === 0) return { entries: [], ignored: [], positional: false }

  const bareNumbers = tokens.every((t) => /^\d+$/.test(t))
  if (bareNumbers) {
    const entries: BulkStockEntry[] = []
    const ignored: string[] = []
    tokens.forEach((t, index) => {
      const size = sizeList[index]
      if (size === undefined) {
        ignored.push(t)
        return
      }
      entries.push({ size, qty: Number(t), raw: t, matched: true })
    })
    return { entries, ignored, positional: true }
  }

  const bySize = new Map(sizeList.map((s) => [normalizeSize(s), s]))
  const entries: BulkStockEntry[] = []
  const ignored: string[] = []

  for (const token of tokens) {
    const match = /^(.*?)[\s:=/-]*x?\s*(\d+)$/i.exec(token)
    if (!match || !match[1]?.trim()) {
      ignored.push(token)
      continue
    }
    const rawSize = match[1].trim()
    const qty = Number(match[2])
    const size = bySize.get(normalizeSize(rawSize))
    entries.push({
      size: size ?? rawSize,
      qty,
      raw: token,
      matched: Boolean(size),
    })
  }

  return { entries, ignored, positional: false }
}

/** Clamped the same way the matrix clamps a typed quantity. */
export function clampStock(qty: number): number {
  if (!Number.isFinite(qty)) return 0
  return Math.max(0, Math.min(999999, Math.round(qty)))
}
