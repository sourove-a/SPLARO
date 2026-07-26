/**
 * Trusted client IP for storefront BFF → Nest.
 * Prefer nginx `X-Real-IP` ($remote_addr). Never trust leftmost XFF alone
 * (clients can prepend spoofed hops).
 */
export function getTrustedClientIp(request: Request): string | null {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp && isPlausibleIp(realIp)) return realIp

  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return null

  const hops = forwarded
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!hops.length) return null

  // Rightmost hop is typically the one appended by our edge proxy.
  const trustHops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS ?? '1') || 1)
  const fromRight = hops[Math.max(0, hops.length - trustHops)]
  if (fromRight && isPlausibleIp(fromRight)) return fromRight

  const last = hops[hops.length - 1]
  return last && isPlausibleIp(last) ? last : null
}

function isPlausibleIp(value: string): boolean {
  if (value === 'local' || value === 'unknown') return false
  // Basic IPv4 / IPv6 shape — reject empty / garbage.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true
  if (value.includes(':') && value.length >= 3 && value.length <= 45) return true
  return false
}
