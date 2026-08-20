/** Customer-facing size label — correct known catalog typos. */
export function displaySizeLabel(size: string | null | undefined): string {
  const raw = (size ?? '').trim()
  if (!raw) return ''
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (compact === 'freesie') return 'free size'
  return raw
}

/** Persist the display label, or null when empty. */
export function normalizeStoredSize(size: string | null | undefined): string | null {
  return displaySizeLabel(size) || null
}
