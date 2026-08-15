import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { resolvePublicSiteUrl, toStoredMediaUrl } from '@splaro/config'
import { readdir, statfs, unlink } from 'node:fs/promises'
import path from 'node:path'
import {
  type DiskScan,
  mediaFamilyKey,
  parseByteBudget,
  walkUploads,
} from '../../common/media-disk.util'
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
  contentHash?: string | null
  kind?: string | null
  focalX?: number | null
  focalY?: number | null
  watermarked?: boolean
}

function mediaKindFromMime(mime: string | null | undefined): string {
  const value = (mime ?? '').toLowerCase()
  if (value === 'image/gif') return 'gif'
  if (value === 'image/svg+xml') return 'svg'
  if (value === 'application/pdf') return 'pdf'
  if (value.startsWith('video/')) return 'video'
  if (value.startsWith('image/')) return 'image'
  return 'other'
}

function optionalFloat01(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new BadRequestException('Focal point must be between 0 and 1')
  }
  return number
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

function folderDisplayLabel(slug: string, declaredLabel?: string | null): string {
  const builtIn: Record<string, string> = {
    media: 'General / Hero',
    men: 'Men',
    women: 'Women',
    kids: 'Kids',
    footwear: 'Footwear',
    accessories: 'Accessories',
  }
  if (declaredLabel?.trim()) return declaredLabel.trim()
  return builtIn[slug] ?? slug.replace(/-/g, ' ')
}

function containsReference(value: unknown, references: string[]): boolean {
  if (value === null || value === undefined) return false
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return references.some((reference) => text.includes(reference))
}

/** Month key in the store's reporting order — `2026-08`, sortable as a string. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** A file this fresh is more likely a live upload than an orphan. */
const ORPHAN_SETTLE_MS = 15 * 60 * 1000

const DISK_SCAN_TTL_MS = 60_000

const EMPTY_DISK_SCAN: DiskScan = {
  files: [],
  totalBytes: 0,
  totalFiles: 0,
  available: false,
  truncated: false,
  scannedAt: new Date(0).toISOString(),
}

type CostedAsset = {
  familyKey: string
  /** The indexed file itself. */
  ownBytes: number
  /** The indexed file plus every derivative the pipeline wrote beside it. */
  totalBytes: number
}

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Walking the upload root costs one `stat` per file, so the result is shared
   * for a minute and concurrent callers await the same walk instead of starting
   * their own. Every write that touches disk drops the cache.
   */
  private diskScanCache: { at: number; scan: DiskScan } | null = null
  private diskScanInFlight: Promise<DiskScan> | null = null

  private async diskScan(refresh = false): Promise<DiskScan> {
    if (this.diskScanInFlight) return this.diskScanInFlight
    if (!refresh && this.diskScanCache && Date.now() - this.diskScanCache.at < DISK_SCAN_TTL_MS) {
      return this.diskScanCache.scan
    }
    const run = walkUploads(uploadRoot()).catch(() => EMPTY_DISK_SCAN)
    this.diskScanInFlight = run
    try {
      const scan = await run
      this.diskScanCache = { at: Date.now(), scan }
      return scan
    } finally {
      this.diskScanInFlight = null
    }
  }

  private invalidateDiskScan(): void {
    this.diskScanCache = null
  }

  async list(
    storeIdOrSlug: string,
    query?: string,
    folder?: string,
    options?: { trash?: boolean; duplicates?: boolean },
  ) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const q = cleanText(query, 120)
    const selectedFolder = resolveMediaFolderFilter(folder)
    const trash = options?.trash === true
    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        storeId,
        deletedAt: trash ? { not: null } : null,
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
    let rows = assets
    if (options?.duplicates) {
      const counts = new Map<string, number>()
      for (const asset of rows) {
        if (!asset.contentHash) continue
        counts.set(asset.contentHash, (counts.get(asset.contentHash) ?? 0) + 1)
      }
      rows = rows.filter((asset) => asset.contentHash && (counts.get(asset.contentHash) ?? 0) > 1)
    }
    return {
      assets: rows.map((asset) => ({ ...asset, url: asset.path, publicUrl: publicUrl(asset.path) })),
      total: rows.length,
    }
  }

  async listFolders(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [grouped, declared] = await Promise.all([
      this.prisma.mediaAsset.groupBy({
        by: ['folder'],
        where: { storeId, deletedAt: null },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
      this.prisma.mediaFolder.findMany({ where: { storeId }, orderBy: { createdAt: 'asc' } }),
    ])
    const counts = new Map(grouped.map((row) => [row.folder, row._count._all]))
    // Indexed bytes only — the derivative-aware total costs a disk walk and lives
    // on the storage endpoint, which is where the byte breakdown is read.
    const bytes = new Map(grouped.map((row) => [row.folder, row._sum.sizeBytes ?? 0]))
    const labels = new Map(declared.map((row) => [row.slug, row.label]))
    const names = [
      ...new Set<string>([
        ...BUILT_IN_MEDIA_FOLDERS,
        ...declared.map((row) => row.slug),
        ...counts.keys(),
      ]),
    ].sort((a, b) => {
      if (a === 'media') return -1
      if (b === 'media') return 1
      return a.localeCompare(b)
    })
    const folders = names.map((name) => {
      const row = declared.find((item) => item.slug === name)
      return {
        name,
        label: folderDisplayLabel(name, labels.get(name)),
        count: counts.get(name) ?? 0,
        bytes: bytes.get(name) ?? 0,
        builtIn: (BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(name),
        parentSlug: row?.parentId
          ? declared.find((item) => item.id === row.parentId)?.slug ?? null
          : name.includes('/')
            ? name.slice(0, name.lastIndexOf('/'))
            : null,
      }
    })

    // The nested shape the folder rail renders. Rolled-up totals let a collapsed
    // parent still show what its children hold. A child whose parent is missing
    // is promoted to the root rather than dropped.
    type FolderNode = (typeof folders)[number] & {
      children: FolderNode[]
      totalCount: number
      totalBytes: number
    }
    const nodes = new Map<string, FolderNode>(
      folders.map((folder) => [
        folder.name,
        { ...folder, children: [], totalCount: folder.count, totalBytes: folder.bytes },
      ]),
    )
    const tree: FolderNode[] = []
    for (const node of nodes.values()) {
      const parent = node.parentSlug ? nodes.get(node.parentSlug) : undefined
      if (parent && parent !== node) parent.children.push(node)
      else tree.push(node)
    }
    for (const node of tree) {
      for (const child of node.children) {
        node.totalCount += child.totalCount
        node.totalBytes += child.totalBytes
      }
    }

    return { folders, tree }
  }

  async createFolder(storeIdOrSlug: string, rawLabel: string, parentSlug?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const label = cleanText(rawLabel, 40)
    if (!label) throw new BadRequestException('Folder name is required')
    const parent = parentSlug?.trim() ? normalizeMediaFolder(parentSlug) : ''
    if (parent.includes('/')) {
      throw new BadRequestException('Only one nested folder level is allowed')
    }
    if (parent && (BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(parent)) {
      throw new BadRequestException('Cannot nest inside a built-in folder')
    }
    const leaf = normalizeMediaFolder(label)
    const slug = parent ? `${parent}/${leaf}` : leaf
    if ((BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(slug)) {
      const count = await this.prisma.mediaAsset.count({ where: { storeId, folder: slug, deletedAt: null } })
      return { name: slug, label: folderDisplayLabel(slug), count, builtIn: true, parentSlug: null as string | null }
    }
    let parentId: string | null = null
    if (parent) {
      const parentRow = await this.prisma.mediaFolder.findFirst({ where: { storeId, slug: parent } })
      if (!parentRow) throw new NotFoundException('Parent folder not found')
      parentId = parentRow.id
    }
    await this.prisma.mediaFolder.upsert({
      where: { storeId_slug: { storeId, slug } },
      create: { storeId, slug, label, parentId },
      update: { label, parentId },
    })
    const count = await this.prisma.mediaAsset.count({ where: { storeId, folder: slug, deletedAt: null } })
    return {
      name: slug,
      label: folderDisplayLabel(slug, label),
      count,
      builtIn: false,
      parentSlug: parent || null,
    }
  }

  async deleteFolder(storeIdOrSlug: string, rawSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const slug = normalizeMediaFolder(rawSlug)
    if ((BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(slug)) {
      throw new BadRequestException('Built-in folders cannot be deleted')
    }
    const count = await this.prisma.mediaAsset.count({
      where: {
        storeId,
        deletedAt: null,
        OR: [{ folder: slug }, { folder: { startsWith: `${slug}/` } }],
      },
    })
    if (count > 0) {
      throw new ConflictException('Folder still has media. Move or delete the files first.')
    }
    const nested = await this.prisma.mediaFolder.count({ where: { storeId, slug: { startsWith: `${slug}/` } } })
    if (nested > 0) {
      throw new ConflictException('Folder still has nested folders. Delete those first.')
    }
    const deleted = await this.prisma.mediaFolder.deleteMany({ where: { storeId, slug } })
    if (deleted.count === 0) throw new NotFoundException('Folder not found')
    return { deleted: true, slug }
  }

  /**
   * What the library costs, measured rather than assumed.
   *
   * Every number below the volume comes from pairing the indexed rows against a
   * walk of the upload root, so derivatives are billed to the asset that spawned
   * them and files nothing points at surface as orphans. When the walk fails the
   * response degrades to the database sums and reports `disk.available: false`,
   * which is the difference between "no derivatives" and "could not look".
   */
  async storage(storeIdOrSlug: string, options?: { refresh?: boolean }) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [rows, declared, scan] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: { storeId },
        select: {
          id: true,
          name: true,
          path: true,
          folder: true,
          kind: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          deletedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaFolder.findMany({ where: { storeId }, select: { slug: true, label: true } }),
      this.diskScan(options?.refresh === true),
    ])

    const familyBytes = new Map<string, number>()
    const pathBytes = new Map<string, number>()
    for (const file of scan.files) {
      familyBytes.set(file.familyKey, (familyBytes.get(file.familyKey) ?? 0) + file.bytes)
      pathBytes.set(file.storedPath, file.bytes)
    }

    // Live rows claim their family first so a trashed row that happens to share a
    // family key is billed for its own file only, never the same bytes twice.
    const claimed = new Set<string>()
    const cost = (asset: { path: string; sizeBytes: number | null }): CostedAsset => {
      const familyKey = mediaFamilyKey(asset.path)
      const ownBytes = pathBytes.get(asset.path) ?? asset.sizeBytes ?? 0
      if (claimed.has(familyKey)) return { familyKey, ownBytes, totalBytes: ownBytes }
      claimed.add(familyKey)
      return { familyKey, ownBytes, totalBytes: familyBytes.get(familyKey) ?? ownBytes }
    }

    const live = rows.filter((row) => !row.deletedAt)
    const trashed = rows.filter((row) => row.deletedAt)
    const liveCosts = live.map((row) => ({ row, cost: cost(row) }))
    const trashedCosts = trashed.map((row) => ({ row, cost: cost(row) }))

    const indexedBytes = liveCosts.reduce((sum, item) => sum + item.cost.ownBytes, 0)
    const derivativeBytes = liveCosts.reduce(
      (sum, item) => sum + Math.max(0, item.cost.totalBytes - item.cost.ownBytes),
      0,
    )
    const trashBytes = trashedCosts.reduce((sum, item) => sum + item.cost.totalBytes, 0)

    let orphanBytes = 0
    let orphanFiles = 0
    for (const file of scan.files) {
      if (claimed.has(file.familyKey)) continue
      orphanBytes += file.bytes
      orphanFiles += 1
    }

    const labels = new Map(declared.map((row) => [row.slug, row.label]))
    const folderTotals = new Map<string, { bytes: number; count: number }>()
    const typeTotals = new Map<string, { bytes: number; count: number }>()
    const monthTotals = new Map<string, { bytes: number; count: number }>()
    for (const { row, cost: costed } of liveCosts) {
      const folder = folderTotals.get(row.folder) ?? { bytes: 0, count: 0 }
      folder.bytes += costed.totalBytes
      folder.count += 1
      folderTotals.set(row.folder, folder)

      const kind = row.kind || mediaKindFromMime(row.mimeType)
      const type = typeTotals.get(kind) ?? { bytes: 0, count: 0 }
      type.bytes += costed.totalBytes
      type.count += 1
      typeTotals.set(kind, type)

      const month = monthTotals.get(monthKey(row.createdAt)) ?? { bytes: 0, count: 0 }
      month.bytes += costed.totalBytes
      month.count += 1
      monthTotals.set(monthKey(row.createdAt), month)
    }

    // Twelve months of growth, with everything older folded into the first
    // cumulative point so the line starts where the library actually stood.
    const now = new Date()
    const window: string[] = []
    for (let index = 11; index >= 0; index -= 1) {
      window.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1))))
    }
    const windowStart = window[0]
    let cumulativeBytes = 0
    let cumulativeAssets = 0
    for (const [key, value] of monthTotals) {
      if (key >= windowStart) continue
      cumulativeBytes += value.bytes
      cumulativeAssets += value.count
    }
    const byMonth = window.map((month) => {
      const value = monthTotals.get(month) ?? { bytes: 0, count: 0 }
      cumulativeBytes += value.bytes
      cumulativeAssets += value.count
      return {
        month,
        bytes: value.bytes,
        count: value.count,
        cumulativeBytes,
        cumulativeAssets,
      }
    })

    let volume: {
      path: string
      totalBytes: number
      freeBytes: number
      usedBytes: number
      quotaBytes: number | null
    } | null = null
    try {
      const root = uploadRoot()
      const stats = await statfs(root)
      const block = Number(stats.bsize)
      const totalBytes = Number(stats.blocks) * block
      const freeBytes = Number(stats.bavail) * block
      volume = {
        path: root,
        totalBytes,
        freeBytes,
        usedBytes: Math.max(0, totalBytes - freeBytes),
        quotaBytes: parseByteBudget(process.env.MEDIA_QUOTA_BYTES),
      }
    } catch {
      volume = null
    }

    const mediaBytes = indexedBytes + derivativeBytes

    return {
      volume,
      disk: {
        bytes: scan.totalBytes,
        files: scan.totalFiles,
        available: scan.available,
        truncated: scan.truncated,
        scannedAt: scan.scannedAt,
      },
      // Kept flat for the existing admin storage hook; `split` is the honest breakdown.
      libraryBytes: mediaBytes,
      libraryAssets: live.length,
      split: {
        indexedBytes,
        derivativeBytes,
        trashBytes,
        orphanBytes,
        orphanFiles,
        trashAssets: trashed.length,
      },
      byFolder: [...folderTotals.entries()]
        .map(([slug, value]) => ({
          slug,
          label: folderDisplayLabel(slug, labels.get(slug)),
          bytes: value.bytes,
          count: value.count,
        }))
        .sort((a, b) => b.bytes - a.bytes),
      byType: [...typeTotals.entries()]
        .map(([kind, value]) => ({ kind, bytes: value.bytes, count: value.count }))
        .sort((a, b) => b.bytes - a.bytes),
      byMonth,
      largest: liveCosts
        .slice()
        .sort((a, b) => b.cost.totalBytes - a.cost.totalBytes)
        .slice(0, 10)
        .map(({ row, cost: costed }) => ({
          id: row.id,
          name: row.name,
          path: row.path,
          url: row.path,
          publicUrl: publicUrl(row.path),
          folder: row.folder,
          kind: row.kind || mediaKindFromMime(row.mimeType),
          bytes: costed.totalBytes,
        })),
    }
  }

  /**
   * Files sitting in the upload root that no `MediaAsset` row points at.
   *
   * Listing is advisory only — it does not prove a file is unreferenced, because
   * a hand-written banner URL can outlive its index row. `removeOrphan` runs the
   * full usage check before it unlinks anything, so a linked file listed here
   * still refuses to delete.
   */
  async orphans(storeIdOrSlug: string, options?: { refresh?: boolean; limit?: number }) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [rows, scan] = await Promise.all([
      this.prisma.mediaAsset.findMany({ where: { storeId }, select: { path: true } }),
      this.diskScan(options?.refresh === true),
    ])
    const claimed = new Set(rows.map((row) => mediaFamilyKey(row.path)))

    const families = new Map<
      string,
      { paths: string[]; bytes: number; mtimeMs: number; pending: boolean; primaryPath: string; primaryBytes: number }
    >()
    for (const file of scan.files) {
      if (claimed.has(file.familyKey)) continue
      const group = families.get(file.familyKey) ?? {
        paths: [],
        bytes: 0,
        mtimeMs: 0,
        pending: false,
        primaryPath: file.storedPath,
        primaryBytes: -1,
      }
      group.paths.push(file.storedPath)
      group.bytes += file.bytes
      group.mtimeMs = Math.max(group.mtimeMs, file.mtimeMs)
      group.pending = group.pending || file.pending
      // The upload itself is what `removeOrphan` should be handed; a derivative
      // only names the family when the original is already gone.
      const rank = file.derivative || file.pending ? -1 : file.bytes
      if (rank > group.primaryBytes) {
        group.primaryBytes = rank
        group.primaryPath = file.storedPath
      }
      families.set(file.familyKey, group)
    }

    const settledBefore = Date.now() - ORPHAN_SETTLE_MS
    const all = [...families.entries()]
      .map(([familyKey, group]) => ({
        familyKey,
        path: group.primaryPath,
        paths: group.paths.sort(),
        bytes: group.bytes,
        files: group.paths.length,
        modifiedAt: new Date(group.mtimeMs).toISOString(),
        pending: group.pending,
        /** An in-flight upload has no index row yet — leave it alone. */
        purgeSafe: !group.pending && group.mtimeMs < settledBefore,
      }))
      .sort((a, b) => b.bytes - a.bytes)

    const limit = Math.min(Math.max(Number(options?.limit) || 200, 1), 1_000)
    return {
      orphans: all.slice(0, limit),
      total: all.length,
      totalBytes: all.reduce((sum, item) => sum + item.bytes, 0),
      returned: Math.min(all.length, limit),
      scannedAt: scan.scannedAt,
      available: scan.available,
      truncated: scan.truncated,
    }
  }

  /** Delete listed orphans one by one, each still gated by the usage check. */
  async purgeOrphans(storeIdOrSlug: string, paths: string[]) {
    const unique = [...new Set(paths.map((value) => String(value ?? '').trim()).filter(Boolean))].slice(0, 50)
    const results: Array<{ path: string; ok: boolean; error?: string }> = []
    for (const target of unique) {
      try {
        await this.removeOrphan(storeIdOrSlug, target)
        results.push({ path: target, ok: true })
      } catch (error) {
        results.push({
          path: target,
          ok: false,
          error: error instanceof Error ? error.message : 'Orphan delete failed',
        })
      }
    }
    this.invalidateDiskScan()
    return { results, deleted: results.filter((row) => row.ok).length }
  }

  /** Move indexed assets between library folders without touching disk. */
  async bulkMove(storeIdOrSlug: string, ids: string[], rawFolder: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const folder = normalizeMediaFolder(rawFolder)
    if (!(BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(folder)) {
      const exists = await this.prisma.mediaFolder.findFirst({ where: { storeId, slug: folder } })
      if (!exists) throw new NotFoundException('Folder not found')
    }
    const unique = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))].slice(0, 200)
    if (unique.length === 0) return { moved: 0, folder }
    const moved = await this.prisma.mediaAsset.updateMany({
      where: { storeId, id: { in: unique }, deletedAt: null },
      data: { folder },
    })
    return { moved: moved.count, folder }
  }

  /** Permanently delete many trashed assets, files included. */
  async bulkPurge(storeIdOrSlug: string, ids: string[]) {
    const unique = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))].slice(0, 80)
    const results: Array<{ id: string; ok: boolean; error?: string; usage?: MediaUsage[] }> = []
    for (const id of unique) {
      try {
        await this.remove(storeIdOrSlug, id, { permanent: true })
        results.push({ id, ok: true })
      } catch (error) {
        const usage =
          error instanceof ConflictException &&
          typeof error.getResponse === 'function' &&
          typeof error.getResponse() === 'object'
            ? ((error.getResponse() as { usage?: MediaUsage[] }).usage ?? [])
            : []
        results.push({
          id,
          ok: false,
          error: error instanceof Error ? error.message : 'Delete failed',
          ...(usage.length ? { usage } : {}),
        })
      }
    }
    return { results, deleted: results.filter((row) => row.ok).length }
  }

  async create(storeIdOrSlug: string, input: CreateMediaInput) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const mediaPath = storedUploadPath(input.path)
    const name = cleanText(input.name, 160)
    if (!name) throw new BadRequestException('Media name is required')
    const folder = normalizeMediaFolder(input.folder)
    if (!(BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(folder)) {
      await this.prisma.mediaFolder.upsert({
        where: { storeId_slug: { storeId, slug: folder } },
        create: { storeId, slug: folder, label: folderDisplayLabel(folder) },
        update: {},
      })
    }

    const mimeType = cleanText(input.mimeType, 100) || null
    const kind = cleanText(input.kind, 20) || mediaKindFromMime(mimeType)
    const extra = {
      contentHash: cleanText(input.contentHash, 64) || null,
      kind,
      watermarked: Boolean(input.watermarked),
      focalX: optionalFloat01(input.focalX),
      focalY: optionalFloat01(input.focalY),
      deletedAt: null as Date | null,
    }

    const asset = await this.prisma.mediaAsset.upsert({
      where: { storeId_path: { storeId, path: mediaPath } },
      create: {
        storeId,
        name,
        path: mediaPath,
        altText: cleanText(input.altText, 240) || null,
        folder,
        mimeType,
        sizeBytes: optionalInt(input.sizeBytes),
        width: optionalInt(input.width),
        height: optionalInt(input.height),
        ...extra,
      },
      update: {
        name,
        altText: cleanText(input.altText, 240) || null,
        folder,
        mimeType,
        sizeBytes: optionalInt(input.sizeBytes),
        width: optionalInt(input.width),
        height: optionalInt(input.height),
        ...extra,
      },
    })
    this.invalidateDiskScan()
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
        ...(input.focalX !== undefined ? { focalX: optionalFloat01(input.focalX) } : {}),
        ...(input.focalY !== undefined ? { focalY: optionalFloat01(input.focalY) } : {}),
        ...(input.watermarked !== undefined ? { watermarked: Boolean(input.watermarked) } : {}),
      },
    })
    return { ...asset, url: asset.path, publicUrl: publicUrl(asset.path) }
  }

  async usageForAsset(storeIdOrSlug: string, id: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, storeId } })
    if (!asset) throw new NotFoundException('Media asset not found')
    return { id: asset.id, path: asset.path, usage: await this.usage(storeId, asset.path) }
  }

  async usageForPath(storeIdOrSlug: string, inputPath: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const mediaPath = storedUploadPath(inputPath)
    return { path: mediaPath, usage: await this.usage(storeId, mediaPath) }
  }

  async renameFolder(storeIdOrSlug: string, rawSlug: string, rawLabel: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const slug = normalizeMediaFolder(rawSlug)
    if ((BUILT_IN_MEDIA_FOLDERS as readonly string[]).includes(slug)) {
      throw new BadRequestException('Built-in folders cannot be renamed')
    }
    const label = cleanText(rawLabel, 40)
    if (!label) throw new BadRequestException('Folder name is required')
    const parent = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : ''
    const nextSlug = parent ? `${parent}/${normalizeMediaFolder(label)}` : normalizeMediaFolder(label)
    const existing = await this.prisma.mediaFolder.findFirst({ where: { storeId, slug } })
    if (!existing) throw new NotFoundException('Folder not found')
    if (nextSlug !== slug) {
      const clash = await this.prisma.mediaFolder.findFirst({ where: { storeId, slug: nextSlug } })
      if (clash) throw new ConflictException('A folder with that name already exists')
    }
    await this.prisma.$transaction([
      this.prisma.mediaFolder.update({ where: { id: existing.id }, data: { slug: nextSlug, label } }),
      this.prisma.mediaAsset.updateMany({
        where: { storeId, folder: slug },
        data: { folder: nextSlug },
      }),
    ])
    return { name: nextSlug, label, previous: slug }
  }

  async restore(storeIdOrSlug: string, id: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, storeId } })
    if (!asset) throw new NotFoundException('Media asset not found')
    if (!asset.deletedAt) return { ...asset, url: asset.path, publicUrl: publicUrl(asset.path), restored: false }
    const restored = await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: null },
    })
    return { ...restored, url: restored.path, publicUrl: publicUrl(restored.path), restored: true }
  }

  async emptyTrash(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const rows = await this.prisma.mediaAsset.findMany({ where: { storeId, deletedAt: { not: null } } })
    let files = 0
    for (const row of rows) {
      try {
        await this.deleteStoredFiles(row.path)
        files += 1
      } catch {
        /* keep deleting rows even if a file is already gone */
      }
      await this.prisma.mediaAsset.delete({ where: { id: row.id } })
    }
    this.invalidateDiskScan()
    return { deleted: rows.length, files }
  }

  async bulkSoftDelete(storeIdOrSlug: string, ids: string[]) {
    const unique = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))].slice(0, 80)
    const results: Array<{ id: string; ok: boolean; error?: string; usage?: MediaUsage[] }> = []
    for (const id of unique) {
      try {
        await this.remove(storeIdOrSlug, id)
        results.push({ id, ok: true })
      } catch (error) {
        const usage =
          error instanceof ConflictException &&
          typeof error.getResponse === 'function' &&
          typeof error.getResponse() === 'object'
            ? ((error.getResponse() as { usage?: MediaUsage[] }).usage ?? [])
            : []
        results.push({
          id,
          ok: false,
          error: error instanceof Error ? error.message : 'Delete failed',
          ...(usage.length ? { usage } : {}),
        })
      }
    }
    return { results }
  }

  async replaceFile(
    storeIdOrSlug: string,
    id: string,
    input: { path: string; mimeType?: string; sizeBytes?: number; width?: number; height?: number; contentHash?: string; kind?: string },
  ) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const existing = await this.prisma.mediaAsset.findFirst({ where: { id, storeId, deletedAt: null } })
    if (!existing) throw new NotFoundException('Media asset not found')
    const nextPath = storedUploadPath(input.path)
    const previous = existing.path
    const mimeType = cleanText(input.mimeType, 100) || existing.mimeType
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        path: nextPath,
        mimeType,
        sizeBytes: optionalInt(input.sizeBytes) ?? existing.sizeBytes,
        width: optionalInt(input.width) ?? existing.width,
        height: optionalInt(input.height) ?? existing.height,
        contentHash: cleanText(input.contentHash, 64) || existing.contentHash,
        kind: cleanText(input.kind, 20) || mediaKindFromMime(mimeType),
      },
    })
    if (previous !== nextPath) {
      await this.deleteUploadIfUnreferenced(storeId, previous)
    }
    this.invalidateDiskScan()
    return { ...updated, url: updated.path, publicUrl: publicUrl(updated.path) }
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

  /**
   * Delete moves to trash first; deleting a trashed asset removes the row and the
   * files. `permanent` collapses both steps for a caller that has already
   * confirmed the loss — the usage check still guards it either way.
   */
  async remove(storeIdOrSlug: string, id: string, options?: { permanent?: boolean }) {
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
    if (!asset.deletedAt && options?.permanent !== true) {
      await this.prisma.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } })
      return { deleted: true, trashed: true, fileDeleted: false, id, path: asset.path }
    }
    await this.prisma.mediaAsset.delete({ where: { id } })
    this.invalidateDiskScan()
    try {
      await this.deleteStoredFiles(asset.path)
      return { deleted: true, trashed: false, fileDeleted: true, id, path: asset.path }
    } catch (error) {
      return {
        deleted: true,
        trashed: false,
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
    this.invalidateDiskScan()
    return { deleted: true, path: mediaPath }
  }

  /**
   * After unlinking a product gallery row, drop the disk file only when nothing
   * else still references that upload.
   */
  async deleteUploadIfUnreferenced(
    storeId: string,
    mediaPath: string,
  ): Promise<{ fileDeleted: boolean; warning?: string }> {
    try {
      storedUploadPath(mediaPath)
    } catch {
      return { fileDeleted: false }
    }
    const remaining = await this.usage(storeId, mediaPath)
    if (remaining.length > 0) {
      return { fileDeleted: false }
    }
    try {
      await this.deleteStoredFiles(mediaPath)
      return { fileDeleted: true }
    } catch (error) {
      return {
        fileDeleted: false,
        warning: error instanceof Error ? error.message : 'Physical file cleanup failed',
      }
    }
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
