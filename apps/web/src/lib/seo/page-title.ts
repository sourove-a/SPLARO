/**
 * Normalize a page title segment before the root layout template appends `| SPLARO`.
 * Strips redundant brand suffixes from CMS/API values (e.g. "Shop — SPLARO").
 *
 * The suffix is also matched when it was cut off mid-word. Stored meta titles
 * get truncated to a length budget, which left values ending in `| SPLAR`;
 * those did not match a whole-brand pattern, so the template appended a second
 * brand and shipped `… | SPLAR | SPLARO` as the page title.
 */
// Truncated forms start at `SPL` on purpose: stripping a bare `| S` would eat
// legitimate endings such as a size in "Tees — S".
const BRAND_SUFFIX = /\s*[|—–-]\s*SPL(?:A(?:R(?:O)?)?)?(?:\s+Bangladesh)?\s*$/i

export function pageTitleSegment(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  return raw.trim().replace(BRAND_SUFFIX, '').trim()
}
