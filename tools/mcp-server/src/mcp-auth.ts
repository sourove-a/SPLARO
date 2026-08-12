import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { prisma } from './prisma.ts'
import type { McpAuthContext } from './auth-context.ts'
import { log, requireDatabaseUrl } from './env.ts'

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function extractToken(req: {
  headers: {
    authorization?: string | string[] | undefined
    'x-mcp-key'?: string | string[] | undefined
  }
}): string | null {
  const auth = req.headers.authorization
  const authValue = Array.isArray(auth) ? auth[0] : auth
  if (authValue?.toLowerCase().startsWith('bearer ')) {
    const token = authValue.slice(7).trim()
    if (token) return token
  }
  const key = req.headers['x-mcp-key']
  const keyValue = Array.isArray(key) ? key[0] : key
  return keyValue?.trim() || null
}

/** Unguarded client — only for ApiKey.lastUsed touches (read proxy forbids update). */
let writeClient: PrismaClient | null = null
function authWritePrisma(): PrismaClient {
  if (!writeClient) {
    writeClient = new PrismaClient({
      datasources: { db: { url: requireDatabaseUrl() } },
      log: ['warn', 'error'],
    })
  }
  return writeClient
}

const lastUsedThrottle = new Map<string, number>()
const LAST_USED_MIN_MS = 60_000

function touchLastUsed(id: string): void {
  const now = Date.now()
  const prev = lastUsedThrottle.get(id) ?? 0
  if (now - prev < LAST_USED_MIN_MS) return
  lastUsedThrottle.set(id, now)
  void authWritePrisma()
    .apiKey.update({ where: { id }, data: { lastUsed: new Date() } })
    .catch(() => undefined)
}

/**
 * Validate Bearer / x-mcp-key against env bootstrap or ApiKey rows with mcp:read.
 */
export async function authenticateMcpRequest(req: {
  headers: {
    authorization?: string | string[] | undefined
    'x-mcp-key'?: string | string[] | undefined
  }
}): Promise<McpAuthContext | null> {
  const token = extractToken(req)
  if (!token) return null

  const tokenHash = hashKey(token)
  const envKey = process.env['MCP_API_KEY']?.trim()
  if (envKey && token === envKey) {
    return {
      token,
      tokenHash,
      storeId: process.env['SPLARO_MCP_STORE_ID']?.trim() || null,
      scopes: ['mcp:read', 'mcp:write', '*'],
      source: 'env',
    }
  }

  try {
    const row = await prisma().apiKey.findFirst({
      where: { keyHash: tokenHash, isActive: true },
      select: { id: true, storeId: true, scopes: true },
    })
    if (!row) return null
    if (
      !row.scopes.includes('mcp:read') &&
      !row.scopes.includes('mcp:write') &&
      !row.scopes.includes('*')
    ) {
      return null
    }
    touchLastUsed(row.id)
    return {
      token,
      tokenHash,
      storeId: row.storeId,
      scopes: row.scopes.length ? row.scopes : ['mcp:read'],
      source: 'api_key',
    }
  } catch (err) {
    log(`auth lookup failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

export { extractToken, hashKey }
