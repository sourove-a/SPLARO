/**
 * Normalizes an address token for deduplication comparison (lowercase, trimmed, strip excess punctuation).
 */
export function normalizeAddressToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[.,|;/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Splits a raw address or combination of address fields into clean, non-empty chunks.
 */
export function splitAddressTokens(...inputs: (string | null | undefined)[]): string[] {
  const result: string[] = []
  for (const input of inputs) {
    if (!input || typeof input !== 'string') continue
    const parts = input.split(/[,|\n\r;]+/)
    for (const part of parts) {
      const trimmed = part
        .trim()
        .replace(/^[.,|;:/\\]+|[.,|;:/\\]+$/g, '')
        .trim()
      if (trimmed) {
        result.push(trimmed)
      }
    }
  }
  return result
}

/**
 * Splits a token that has swallowed the start of a second address.
 *
 * When two addresses are concatenated without a separator, the join lands
 * inside one token — `"…Dhaka 1230, Bangladesh House 84, Bangladesh…"` gives
 * `"Bangladesh House 84"`. That token is unique, so plain deduplication keeps
 * it and every repeat after it, and the customer's address is stored twice.
 *
 * Only a restart of the *first* token counts as a join. Splitting on any
 * repeated token would wreck ordinary addresses: with `"Dhaka"` already seen,
 * `"Dhaka 1230"` would be torn into `"Dhaka"` and a meaningless `"1230"`.
 */
function unmergeRestart(token: string, firstKey: string): string[] {
  if (!firstKey) return [token]
  const words = token.split(/\s+/).filter(Boolean)

  // Longest suffix first, so "House 84" wins over "84".
  for (let start = 1; start < words.length; start += 1) {
    const suffix = words.slice(start).join(' ')
    if (normalizeAddressToken(suffix) === firstKey) {
      return [words.slice(0, start).join(' '), suffix]
    }
  }

  /*
   * The same join with no space at all — "…BangladeshHouse 84" — leaves the two
   * addresses sharing a word, so there is no whitespace to split on. The cut is
   * only made at a lower-to-upper case change, which is what a missing space
   * between two words looks like. Without that guard a first token of
   * "Road 12" would slice "Broad 12" into "B" and "road 12".
   */
  for (let index = 1; index < token.length; index += 1) {
    const before = token[index - 1] ?? ''
    const at = token[index] ?? ''
    const isCaseBoundary = before === before.toLowerCase() && at !== at.toLowerCase()
    if (!isCaseBoundary) continue
    if (normalizeAddressToken(token.slice(index)) === firstKey) {
      return [token.slice(0, index), token.slice(index)]
    }
  }

  return [token]
}

/**
 * Deduplicates and formats an address from any combination of address lines,
 * city, district, thana, division, or postal code.
 *
 * Repeats are removed; genuinely different places are not. Two conflicting
 * localities in one submission stay in the output, because deciding which one
 * the parcel should go to is not a formatting decision — a courier has to see
 * the conflict rather than have it silently resolved.
 */
export function formatCleanAddress(...inputs: (string | null | undefined)[]): string {
  const rawTokens = splitAddressTokens(...inputs)
  if (rawTokens.length === 0) return ''

  const firstKey = normalizeAddressToken(rawTokens[0] ?? '')
  const tokens = rawTokens.flatMap((token, index) =>
    // The first token cannot be a restart of itself.
    index === 0 ? [token] : unmergeRestart(token, firstKey),
  ).map(collapseRepeatedWords)

  const seen = new Set<string>()
  const uniqueTokens: string[] = []

  for (const token of tokens) {
    const key = normalizeAddressToken(token)
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    uniqueTokens.push(token)
  }

  return uniqueTokens.join(', ')
}

/* ------------------------------------------------------------------------- *
 * Composing street + thana + district
 *
 * Lives here rather than in the checkout app so it can be tested directly. The
 * previous arrangement had the test mirror a copy of this logic, which is a
 * guarantee the two drift apart and the tests stop describing the shipped code.
 * ------------------------------------------------------------------------- */

/** Comparison form for a locality word — case, punctuation and spacing removed. */
function localityKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, ' ')
    .trim()
}

function addressParts(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function dropTrailingPart(parts: string[], token: string): string[] {
  const target = localityKey(token)
  if (!target) return parts
  const last = parts[parts.length - 1]
  if (last !== undefined && localityKey(last) === target) return parts.slice(0, -1)
  return parts
}

/**
 * Remove a locality run from the end of a word list.
 *
 * Only a run at the end counts, and only when what follows it is a postcode or
 * nothing. That is what lets a road genuinely named after its area keep its
 * own name instead of being stripped as a repeated locality.
 */
function dropTrailingRun(words: string[], token: string): string[] {
  const target = localityKey(token)
  if (!target) return words
  const targetWords = target.split(' ').filter(Boolean)
  if (targetWords.length === 0) return words

  for (let start = words.length - targetWords.length; start >= 0; start -= 1) {
    if (localityKey(words.slice(start, start + targetWords.length).join(' ')) !== target) continue
    const after = words.slice(start + targetWords.length)
    if (after.every((word) => /^\d{3,6}$/.test(localityKey(word)))) {
      return [...words.slice(0, start), ...after]
    }
  }
  return words
}

/** Levenshtein distance, capped — only used to forgive a typed locality's typo. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 3
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length] ?? 3
}

/**
 * Words that must never be treated as a misspelled locality.
 *
 * Bangla addresses are full of direction and place words sitting one letter
 * from a real thana name — "uttar" (north) against "Uttara" being the dangerous
 * one. Forgiving a typo there would delete a genuine part of the street.
 */
const NEVER_FUZZY = new Set([
  'uttar', 'dakshin', 'purba', 'paschim', 'madhya', 'notun', 'purano',
  'bazar', 'para', 'road', 'sadar', 'ghat', 'pur', 'gonj', 'ganj',
  '\u0989\u09A4\u09CD\u09A4\u09B0', '\u09A6\u0995\u09CD\u09B7\u09BF\u09A3', '\u09AA\u09C2\u09B0\u09CD\u09AC', '\u09AA\u09B6\u09CD\u099A\u09BF\u09AE',
  '\u09AC\u09BE\u099C\u09BE\u09B0', '\u09AA\u09BE\u09DC\u09BE', '\u09B0\u09CB\u09A1', '\u09B8\u09A6\u09B0',
])

/** Is this word the customer's own typo for the locality they picked? */
function isLocalityTypo(word: string, locality: string): boolean {
  const a = localityKey(word)
  const b = localityKey(locality)
  if (!a || !b || a === b) return false
  // Under five letters almost anything is one edit from anything else.
  if (a.length < 5 || b.length < 5) return false
  if (NEVER_FUZZY.has(a)) return false
  return editDistance(a, b) <= (Math.max(a.length, b.length) >= 9 ? 2 : 1)
}

function dropTrailingTypo(words: string[], locality: string): string[] {
  if (!localityKey(locality)) return words
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const after = words.slice(index + 1)
    if (!after.every((word) => /^\d{3,6}$/.test(localityKey(word)))) continue
    const candidate = words[index]
    if (candidate && isLocalityTypo(candidate, locality)) {
      return [...words.slice(0, index), ...after]
    }
  }
  return words
}

/** True when the street already carries this locality as a standalone word run. */
function mentionsLocality(street: string, locality: string): boolean {
  const target = localityKey(locality)
  if (!target) return false
  return ` ${localityKey(street)} `.includes(` ${target} `)
}

/**
 * Drop an exact second copy of the same word run. Needs four words so
 * "12 12" (a plausible holding) is left alone.
 */
function collapseRepeatedWords(raw: string): string {
  let words = raw.trim().split(/\s+/).filter(Boolean)
  while (words.length >= 4 && words.length % 2 === 0) {
    const half = words.length / 2
    const left = words.slice(0, half).map(localityKey).join(' ')
    const right = words.slice(half).map(localityKey).join(' ')
    if (left !== right) break
    words = words.slice(0, half)
  }
  return words.join(' ')
}

/** Remove a trailing thana/district the customer typed into the street line. */
export function stripLocalitySuffix(raw: string, thana: string, district: string): string {
  const parts = addressParts(raw)

  if (parts.length > 1) {
    let remaining = parts
    // Twice, so trailing thana/district comma-parts clear regardless of order.
    for (let pass = 0; pass < 2; pass += 1) {
      if (remaining.length <= 1) break
      remaining = dropTrailingPart(remaining, district)
      if (remaining.length <= 1) break
      remaining = dropTrailingPart(remaining, thana)
    }
    const last = remaining[remaining.length - 1]
    if (remaining.length > 1 && last) {
      const trimmed = dropTrailingRun(
        dropTrailingRun(last.split(/\s+/).filter(Boolean), district),
        thana,
      ).join(' ')
      remaining = trimmed ? [...remaining.slice(0, -1), trimmed] : remaining.slice(0, -1)
    }
    return remaining.join(', ')
  }

  return dropTrailingRun(
    dropTrailingRun(raw.trim().split(/\s+/).filter(Boolean), district),
    thana,
  ).join(' ')
}

/**
 * Street + thana + district, with every part appearing exactly once.
 *
 * Customers repeat the locality in three different places, so there are three
 * defences, in order:
 *
 *   1. typed at the end of the street    -> stripped, exactly then allowing a typo
 *   2. typed anywhere else in the street -> the select's copy is not appended
 *   3. the whole address pasted twice    -> collapsed by `formatCleanAddress`
 *
 * Rule 2 covers a locality written at the start of the street. Deleting it
 * there would destroy a road named after its area, so the street is left whole
 * and the duplicate is avoided by not adding a second copy.
 */
export function composeDeliveryAddress(address: string, thana: string, district: string): string {
  const stripped = stripLocalitySuffix(collapseRepeatedWords(address), thana, district)
  const street = dropTrailingTypo(
    dropTrailingTypo(stripped.split(/\s+/).filter(Boolean), district),
    thana,
  ).join(' ')

  return formatCleanAddress(
    street,
    mentionsLocality(street, thana) ? '' : thana,
    mentionsLocality(street, district) ? '' : district,
  )
}
