import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SCRYPT_KEYLEN = 64

/** Fixed scrypt hash so unknown-email logins still pay the hash cost (timing-equal). */
const DUMMY_TIMING_SALT = '00000000000000000000000000000000'
const DUMMY_TIMING_HASH = scryptSync('__splaro_timing_constant__', DUMMY_TIMING_SALT, SCRYPT_KEYLEN).toString('hex')
export const DUMMY_PASSWORD_HASH = `${DUMMY_TIMING_SALT}:${DUMMY_TIMING_HASH}`

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHash] = passwordHash.split(':')
  if (!salt || !storedHash) return false
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  const stored = Buffer.from(storedHash, 'hex')
  const computed = Buffer.from(hash, 'hex')
  if (stored.length !== computed.length) return false
  return timingSafeEqual(stored, computed)
}

/** Always runs scrypt; returns true only when a real stored hash matches. */
export function verifyPasswordWithTimingPad(
  password: string,
  passwordHash: string | null | undefined,
): boolean {
  const hashForTiming =
    typeof passwordHash === 'string' && passwordHash.length > 0
      ? passwordHash
      : DUMMY_PASSWORD_HASH
  const matches = verifyPassword(password, hashForTiming)
  return (
    typeof passwordHash === 'string' &&
    passwordHash.length > 0 &&
    matches
  )
}
