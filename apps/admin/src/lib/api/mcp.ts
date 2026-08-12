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

export function createMcpToken(input?: { name?: string; storeId?: string }) {
  const storeId = input?.storeId ?? 'splaro'
  return apiFetch<McpTokenCreated>(`/admin/mcp/tokens?storeId=${encodeURIComponent(storeId)}`, {
    method: 'POST',
    body: JSON.stringify({ name: input?.name }),
  })
}

export function revokeMcpToken(id: string) {
  return apiFetch<{ ok: boolean; id: string }>(`/admin/mcp/tokens/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
