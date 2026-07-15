import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Matches Next.js `.next/BUILD_ID` — used to detect stale cached HTML after deploy. */
export function getBuildId(): string {
  const fromEnv =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)?.trim() ||
    process.env.SPLARO_BUILD_ID?.trim()
  if (fromEnv) return fromEnv

  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, '.next/BUILD_ID'),
    // PM2 standalone cwd is often apps/web — nested standalone copy:
    path.join(cwd, '.next/standalone/apps/web/.next/BUILD_ID'),
    path.join(cwd, 'apps/web/.next/BUILD_ID'),
  ]

  for (const file of candidates) {
    try {
      const id = readFileSync(file, 'utf8').trim()
      if (id) return id
    } catch {
      // try next candidate
    }
  }

  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}
