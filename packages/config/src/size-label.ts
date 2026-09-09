/** Customer-facing size label — correct known catalog typos and normalize kids runs. */
export function displaySizeLabel(size: string | null | undefined): string {
  const raw = (size ?? '').trim()
  if (!raw) return ''
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (compact === 'freesie') return 'free size'

  // Normalize slash notation in kids sizes (e.g. "2/3" or "2/3Y" -> "2-3Y")
  const slashMatch = raw.match(/^(\d+)\/(\d+)\s*y?$/i)
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}Y`
  }

  // Normalize lowercase year suffix (e.g. "2-3y" -> "2-3Y", "4y" -> "4Y")
  const yearMatch = raw.match(/^(\d+(?:-\d+)?)\s*y$/i)
  if (yearMatch) {
    return `${yearMatch[1]}Y`
  }

  // Normalize lowercase month suffix (e.g. "0-3m" -> "0-3M")
  const monthMatch = raw.match(/^(\d+-\d+)\s*m$/i)
  if (monthMatch) {
    return `${monthMatch[1]}M`
  }

  return raw
}

/** Persist the display label, or null when empty. */
export function normalizeStoredSize(size: string | null | undefined): string | null {
  return displaySizeLabel(size) || null
}
