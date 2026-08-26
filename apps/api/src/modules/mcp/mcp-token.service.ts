import { createHash, randomBytes } from 'crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'

export const MCP_READ_SCOPE = 'mcp:read'
export const MCP_WRITE_SCOPE = 'mcp:write'

function mcpConnectUrl(): string {
  const base = (
    process.env['ADMIN_URL'] ||
    process.env['NEXT_PUBLIC_ADMIN_URL'] ||
    'https://admin.splaro.co'
  ).replace(/\/+$/, '')
  // Streamable HTTP. The deprecated HTTP+SSE transport still answers on
  // `${base}/mcp/sse`, but connectors should be pointed at `/mcp`.
  return `${base}/mcp`
}

export type McpTokenRecord = {
  id: string
  storeId: string
  scopes: string[]
  name: string
}

@Injectable()
export class McpTokenService {
  constructor(private readonly prisma: PrismaService) {}

  hashKey(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }

  /**
   * Validate Bearer for MCP HTTP + Nest write proxy.
   * Also accepts env MCP_API_KEY / SPLARO_MCP_SERVICE_TOKEN as full-access bootstrap.
   */
  async validateBearer(rawToken: string | undefined | null): Promise<McpTokenRecord | null> {
    const token = rawToken?.trim()
    if (!token) return null

    const envKeys = [
      process.env['MCP_API_KEY']?.trim(),
      process.env['SPLARO_MCP_SERVICE_TOKEN']?.trim(),
    ].filter(Boolean) as string[]

    if (envKeys.includes(token)) {
      const storeId = await resolveStoreId(
        this.prisma,
        process.env['SPLARO_MCP_STORE_ID'] ?? process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro',
      )
      return {
        id: 'env-bootstrap',
        storeId,
        scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE, '*'],
        name: 'env-bootstrap',
      }
    }

    const row = await this.prisma.apiKey.findFirst({
      where: { keyHash: this.hashKey(token), isActive: true },
      select: { id: true, storeId: true, scopes: true, name: true },
    })
    if (!row) return null
    if (
      !row.scopes.includes(MCP_READ_SCOPE) &&
      !row.scopes.includes(MCP_WRITE_SCOPE) &&
      !row.scopes.includes('*')
    ) {
      return null
    }

    // Fire-and-forget lastUsed — don't block the request.
    void this.prisma.apiKey
      .update({ where: { id: row.id }, data: { lastUsed: new Date() } })
      .catch(() => undefined)

    return {
      id: row.id,
      storeId: row.storeId,
      scopes: row.scopes,
      name: row.name,
    }
  }

  toAdminSession(record: McpTokenRecord, requireWrite: boolean): AdminSessionPayload {
    const canWrite =
      record.scopes.includes(MCP_WRITE_SCOPE) || record.scopes.includes('*')
    if (requireWrite && !canWrite) {
      throw new ForbiddenException('MCP token lacks mcp:write scope')
    }
    if (!record.scopes.includes(MCP_READ_SCOPE) && !canWrite && !record.scopes.includes('*')) {
      throw new ForbiddenException('MCP token lacks mcp:read scope')
    }
    return {
      userId: `mcp:${record.id}`,
      email: `mcp+${record.id}@splaro.internal`,
      name: `MCP · ${record.name}`,
      role: 'SUPER_ADMIN',
      storeId: record.storeId,
      permissions: ['*'],
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }
  }

  private requireSuperAdmin(actor?: AdminSessionPayload) {
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can manage MCP link tokens')
    }
  }

  async list(storeIdRaw: string, actor?: AdminSessionPayload) {
    this.requireSuperAdmin(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw || actor?.storeId)
    const rows = await this.prisma.apiKey.findMany({
      where: {
        storeId,
        OR: [
          { scopes: { has: MCP_READ_SCOPE } },
          { scopes: { has: MCP_WRITE_SCOPE } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        isActive: true,
        lastUsed: true,
        createdAt: true,
      },
    })
    return {
      connectUrl: mcpConnectUrl(),
      tokens: rows.map((r) => ({
        id: r.id,
        name: r.name,
        prefix: r.prefix,
        scopes: r.scopes,
        status: r.isActive ? 'active' : 'revoked',
        lastUsed: r.lastUsed?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  }

  async create(
    storeIdRaw: string,
    body: { name?: string; scopes?: string[] },
    actor?: AdminSessionPayload,
  ) {
    this.requireSuperAdmin(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw || actor?.storeId)
    const name = (body.name ?? 'ChatGPT / Claude MCP').trim() || 'MCP link token'
    const requested = Array.isArray(body.scopes) ? body.scopes : []
    const scopes = Array.from(
      new Set(
        requested.filter((s) => s === MCP_READ_SCOPE || s === MCP_WRITE_SCOPE),
      ),
    )
    // Least privilege by default. This used to hand out read+write whenever the
    // caller said nothing, so an "add a read-only connector" click shipped a
    // token that could move stock and order status.
    const finalScopes = scopes.length > 0 ? scopes : [MCP_READ_SCOPE]

    if (!finalScopes.includes(MCP_READ_SCOPE) && !finalScopes.includes(MCP_WRITE_SCOPE)) {
      throw new BadRequestException('scopes must include mcp:read and/or mcp:write')
    }

    const raw = `splaro_mcp_${randomBytes(24).toString('base64url')}`
    const prefix = raw.slice(0, 18)

    const row = await this.prisma.apiKey.create({
      data: {
        storeId,
        name,
        keyHash: this.hashKey(raw),
        prefix,
        scopes: finalScopes,
        isActive: true,
      },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true },
    })

    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      createdAt: row.createdAt.toISOString(),
      /** Shown once — never stored plaintext. */
      token: raw,
      connectUrl: mcpConnectUrl(),
      header: `Authorization: Bearer ${raw}`,
    }
  }

  async revoke(id: string, actor?: AdminSessionPayload) {
    this.requireSuperAdmin(actor)
    const row = await this.prisma.apiKey.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('MCP token not found')
    if (actor?.storeId && row.storeId !== actor.storeId && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Token belongs to another store')
    }
    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    })
    return { ok: true, id }
  }

  assertValidOrThrow(record: McpTokenRecord | null): asserts record is McpTokenRecord {
    if (!record) throw new UnauthorizedException('Invalid MCP link token')
  }
}
