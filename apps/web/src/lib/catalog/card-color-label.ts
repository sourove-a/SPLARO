import { pluralize } from '@/lib/utils/pluralize'

export type CardColorOption = {
  name?: string | null
  hex?: string | null
}

/** Shop card color line: one named color → "Pink"; two+ → "2 colors"; none → hide. */
export function cardColorLabel(
  colorOptions?: CardColorOption[] | null,
  hexes?: Array<string | null | undefined> | null,
): string | null {
  const names = uniqueTrimmed(colorOptions?.map((option) => option.name) ?? [])
  const fromOptions = colorOptions?.map((option) => option.hex) ?? []
  const uniqueHex = uniqueTrimmed([...(hexes ?? []), ...fromOptions], true)
  const count = Math.max(names.length, uniqueHex.length)
  if (count <= 0) return null
  if (count === 1 && names[0]) return names[0]
  return pluralize(count, 'color')
}

function uniqueTrimmed(values: Array<string | null | undefined>, caseInsensitive = false): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = caseInsensitive ? trimmed.toLowerCase() : trimmed
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}
