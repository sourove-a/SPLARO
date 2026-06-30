import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SCRYPT_KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHash] = passwordHash.split(':')
  if (!salt || !storedHash) return false

  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  const storedBuffer = Buffer.from(storedHash, 'hex')
  const hashBuffer = Buffer.from(hash, 'hex')

  if (storedBuffer.length !== hashBuffer.length) return false
  return timingSafeEqual(storedBuffer, hashBuffer)
}
