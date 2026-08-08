import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')

// The MCP client spawns this process with a bare environment, so the repo's
// own .env is the only reliable source of DATABASE_URL.
for (const candidate of ['.env.mcp', '.env.local', '.env']) {
  const file = resolve(repoRoot, candidate)
  if (existsSync(file)) loadDotenv({ path: file, override: false })
}

export const REPO_ROOT = repoRoot

export function requireDatabaseUrl(): string {
  const url = process.env['DATABASE_URL']?.trim()
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add it to the repo .env (or .env.mcp) before starting the MCP server.',
    )
  }
  return url
}

/** Store id pinned by config, if any. Otherwise the server resolves the first active store. */
export function configuredStoreId(): string | null {
  return (
    process.env['SPLARO_MCP_STORE_ID']?.trim() ||
    process.env['NEXT_PUBLIC_STORE_ID']?.trim() ||
    null
  )
}

/** stdout belongs to the MCP protocol — every diagnostic goes to stderr. */
export function log(message: string): void {
  process.stderr.write(`[splaro-mcp] ${message}\n`)
}
