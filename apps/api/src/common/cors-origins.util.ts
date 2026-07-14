/** Strip paths/trailing slashes so https://splaro.co/ matches browser Origin. */
export function normalizeCorsOrigin(origin: string): string {
  const trimmed = origin.trim()
  if (!trimmed) return ''
  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]

export function resolveCorsOriginsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw =
    env['CORS_ORIGINS'] ??
    env['CORS_ORIGIN'] ??
    `${env['WEB_URL'] ?? 'http://localhost:3000'},${env['ADMIN_URL'] ?? 'http://localhost:3001'}`

  const seen = new Set<string>()
  const origins: string[] = []

  for (const part of raw.split(',')) {
    const normalized = normalizeCorsOrigin(part)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      origins.push(normalized)
    }
  }

  if (env['NODE_ENV'] !== 'production') {
    for (const dev of DEV_ORIGINS) {
      if (!seen.has(dev)) {
        seen.add(dev)
        origins.push(dev)
      }
    }
  }

  return origins
}
