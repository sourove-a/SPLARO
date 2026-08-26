import { apiFetch } from '@/lib/api/client'

export type McpTokenRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  status: 'active' | 'revoked' | string
  lastUsed: string | null
  createdAt: string
}

export type McpTokenList = {
  connectUrl: string
  tokens: McpTokenRow[]
}

export type McpTokenCreated = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  token: string
  connectUrl: string
  header: string
}

export function listMcpTokens(storeId = 'splaro') {
  return apiFetch<McpTokenList>(`/admin/mcp/tokens?storeId=${encodeURIComponent(storeId)}`)
}

export type McpScope = 'mcp:read' | 'mcp:write'

export function createMcpToken(input?: { name?: string; storeId?: string; scopes?: McpScope[] }) {
  const storeId = input?.storeId ?? 'splaro'
  return apiFetch<McpTokenCreated>(`/admin/mcp/tokens?storeId=${encodeURIComponent(storeId)}`, {
    method: 'POST',
    body: JSON.stringify({ name: input?.name, scopes: input?.scopes }),
  })
}

export function revokeMcpToken(id: string) {
  return apiFetch<{ ok: boolean; id: string }>(`/admin/mcp/tokens/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
