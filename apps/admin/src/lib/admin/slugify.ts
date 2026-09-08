/**
 * Converts text into a clean URL-friendly slug.
 * e.g. "Onitsuka Tipor" -> "onitsuka-tipor"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
