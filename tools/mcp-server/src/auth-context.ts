import { AsyncLocalStorage } from 'node:async_hooks'

export type McpAuthContext = {
  /** Raw bearer / x-mcp-key — forwarded to Nest for write tools. */
  token: string
  storeId: string | null
  scopes: string[]
  source: 'env' | 'api_key' | 'stdio'
  /** sha256 of token — bind SSE/stream sessions to the opener. */
  tokenHash?: string
}

const storage = new AsyncLocalStorage<McpAuthContext>()

/** Stdio has no per-request ALS — keep a process-level fallback for Nest writes. */
let stdioFallback: McpAuthContext | null = null

export function setStdioAuthFallback(ctx: McpAuthContext | null): void {
  stdioFallback = ctx
}

export function runWithMcpAuth<T>(ctx: McpAuthContext, fn: () => T): T {
  return storage.run(ctx, fn)
}

export function getMcpAuth(): McpAuthContext | undefined {
  return storage.getStore() ?? stdioFallback ?? undefined
}

/** Bearer for Nest writes: request auth, else env bootstrap / service token. */
export function nestWriteBearer(): string | null {
  const fromRequest = getMcpAuth()?.token?.trim()
  if (fromRequest) return fromRequest
  return (
    process.env['SPLARO_MCP_SERVICE_TOKEN']?.trim() ||
    process.env['MCP_API_KEY']?.trim() ||
    null
  )
}

export function hasMcpWriteScope(ctx?: McpAuthContext): boolean {
  const auth = ctx ?? getMcpAuth()
  const scopes = auth?.scopes ?? []
  if (scopes.includes('mcp:write') || scopes.includes('*')) return true
  return auth?.source === 'env' || auth?.source === 'stdio'
}
