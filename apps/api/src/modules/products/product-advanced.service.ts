import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import * as QRCode from 'qrcode'

@Injectable()
export class ProductAdvancedService {
  private readonly logger = new Logger(ProductAdvancedService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ── SKU GENERATION ────────────────────────────────────────

  async generateSKU(data: {
    categoryCode: string
    productId: string
    size?: string
    color?: string
    variantIndex: number
  }): Promise<string> {
    const cat = data.categoryCode.slice(0, 3).toUpperCase()
    const pid = data.productId.slice(-4).toUpperCase()
    const size = (data.size ?? 'XX').slice(0, 2).toUpperCase()
    const color = (data.color ?? 'XX').slice(0, 2).toUpperCase()
    const idx = String(data.variantIndex).padStart(2, '0')

    return `${cat}-${pid}-${size}${color}-${idx}`
  }

  async ensureVariantSKUs(productId: string): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { where: { sku: null } },
        category: { select: { name: true } },
      },
    })

    if (!product || product.variants.length === 0) return 0

    const categoryCode = product.category?.name ?? 'GEN'
    let updated = 0

    for (let i = 0; i < product.variants.length; i++) {
      const variant = product.variants[i]!
      const sku = await this.generateSKU({
        categoryCode,
        productId,
        size: variant.size ?? undefined,
        color: variant.color ?? undefined,
        variantIndex: i + 1,
      })

      await this.prisma.productVariant.update({
        where: { id: variant.id },
        data: { sku },
      })
      updated++
    }

    return updated
  }

  // ── QR CODE ───────────────────────────────────────────────

  async generateProductQR(productId: string, siteUrl: string): Promise<string> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    })
    if (!product) throw new Error(`Product ${productId} not found`)

    const url = `${siteUrl}/products/${product.slug}?ref=qr`
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      width: 256,
      margin: 2,
      color: { dark: '#111111', light: '#FFFFFF' },
    })

    return qrDataUrl
  }

  async generateVariantQR(variantId: string, siteUrl: string): Promise<string> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { slug: true } } },
    })
    if (!variant) throw new Error(`Variant ${variantId} not found`)

    const url = `${siteUrl}/products/${variant.product.slug}?variant=${variantId}&ref=qr`
    return QRCode.toDataURL(url, { width: 200, margin: 1 })
  }

  // ── BARCODE ───────────────────────────────────────────────

  async generateBarcode(sku: string, format: 'CODE128' | 'EAN13' | 'EAN8' = 'CODE128'): Promise<string> {
    try {
      // @ts-expect-error canvas types not installed
      const { createCanvas } = await import('canvas')
      const JsBarcode = (await import('jsbarcode')).default
      const canvas = createCanvas(300, 100)
      JsBarcode(canvas, sku, {
        format,
        width: 2,
        height: 80,
        displayValue: true,
        font: 'monospace',
        fontSize: 12,
        textMargin: 4,
        background: '#FFFFFF',
        lineColor: '#000000',
      })
      return canvas.toDataURL('image/png')
    } catch {
      this.logger.warn('Barcode generation requires optional canvas package')
      return QRCode.toDataURL(sku, { width: 300, margin: 1 })
    }
  }

  // ── VERSION HISTORY ───────────────────────────────────────

  /** Best-effort snapshot — never blocks the caller on failure. */
  async trySaveProductVersion(productId: string, changedBy: string): Promise<void> {
    try {
      await this.saveProductVersion(productId, changedBy)
    } catch (err) {
      this.logger.warn(
        `Version snapshot skipped for ${productId}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  async saveProductVersion(productId: string, changedBy: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true, variants: true },
    })
    if (!product) return

    const versionCount = await this.prisma.productVersion.count({ where: { productId } })

    await this.prisma.productVersion.create({
      data: {
        productId,
        version: versionCount + 1,
        snapshot: product as unknown as object,
        changedBy,
        changeNote: `Version ${versionCount + 1}`,
      },
    })

    // Keep max 20 versions per product
    const allVersions = await this.prisma.productVersion.findMany({
      where: { productId },
      orderBy: { version: 'asc' },
      select: { id: true },
    })

    if (allVersions.length > 20) {
      const toDelete = allVersions.slice(0, allVersions.length - 20).map(v => v.id)
      await this.prisma.productVersion.deleteMany({ where: { id: { in: toDelete } } })
    }
  }

  async restoreProductVersion(
    productId: string,
    versionId: string,
    restoredBy: string,
  ): Promise<{ storeId: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { storeId: true },
    })
    if (!product) throw new NotFoundException('Product not found')

    const version = await this.prisma.productVersion.findUnique({ where: { id: versionId } })
    if (!version || version.productId !== productId) {
      throw new NotFoundException('Version not found')
    }

    const snapshot = version.snapshot as Record<string, unknown>

    await this.trySaveProductVersion(productId, restoredBy)

    const str = (key: string): string | null | undefined => {
      const value = snapshot[key]
      return typeof value === 'string' ? value : value == null ? null : String(value)
    }
    const num = (key: string): number | null => {
      const value = snapshot[key]
      if (value == null) return null
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }
    const bool = (key: string): boolean => Boolean(snapshot[key])
    const tags = Array.isArray(snapshot['tags']) ? (snapshot['tags'] as string[]) : []
    const publishAtRaw = snapshot['publishAt']
    const publishAt =
      publishAtRaw != null && publishAtRaw !== ''
        ? new Date(publishAtRaw as string | number | Date)
        : null

    const snapshotSlug = snapshot['slug'] != null ? str('slug') : null
    if (snapshotSlug) {
      const slugClash = await this.prisma.product.findFirst({
        where: { storeId: product.storeId, slug: snapshotSlug, id: { not: productId } },
        select: { id: true },
      })
      if (slugClash) {
        throw new BadRequestException(
          'Cannot restore: snapshot slug is already used by another product',
        )
      }
    }

    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          name: snapshot['name'] as string,
          ...(snapshotSlug ? { slug: snapshotSlug } : {}),
          description: str('description') ?? null,
          shortDescription: str('shortDescription') ?? null,
          basePrice: num('basePrice') ?? undefined,
          compareAtPrice: snapshot['compareAtPrice'] != null ? num('compareAtPrice') : null,
          costPrice: snapshot['costPrice'] != null ? num('costPrice') : null,
          sku: str('sku') ?? null,
          rmCode: str('rmCode') ?? null,
          barcode: str('barcode') ?? null,
          qrCode: str('qrCode') ?? null,
          weight: snapshot['weight'] != null ? num('weight') : null,
          badge: str('badge') ?? null,
          isPublished: bool('isPublished'),
          isHidden: bool('isHidden'),
          status: str('status') ?? 'DRAFT',
          publishAt: publishAt && !Number.isNaN(publishAt.getTime()) ? publishAt : null,
          isFeatured: bool('isFeatured'),
          isNewArrival: bool('isNewArrival'),
          isBestSeller: bool('isBestSeller'),
          fabricContent: str('fabricContent') ?? null,
          fitType: str('fitType') ?? null,
          occasion: str('occasion') ?? null,
          season: str('season') ?? null,
          careInstructions: str('careInstructions') ?? null,
          metaTitle: str('metaTitle') ?? null,
          metaDescription: str('metaDescription') ?? null,
          tags,
          ...(snapshot['categoryId'] != null ? { categoryId: str('categoryId') ?? null } : {}),
          ...(snapshot['lowStockThreshold'] != null
            ? { lowStockThreshold: Number(snapshot['lowStockThreshold']) || 5 }
            : {}),
        },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Restore conflict: a unique field value is already in use')
      }
      throw err
    }

    this.logger.log(`Product ${productId} restored to version ${version.version} by ${restoredBy}`)
    return { storeId: product.storeId }
  }

  async getProductVersionHistory(productId: string) {
    return this.prisma.productVersion.findMany({
      where: { productId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        changedBy: true,
        changeNote: true,
        createdAt: true,
      },
    })
  }
}
