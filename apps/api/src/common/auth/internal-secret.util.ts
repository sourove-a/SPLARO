import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time comparison for the `x-splaro-internal` shared secret.
 *
 * `a === b` on a secret leaks its prefix through response timing: an attacker
 * can extend a guess one byte at a time. Every call site that gates on
 * INTERNAL_HEALTH_SECRET should route through here.
 *
 * Returns false for a missing/blank header or an unset secret — an unconfigured
 * secret must never authorise anything.
 */
export function internalSecretMatches(
  provided: string | string[] | undefined,
  expected: string | undefined,
): boolean {
  const secret = expected?.trim()
  if (!secret) return false

  const value = Array.isArray(provided) ? provided[0] : provided
  if (typeof value !== 'string' || !value) return false

  const a = Buffer.from(value, 'utf8')
  const b = Buffer.from(secret, 'utf8')
  // Length is not secret (it is a config choice), and timingSafeEqual throws on
  // a mismatch, so compare it up front.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
