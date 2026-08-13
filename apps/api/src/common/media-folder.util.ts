import { BadRequestException } from '@nestjs/common'

/**
 * Library folders are free text the store types, so the rule that turns a typed
 * name into a stored key lives here rather than in each service. Two copies of
 * this rule is how the media list and the media writer end up disagreeing about
 * whether a folder exists.
 */

/** Buckets every store starts with. Suggestions for the picker, not a whitelist. */
export const BUILT_IN_MEDIA_FOLDERS = [
  'media',
  'men',
  'women',
  'kids',
  'footwear',
  'accessories',
] as const

/**
 * The five buckets that also have a product upload directory on disk
 * (`/uploads/products-<dept>/`). A folder the store invents is a library label
 * only — it has no matching directory.
 */
export const MEDIA_DEPT_FOLDERS = ['men', 'women', 'kids', 'footwear', 'accessories'] as const

/** `all` is the list endpoints' "no filter" sentinel, so it can never be a folder. */
const RESERVED_MEDIA_FOLDERS = new Set(['all'])

export function isMediaDeptFolder(folder: string): boolean {
  return (MEDIA_DEPT_FOLDERS as readonly string[]).includes(folder)
}

/**
 * Slugify a typed folder name into its stored key.
 *
 * Letters, digits and combining marks in any script survive: the admin writes
 * folder names in Bangla as often as English, so an ASCII-only rule would empty
 * them, and dropping marks (`\p{M}`) would strip the kars out of "পুরুষ".
 * Returns `fallback` when nothing usable is left.
 */
export function normalizeMediaFolder(value: unknown, fallback = 'media'): string {
  const slug = String(value ?? '')
    .trim()
    .slice(0, 40)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}\p{M}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) return fallback
  if (RESERVED_MEDIA_FOLDERS.has(slug)) {
    throw new BadRequestException(`"${slug}" is a reserved folder name`)
  }
  return slug
}

/**
 * Resolve a folder filter coming off a query string. `all` and an absent value
 * both mean "no filter", which callers see as an empty string.
 */
export function resolveMediaFolderFilter(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw || raw === 'all') return ''
  return normalizeMediaFolder(raw)
}
