import { createHmac, timingSafeEqual } from 'node:crypto';

const SUSPICIOUS_PATTERN = /(union\s+select|sleep\(|benchmark\(|<script|javascript:|onerror=|onload=|\.\.\/|%00|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set)/i;

export function sanitizeText(input: unknown, maxLength = 1000): string {
  const value = String(input ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
  if (value.length > maxLength) return value.slice(0, maxLength);
  return value;
}

export function hasSuspiciousPattern(input: unknown): boolean {
  const value = String(input ?? '');
  if (!value) return false;
  return SUSPICIOUS_PATTERN.test(value);
}

export function maskSecret(value: string, unmasked = 4): string {
  const raw = String(value || '');
  if (raw.length <= unmasked) return '*'.repeat(raw.length || 8);
  return `${raw.slice(0, 2)}${'*'.repeat(Math.max(4, raw.length - unmasked - 2))}${raw.slice(-unmasked)}`;
}

export function verifyWebhookSignature(input: {
  payloadRaw: string;
  signature: string;
  secret: string;
  algorithm?: 'sha256' | 'sha1';
}): boolean {
  const algorithm = input.algorithm || 'sha256';
  const signature = String(input.signature || '').trim();
  const secret = String(input.secret || '').trim();
  if (!signature || !secret) return false;

  const digest = createHmac(algorithm, secret).update(input.payloadRaw).digest('hex');
  const left = Buffer.from(digest, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
