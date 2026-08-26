import type { PrismaService } from '../../common/prisma.service'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { McpTokenService, MCP_READ_SCOPE, MCP_WRITE_SCOPE } from './mcp-token.service'

const owner = { role: 'SUPER_ADMIN', storeId: 'store-1' } as AdminSessionPayload

function buildService() {
  const created: Array<{ scopes: string[] }> = []
  const prisma = {
    store: { findFirst: jest.fn(async () => ({ id: 'store-1' })) },
    apiKey: {
      create: jest.fn(async ({ data, select: _select }: { data: { scopes: string[] }; select: unknown }) => {
        created.push({ scopes: data.scopes })
        return {
          id: 'key-1',
          name: 'token',
          prefix: 'splaro_mcp_abcdef',
          scopes: data.scopes,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }
      }),
    },
  } as unknown as PrismaService

  return { service: new McpTokenService(prisma), created }
}

describe('McpTokenService.create', () => {
  it('issues a read-only token when no scopes are asked for', async () => {
    const { service, created } = buildService()

    const result = await service.create('splaro', {}, owner)

    // An outside assistant must not get stock/order writes by default.
    expect(created[0]?.scopes).toEqual([MCP_READ_SCOPE])
    expect(result.scopes).not.toContain(MCP_WRITE_SCOPE)
  })

  it('issues write scope only when explicitly requested', async () => {
    const { service, created } = buildService()

    await service.create('splaro', { scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] }, owner)

    expect(created[0]?.scopes).toEqual([MCP_READ_SCOPE, MCP_WRITE_SCOPE])
  })

  it('drops scopes it does not recognise', async () => {
    const { service, created } = buildService()

    await service.create('splaro', { scopes: ['*', 'admin:all', MCP_READ_SCOPE] }, owner)

    expect(created[0]?.scopes).toEqual([MCP_READ_SCOPE])
  })

  it('refuses a non-owner', async () => {
    const { service } = buildService()

    await expect(
      service.create('splaro', {}, { role: 'STAFF', storeId: 'store-1' } as AdminSessionPayload),
    ).rejects.toThrow()
  })
})
