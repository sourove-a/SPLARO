/**
 * Tidy a stored meta description before it goes in a `<meta>` tag.
 *
 * Copy written to a "155 characters max" brief comes back already cut, and the
 * cut lands mid-word: one product shipped `… everyday luxury. Premium premiu…`
 * as its Google snippet. Visible product copy is left alone — this is only for
 * the head, so nothing on the page changes shape.
 */
const MAX_META_DESCRIPTION = 160
/** Keep a cut-back sentence only if what remains still reads as a description. */
const MIN_USEFUL_LENGTH = 60

function endsTruncated(text: string): boolean {
  return /(…|\.\.\.)$/.test(text)
}

function dropTrailingPartialWord(text: string): string {
  const lastSpace = text.lastIndexOf(' ')
  if (lastSpace < MIN_USEFUL_LENGTH) return text
  return text.slice(0, lastSpace).trimEnd()
}

function cutToLastSentence(text: string): string | null {
  const match = text.match(/^[\s\S]*[.!?](?=[^.!?]*$)/)
  const upToSentence = match?.[0]?.trim()
  if (!upToSentence || upToSentence.length < MIN_USEFUL_LENGTH) return null
  return upToSentence
}

function clampOnWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text
  return dropTrailingPartialWord(text.slice(0, max)).replace(/[,;:\-–—]+$/, '')
}

export function tidyMetaDescription(
  raw: string | null | undefined,
  max = MAX_META_DESCRIPTION,
): string {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  let out = text
  if (endsTruncated(out)) {
    out = out.replace(/(…|\.\.\.)$/, '').trimEnd()
    // The ellipsis is the only reliable signal that the tail is incomplete, so
    // only then is it safe to fall back to the last finished sentence.
    out = cutToLastSentence(out) ?? dropTrailingPartialWord(out)
  }

  return clampOnWordBoundary(out, max).trim()
}
