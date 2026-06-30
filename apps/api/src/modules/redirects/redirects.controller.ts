import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { CacheService } from '../../common/cache.service'

function normalizeFromPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) throw new BadRequestException('From path is required')
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.replace(/\/+$/, '')
  }
  return withSlash
}

function normalizeToPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) throw new BadRequestException('To path is required')
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function normalizeRedirectType(type?: string): string {
  const value = (type ?? '301').trim()
  if (!['301', '302', '307', '308'].includes(value)) {
    throw new BadRequestException('Redirect type must be 301, 302, 307, or 308')
  }
  return value
}

@Controller('admin/redirects')
export class RedirectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async bustRedirectCache(storeId: string) {
    await this.cache.invalidateStoreResource(storeId, 'redirects')
  }

  @Get()
  async list(@Query('storeId') storeId: string, @Query('active') active?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    try {
      const redirects = await this.prisma.urlRedirect.findMany({
        where: {
          storeId: sid,
          ...(active !== undefined ? { isActive: active === 'true' } : {}),
        },
        orderBy: [{ createdAt: 'asc' }],
      })
      return { redirects, total: redirects.length }
    } catch {
      return { redirects: [], total: 0 }
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const redirect = await this.prisma.urlRedirect.findUnique({ where: { id } })
    if (!redirect) throw new NotFoundException('Redirect not found')
    return redirect
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      fromPath: string
      toPath: string
      type?: string
      isActive?: boolean
      note?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const fromPath = normalizeFromPath(body.fromPath)
    const toPath = normalizeToPath(body.toPath)
    if (fromPath === toPath) {
      throw new BadRequestException('From and to paths must be different')
    }

    const redirect = await this.prisma.urlRedirect.create({
      data: {
        storeId: sid,
        fromPath,
        toPath,
        type: normalizeRedirectType(body.type),
        isActive: body.isActive ?? true,
        note: body.note?.trim() || null,
      },
    })
    await this.bustRedirectCache(sid)
    return redirect
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      fromPath?: string
      toPath?: string
      type?: string
      isActive?: boolean
      note?: string | null
    },
  ) {
    const existing = await this.prisma.urlRedirect.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Redirect not found')

    const fromPath = body.fromPath !== undefined ? normalizeFromPath(body.fromPath) : existing.fromPath
    const toPath = body.toPath !== undefined ? normalizeToPath(body.toPath) : existing.toPath
    if (fromPath === toPath) {
      throw new BadRequestException('From and to paths must be different')
    }

    const redirect = await this.prisma.urlRedirect.update({
      where: { id },
      data: {
        ...(body.fromPath !== undefined ? { fromPath } : {}),
        ...(body.toPath !== undefined ? { toPath } : {}),
        ...(body.type !== undefined ? { type: normalizeRedirectType(body.type) } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}),
      },
    })
    await this.bustRedirectCache(existing.storeId)
    return redirect
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.urlRedirect.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Redirect not found')
    await this.prisma.urlRedirect.delete({ where: { id } })
    await this.bustRedirectCache(existing.storeId)
    return { deleted: true }
  }
}
