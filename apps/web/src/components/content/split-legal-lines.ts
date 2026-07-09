/** Split legal paragraph copy into readable animated lines (sentence boundaries). */
export function splitLegalLines(body: string): string[] {
  const normalized = body.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[\u005BA-Z"“(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  return sentences.length > 0 ? sentences : [normalized]
}
