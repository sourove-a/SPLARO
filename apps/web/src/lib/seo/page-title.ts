/**
 * Normalize a page title segment before the root layout template appends `| SPLARO`.
 * Strips redundant brand suffixes from CMS/API values (e.g. "Shop — SPLARO").
 */
export function pageTitleSegment(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  return raw
    .trim()
    .replace(/\s*[|—–-]\s*SPLARO(\s+Bangladesh)?\s*$/i, '')
    .trim()
}
