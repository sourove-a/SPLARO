import { Injectable } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../common/prisma.service'

const TOKEN_TTL_MS = 5 * 60 * 1000
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface AdminLoginTokenRecord {
  email: string
  userId: string
  name: string
  role: string
  storeId: string
  exp: number
  used: boolean
}

@Injectable()
export class AdminLoginTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(record: Omit<AdminLoginTokenRecord, 'exp' | 'used'>): Promise<string> {
    await this.purgeExpired()
    const code = this.generateCode()
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    await this.prisma.adminLoginToken.create({
      data: {
        code,
        email: record.email.trim().toLowerCase(),
        userId: record.userId,
        name: record.name,
        role: record.role,
        storeId: record.storeId,
        expiresAt,
      },
    })

    return this.formatCode(code)
  }

  async consume(email: string, rawCode: string): Promise<AdminLoginTokenRecord | null> {
    await this.purgeExpired()
    const code = this.normalizeCode(rawCode)
    const normalizedEmail = email.trim().toLowerCase()

    const row = await this.prisma.adminLoginToken.findUnique({ where: { code } })
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null
    if (row.email !== normalizedEmail) return null

    await this.prisma.adminLoginToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })

    return {
      email: row.email,
      userId: row.userId,
      name: row.name,
      role: row.role,
      storeId: row.storeId,
      exp: row.expiresAt.getTime(),
      used: true,
    }
  }

  formatCode(code: string): string {
    const normalized = this.normalizeCode(code)
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
  }

  private normalizeCode(raw: string): string {
    return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  }

  private generateCode(): string {
    const bytes = randomBytes(8)
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += TOKEN_CHARS[bytes[i]! % TOKEN_CHARS.length]
    }
    return code
  }

  private async purgeExpired(): Promise<void> {
    const now = new Date()
    await this.prisma.adminLoginToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
      },
    })
  }
}
