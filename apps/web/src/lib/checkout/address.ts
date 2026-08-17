import { BD_DISTRICTS } from './bd-districts'
import { getThanasForDistrict } from './bd-thanas'

/**
 * Browser autofill for `street-address` returns the whole postal address —
 * "House 5, Road 2, Dhanmondi, Dhaka" — while this form keeps street, thana and
 * district in three separate controls. Without stripping, composing them back
 * together repeats the locality: "…, Dhanmondi, Dhaka, Dhanmondi, Dhaka".
 */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿]+/g, ' ')
    .trim()
}

/** Trailing-token match only — a road genuinely named "Dhanmondi 27" must survive. */
function stripTrailingToken(parts: string[], token: string): string[] {
  const target = normalize(token)
  if (!target) return parts
  const last = parts[parts.length - 1]
  if (last !== undefined && normalize(last) === target) return parts.slice(0, -1)
  return parts
}

export function splitAddressParts(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Remove a trailing ", <thana>, <district>" (in either order, either one
 * missing) from an autofilled street line.
 */
export function stripLocalitySuffix(raw: string, thana: string, district: string): string {
  let parts = splitAddressParts(raw)
  if (parts.length <= 1) return raw.trim()

  // Applied twice so "…, Dhanmondi, Dhaka" clears regardless of which sits last.
  for (let pass = 0; pass < 2; pass += 1) {
    if (parts.length <= 1) break
    parts = stripTrailingToken(parts, district)
    if (parts.length <= 1) break
    parts = stripTrailingToken(parts, thana)
  }

  return parts.join(', ')
}

/**
 * Pull district/thana out of an autofilled address so the selects can be
 * populated and the street line left clean. Returns nulls when nothing matches —
 * never guesses.
 */
export function parseAutofilledAddress(raw: string): {
  street: string
  district: string | null
  thana: string | null
} {
  const parts = splitAddressParts(raw)
  if (parts.length <= 1) return { street: raw.trim(), district: null, thana: null }

  const district =
    BD_DISTRICTS.find((candidate) =>
      parts.some((part) => normalize(part) === normalize(candidate)),
    ) ?? null

  const thana = district
    ? (getThanasForDistrict(district).find((candidate) =>
        parts.some((part) => normalize(part) === normalize(candidate)),
      ) ?? null)
    : null

  return {
    street: stripLocalitySuffix(raw, thana ?? '', district ?? ''),
    district,
    thana,
  }
}

import { formatCleanAddress } from '@splaro/config'

/**
 * Street + thana + district, skipping any locality the street already ends with
 * and deduplicating repeated tokens.
 */
export function composeDeliveryAddress(address: string, thana: string, district: string): string {
  const street = stripLocalitySuffix(address, thana, district)
  return formatCleanAddress(street, thana, district)
}
