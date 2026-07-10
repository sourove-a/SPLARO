import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Matches Next.js `.next/BUILD_ID` — used to detect stale cached HTML on Windows. */
export function getBuildId(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)?.trim()
  if (fromEnv) return fromEnv

  try {
    const file = path.join(process.cwd(), '.next/BUILD_ID')
    return readFileSync(file, 'utf8').trim()
  } catch {
    return process.env.NODE_ENV === 'production' ? 'production' : 'development'
  }
}
