import { stripLocalitySuffix } from '@splaro/config'

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


export function splitAddressParts(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
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

/**
 * Address composition now lives in `@splaro/config` so it can be unit tested
 * directly — the checkout app has no test runner, and a mirrored copy in the
 * spec would drift away from the shipped code.
 */
export { composeDeliveryAddress, stripLocalitySuffix } from '@splaro/config'
