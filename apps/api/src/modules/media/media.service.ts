import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { resolvePublicSiteUrl, toStoredMediaUrl } from '@splaro/config'
import { readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import {
  BUILT_IN_MEDIA_FOLDERS,
  normalizeMediaFolder,
  resolveMediaFolderFilter,
} from '../../common/media-folder.util'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

export type MediaUsage = {
  type:
    | 'product'
    | 'variant'
    | 'hero'
    | 'category'
    | 'collection'
    | 'order'
    | 'store'
    | 'brand'
    | 'blog'
    | 'seo'
    | 'wholesale'
    | 'partner'
    | 'staff'
    | 'content'
    | 'page'
    | 'settings'
    | 'menu'
  id: string
  label: string
}

type CreateMediaInput = {
  name: string
  path: string
  altText?: string | null
  folder?: string
  mimeType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max)
}

function storedUploadPath(value: unknown): string {
  const stored = toStoredMediaUrl(cleanText(value, 2_048))
  if (!stored.startsWith('/uploads/') || stored.includes('..') || stored.includes('\\')) {
    throw new BadRequestException('Media path must be a safe /uploads/... URL')
  }
  return stored
}

function optionalInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new BadRequestException('Media dimensions and size must be positive integers')
  }
  return number
}

function publicUrl(storedPath: string): string {
  return `${resolvePublicSiteUrl()}${storedPath}`
}

function uploadRoot(): string {
  if (process.env.UPLOAD_DIR?.trim()) return path.resolve(process.env.UPLOAD_DIR.trim())
  if (process.env.NODE_ENV === 'production') return '/var/www/splaro-shared/uploads'
  return path.resolve(process.cwd(), '..', 'web', 'public', 'uploads')
}

function containsReference(value: unknown, references: string[]): boolean {
  if (value === null || value === undefined) return false
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return references.some((reference) => text.includes(reference))
}

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeIdOrSlug: string, query?: string, folder?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const q = cleanText(query, 120)
    const selectedFolder = resolveMediaFolderFilter(folder)
    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        storeId,
        ...(selectedFolder ? { folder: selectedFolder } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { altText: { contains: q, mode: 'insensitive' } },
                { path: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return {
      assets: assets.map((asset) => ({ ...asset, url: asset.path, publicUrl: publicUrl(asset.path) })),
      total: assets.length,
    }
  }

  /**
   * Every folder the picker should offer: the built-in buckets plus any folder
   * the store has actually filed media under. Counts let the UI show which are
   * empty, and drive the "delete only when empty" rule in the admin.
   */
  async listFolders(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const grouped = await this.prisma.mediaAsset.groupBy({
      by: ['folder'],
      where: { storeId },
      _count: { _all: true },
    })
    const counts = new Map(grouped.map((row) => [row.folder, row._count._all]))
    const names = [...new Set<string>([...BUILT_IN_MEDIA_FOLDERS, ...counts.keys()])].sort((a, b) => {
      // The general bucket is the default upload target — keep it first.
      if (a === 'media') return -1
      if (b === 'media') return 1
      return a.localeCompare(b)
    })
    return {
      folders: names.map((name) => ({
        name,
        count: counts.get(name) ?? 0,
        builtIn: (BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(name),
      })),
    }
  }

  async create(storeIdOrSlug: string, input: CreateMediaInput) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const mediaPath = storedUploadPath(input.path)
    const name = cleanText(input.name, 160)
    if (!name) throw new BadRequestException('Media name is required')
    const folder = normalizeMediaFolder(input.folder)

    const asset = await this.prisma.mediaAsset.upsert({
      where: { storeId_path: { storeId, path: mediaPath } },
      create: {
        storeId,
        name,
        path: mediaPath,
        altText: cleanText(input.altText, 240) || null,
        folder,
        mimeType: cleanText(input.mimeType, 100) || null,
        sizeBytes: optionalInt(input.sizeBytes),
        width: optionalInt(input.width),
        height: optionalInt(input.height),
      },
      update: {
        name,
        altText: cleanText(input.altText, 240) || null,
        folder,
        mimeType: cleanText(input.mimeType, 100) || null,
        sizeBytes: optionalInt(input.sizeBytes),
        width: optionalInt(input.width),
        height: optionalInt(input.height),
      },
    })
    return { ...asset, url: asset.path, publicUrl: publicUrl(asset.path) }
  }

  async update(storeIdOrSlug: string, id: string, input: Partial<CreateMediaInput>) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const existing = await this.prisma.mediaAsset.findFirst({ where: { id, storeId } })
    if (!existing) throw new NotFoundException('Media asset not found')

    const name = input.name === undefined ? existing.name : cleanText(input.name, 160)
    if (!name) throw new BadRequestException('Media name is required')
    const folder = input.folder === undefined
      ? existing.folder
      : normalizeMediaFolder(input.folder, existing.folder)

    const asset = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        name,
        folder,
        ...(input.altText !== undefined ? { altText: cleanText(input.altText, 240) || null } : {}),
      },
    })
    return { ...asset, url: asset.path, publicUrl: publicUrl(asset.path) }
  }

  async usage(storeId: string, mediaPath: string): Promise<MediaUsage[]> {
    const familyPaths = await this.storedFamilyPaths(mediaPath)
    if (familyPaths.some((storedPath) => storedPath.endsWith('.pending'))) {
      throw new ConflictException('Upload is still processing')
    }
    const references = [...new Set(familyPaths.flatMap((storedPath) => [storedPath, publicUrl(storedPath)]))]
    const [
      productImages,
      variants,
      banners,
      categories,
      collections,
      orderItems,
      store,
      brands,
      blogPosts,
      seoConfigs,
      wholesaleImages,
      partners,
      staff,
      contentBlocks,
      pages,
      settings,
      menuItems,
    ] = await Promise.all([
      this.prisma.productImage.findMany({
        where: { url: { in: references }, product: { storeId } },
        select: { id: true, product: { select: { name: true } } },
      }),
      this.prisma.productVariant.findMany({
        where: { image: { in: references }, product: { storeId } },
        select: { id: true, product: { select: { name: true } }, colorName: true, size: true },
      }),
      this.prisma.banner.findMany({
        where: {
          storeId,
          position: { not: 'library' },
          OR: [{ image: { in: references } }, { mobileImage: { in: references } }],
        },
        select: { id: true, title: true, position: true },
      }),
      this.prisma.category.findMany({
        where: { storeId, image: { in: references } },
        select: { id: true, name: true },
      }),
      this.prisma.collection.findMany({
        where: { storeId, image: { in: references } },
        select: { id: true, name: true },
      }),
      this.prisma.orderItem.findMany({
        where: { image: { in: references }, order: { storeId } },
        select: { id: true, productName: true, order: { select: { invoiceNumber: true } } },
      }),
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          logo: true,
          favicon: true,
          owner: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      this.prisma.brand.findMany({
        where: { storeId, logo: { in: references } },
        select: { id: true, name: true },
      }),
      this.prisma.blogPost.findMany({
        where: { storeId },
        select: { id: true, title: true, featuredImage: true, content: true, schemaMarkup: true },
      }),
      this.prisma.seoConfig.findMany({
        where: { storeId },
        select: { id: true, resourceType: true, resourceId: true, ogImage: true, twitterImage: true, schemaData: true },
      }),
      this.prisma.wholesaleStockImage.findMany({
        where: { storeId, url: { in: references } },
        select: { id: true, title: true },
      }),
      this.prisma.partner.findMany({
        where: { storeId, avatarUrl: { in: references } },
        select: { id: true, name: true },
      }),
      this.prisma.staffRole.findMany({
        where: { storeId, user: { avatar: { in: references } } },
        select: { id: true, user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.contentBlock.findMany({
        where: { storeId },
        select: { id: true, title: true, type: true, settings: true },
      }),
      this.prisma.sitePage.findMany({
        where: { storeId },
        select: { id: true, title: true, slug: true, content: true, customCss: true, customJs: true },
      }),
      this.prisma.siteSettings.findUnique({
        where: { storeId },
        select: {
          id: true,
          storefrontConfig: true,
          customHeadScripts: true,
          customBodyScripts: true,
          customCss: true,
        },
      }),
      this.prisma.menuItem.findMany({
        where: { menu: { storeId } },
        select: { id: true, label: true, url: true, megaMenuData: true },
      }),
    ])

    const usage: MediaUsage[] = [
      ...productImages.map((row) => ({ type: 'product' as const, id: row.id, label: row.product.name })),
      ...variants.map((row) => ({
        type: 'variant' as const,
        id: row.id,
        label: [row.product.name, row.colorName, row.size].filter(Boolean).join(' · '),
      })),
      ...banners.map((row) => ({
        type: 'hero' as const,
        id: row.id,
        label: row.title?.trim() || `${row.position} banner`,
      })),
      ...categories.map((row) => ({ type: 'category' as const, id: row.id, label: row.name })),
      ...collections.map((row) => ({ type: 'collection' as const, id: row.id, label: row.name })),
      ...orderItems.map((row) => ({
        type: 'order' as const,
        id: row.id,
        label: `${row.order.invoiceNumber} · ${row.productName}`,
      })),
      ...(store && (references.includes(store.logo ?? '') || references.includes(store.favicon ?? ''))
        ? [{ type: 'store' as const, id: store.id, label: `${store.name} branding` }]
        : []),
      ...(store?.owner && references.includes(store.owner.avatar ?? '')
        ? [{
            type: 'staff' as const,
            id: store.owner.id,
            label: `${store.owner.firstName} ${store.owner.lastName}`.trim() || 'Store owner avatar',
          }]
        : []),
      ...brands.map((row) => ({ type: 'brand' as const, id: row.id, label: row.name })),
      ...blogPosts
        .filter((row) => containsReference([row.featuredImage, row.content, row.schemaMarkup], references))
        .map((row) => ({ type: 'blog' as const, id: row.id, label: row.title })),
      ...seoConfigs
        .filter((row) => containsReference([row.ogImage, row.twitterImage, row.schemaData], references))
        .map((row) => ({
          type: 'seo' as const,
          id: row.id,
          label: `${row.resourceType}${row.resourceId ? ` · ${row.resourceId}` : ''}`,
        })),
      ...wholesaleImages.map((row) => ({
        type: 'wholesale' as const,
        id: row.id,
        label: row.title?.trim() || 'Wholesale stock image',
      })),
      ...partners.map((row) => ({ type: 'partner' as const, id: row.id, label: row.name })),
      ...staff.map((row) => ({
        type: 'staff' as const,
        id: row.id,
        label: `${row.user.firstName} ${row.user.lastName}`.trim() || 'Staff avatar',
      })),
      ...contentBlocks
        .filter((row) => containsReference(row.settings, references))
        .map((row) => ({
          type: 'content' as const,
          id: row.id,
          label: row.title?.trim() || row.type.replace(/_/g, ' '),
        })),
      ...pages
        .filter((row) => containsReference([row.content, row.customCss, row.customJs], references))
        .map((row) => ({ type: 'page' as const, id: row.id, label: row.title || row.slug })),
      ...(settings && containsReference(
        [settings.storefrontConfig, settings.customHeadScripts, settings.customBodyScripts, settings.customCss],
        references,
      )
        ? [{ type: 'settings' as const, id: settings.id, label: 'Storefront settings' }]
        : []),
      ...menuItems
        .filter((row) => containsReference([row.url, row.megaMenuData], references))
        .map((row) => ({ type: 'menu' as const, id: row.id, label: row.label })),
    ]
    return usage.filter(
      (item, index) => usage.findIndex((candidate) => candidate.type === item.type && candidate.id === item.id) === index,
    )
  }

  async remove(storeIdOrSlug: string, id: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, storeId } })
    if (!asset) throw new NotFoundException('Media asset not found')
    const initialUsage = await this.usage(storeId, asset.path)
    if (initialUsage.length > 0) {
      throw new ConflictException({
        message: 'Media asset is still linked. Unlink it before deleting.',
        usage: initialUsage,
      })
    }

    const finalUsage = await this.usage(storeId, asset.path)
    if (finalUsage.length > 0) {
      throw new ConflictException({
        message: 'Media asset became linked while deletion was being checked.',
        usage: finalUsage,
      })
    }
    await this.prisma.mediaAsset.delete({ where: { id } })
    try {
      await this.deleteStoredFiles(asset.path)
      return { deleted: true, fileDeleted: true, id, path: asset.path }
    } catch (error) {
      return {
        deleted: true,
        fileDeleted: false,
        id,
        path: asset.path,
        warning: error instanceof Error ? error.message : 'Physical file cleanup failed',
      }
    }
  }

  async removeOrphan(storeIdOrSlug: string, inputPath: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const mediaPath = storedUploadPath(inputPath)
    const familyPaths = await this.storedFamilyPaths(mediaPath)
    const indexed = await this.prisma.mediaAsset.findFirst({ where: { storeId, path: { in: familyPaths } } })
    if (indexed) {
      throw new ConflictException('Indexed media cannot be removed as an orphan')
    }
    const usage = await this.usage(storeId, mediaPath)
    if (usage.length > 0) {
      throw new ConflictException({
        message: 'Linked media cannot be removed as an orphan.',
        usage,
      })
    }
    await this.deleteStoredFiles(mediaPath)
    return { deleted: true, path: mediaPath }
  }

  private async storedFamilyPaths(mediaPath: string): Promise<string[]> {
    const storedPath = storedUploadPath(mediaPath)
    const filename = path.posix.basename(storedPath)
    const familyMatch = filename.match(/^([0-9]+-[a-z0-9]+)\.(?:(?:original|upscaled)\.|w[0-9]+(?:\.tmp)?\.)?[a-z0-9]+$/i)
    if (!familyMatch) return [storedPath]

    const storedDirectory = path.posix.dirname(storedPath)
    const filesystemDirectory = this.safeFilesystemPath(storedDirectory.slice('/uploads/'.length))
    const prefix = `${familyMatch[1]}.`
    const files = await readdir(filesystemDirectory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    })
    const siblings = files
      .filter((file) => file.startsWith(prefix))
      .filter((file) =>
        /\.(?:original|upscaled)\.[a-z0-9]+$/i.test(file)
        || /\.w[0-9]+(?:\.tmp)?\.(?:webp|avif)$/i.test(file)
        || /^([0-9]+-[a-z0-9]+)\.pending$/i.test(file)
        || /^([0-9]+-[a-z0-9]+)\.(?:jpg|jpeg|png|webp|gif)$/i.test(file),
      )
      .map((file) => `${storedDirectory}/${file}`)
    return [...new Set([storedPath, ...siblings])]
  }

  private safeFilesystemPath(relativePath: string): string {
    const root = uploadRoot()
    const target = path.resolve(root, relativePath)
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new BadRequestException('Unsafe media path')
    }
    return target
  }

  private async deleteStoredFiles(mediaPath: string): Promise<void> {
    const familyPaths = await this.storedFamilyPaths(mediaPath)
    await Promise.all(familyPaths.map(async (storedPath) => {
      const target = this.safeFilesystemPath(storedPath.slice('/uploads/'.length))
      await unlink(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
    }))
  }
}
