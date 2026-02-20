import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split(':');
  if (algo !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const derivedBuf = Buffer.from(derived, 'hex');
  if (hashBuf.length !== derivedBuf.length) {
    return false;
  }
  return timingSafeEqual(hashBuf, derivedBuf);
}
