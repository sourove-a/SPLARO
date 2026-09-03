import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { RedisService } from '../../common/redis.service'
import { TelegramService } from '../telegram/telegram.service'
import { isValidBdMobile, normalizeBdPhone } from '../../common/bd-phone.util'
import { generateOrderCode } from '../../common/order-code.util'
import { computeExpectedDeliveryChargeBdt, isDhakaDistrict } from '../../common/delivery-charge.util'
import { resolveStoreId } from '../../common/store.util'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
import { deleteOrderWithRelations } from '../../common/order-cleanup'
import {
  CreateFunnelStoreDto,
  UpdateFunnelStoreDto,
  CreateFunnelOrderDto,
} from './funnel.dto'

export interface FunnelUniverseConfig {
  storeId: string
  storeName: string
  slug: string
  domain: string | null
  subdomain: string | null
  themePreset: string
  themeName?: string
  customColors?: Record<string, string>
  headline?: string
  subheadline?: string
  heroMediaUrl?: string
  heroMediaType?: 'image' | 'video'
  bulletPoints?: string[]
  bundles?: Array<{ qty: number; label: string; price: number; badge?: string }>
  ctaText?: string
  urgencyText?: string
  guaranteeBadge?: string
  whatsappNumber?: string
  videoUrl?: string
  facebookPixelId?: string
  tiktokPixelId?: string
  productLanguage?: 'bn' | 'en'
  customProductTitle?: string
  customProductDescription?: string
  customProductPrice?: number
  customCompareAtPrice?: number
  heroBadgeText?: string
  reviewRatingText?: string
  deliveryTimelineText?: string
  bundleTier2Discount?: number
  bundleTier3Discount?: number
  bundleTier1Tag?: string
  bundleTier2Tag?: string
  bundleTier3Tag?: string
  bundleTier1Title?: string
  bundleTier2Title?: string
  bundleTier3Title?: string
  showBundleCards?: boolean
  product: {
    id: string
    title: string
    slug: string
    sku?: string
    productCode?: string
    price: number
    compareAtPrice?: number
    description: string
    images: string[]
    variants?: Array<{
      id: string
      name: string
      size?: string | null
      color?: string | null
      sku: string
      price: number
      stock: number
    }>
  } | null
  deliveryMatrix: {
    insideDhaka: number
    outsideDhaka: number
  }
}

function sanitizeCustomColors(raw?: Record<string, string> | null): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null
  const tokenMap: Record<string, string> = {
    'var(--admin-c-b5f527)': '#b5f527',
    'var(--admin-c-d4af37)': '#d4af37',
    'var(--admin-c-10b981)': '#10b981',
    'var(--admin-c-e2e8f0)': '#e2e8f0',
    'var(--admin-c-d49a6a)': '#d49a6a',
    'var(--admin-c-f43f5e)': '#f43f5e',
    'var(--admin-c-8b5cf6)': '#8b5cf6',
    'var(--admin-c-06b6d4)': '#06b6d4',
    'var(--admin-color-black)': '#000000',
    'var(--admin-color-white)': '#ffffff',
    'var(--admin-c-0d0f12)': '#0d0f12',
    'var(--admin-c-05120d)': '#05120d',
    'var(--admin-c-14110f)': '#14110f',
    'var(--admin-c-070b14)': '#070b14',
  }
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      const mapped = tokenMap[v] || v
      if (mapped.startsWith('#') || mapped.startsWith('rgb') || mapped.startsWith('hsl')) {
        clean[k] = mapped
      }
    }
  }
  return Object.keys(clean).length > 0 ? clean : null
}

@Injectable()
export class FunnelService {
  private readonly logger = new Logger(FunnelService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Optional() @Inject(TelegramService) private readonly telegram?: TelegramService,
    @Optional() @Inject(OrderNotificationsService) private readonly orderNotifications?: OrderNotificationsService,
  ) {}

  /**
   * Resolve funnel universe configuration by incoming Host header.
   * Leverages Redis for 0ms edge response.
   */
  async resolveByHost(rawHost: string, slug?: string): Promise<FunnelUniverseConfig> {
    const host = this.normalizeHost(rawHost)
    const cacheKey = slug ? `funnel:slug:${slug}` : `funnel:host:${host}`

    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host.includes('localhost')

    // 1. Try Redis cache hit (skip on localhost to allow instant hot-reload of edits)
    try {
      if (this.redis.isReady && !isLocalhost) {
        const cached = await this.redis.getJson<FunnelUniverseConfig>(cacheKey)
        if (cached) {
          return cached
        }
      }
    } catch (err) {
      this.logger.warn(`Redis cache read failed for ${cacheKey}: ${String(err)}`)
    }

    // 2. Query Prisma database
    const subdomainCandidate = this.extractSubdomain(host)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let store: any = null
    if (slug) {
      store = await this.prisma.store.findFirst({
        where: { slug, isActive: true },
        include: { settings: true },
      })
    }

    if (!store) {
      store = await this.prisma.store.findFirst({
        where: {
          isActive: true,
          OR: [
            { domain: host },
            ...(subdomainCandidate ? [{ subdomain: subdomainCandidate }, { slug: subdomainCandidate }] : []),
            { slug: host },
          ],
        },
        include: {
          settings: true,
        },
      })
    }

    // On local dev, if visiting localhost directly, resolve the active funnel drop!
    if (!store && isLocalhost) {
      store = await this.prisma.store.findFirst({
        where: {
          isActive: true,
          subdomain: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        include: { settings: true },
      })
    }

    if (!store) {
      throw new NotFoundException(`Funnel universe not found for host: ${host}`)
    }

    // 3. Extract funnel configuration from SiteSettings.storefrontConfig
    const rawConfig = (store.settings?.storefrontConfig as Record<string, unknown>) ?? {}
    const activeProductId =
      (rawConfig['activeProductId'] as string) ||
      (rawConfig['dropProductId'] as string) ||
      ''

    let productPayload: FunnelUniverseConfig['product'] = null

    if (activeProductId) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: activeProductId,
          status: 'PUBLISHED',
        },
        include: {
          images: {
            select: { url: true },
            orderBy: { position: 'asc' },
          },
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              sku: true,
              price: true,
              stock: true,
              size: true,
              color: true,
              colorName: true,
            },
          },
        },
      })

      if (product) {
        const schema = (product.schemaMarkup && typeof product.schemaMarkup === 'object' ? product.schemaMarkup : {}) as Record<string, unknown>
        const productLang = (rawConfig['productLanguage'] as 'bn' | 'en') || 'bn'
        const customTitle = (rawConfig['customProductTitle'] as string)?.trim()
        const customDesc = (rawConfig['customProductDescription'] as string)?.trim()
        const customPrice = rawConfig['customProductPrice'] ? Number(rawConfig['customProductPrice']) : undefined
        const customCompare = rawConfig['customCompareAtPrice'] ? Number(rawConfig['customCompareAtPrice']) : undefined

        const resolvedTitle = customTitle || (productLang === 'bn' && schema['nameBn'] ? String(schema['nameBn']) : product.name)
        const resolvedDesc = customDesc || (productLang === 'bn' && schema['descriptionBn'] ? String(schema['descriptionBn']) : (product.description ?? ''))
        const resolvedCode = product.productCode || product.sku || product.variants?.[0]?.sku || `SPL-${product.id.slice(-4).toUpperCase()}`

        productPayload = {
          id: product.id,
          title: resolvedTitle,
          slug: product.slug,
          sku: product.sku || resolvedCode,
          productCode: resolvedCode,
          price: customPrice && customPrice > 0 ? customPrice : Number(product.basePrice),
          compareAtPrice: customCompare && customCompare > 0 ? customCompare : (product.compareAtPrice ? Number(product.compareAtPrice) : undefined),
          description: resolvedDesc,
          images: product.images.map((img) => img.url),
          variants: product.variants.map((v) => {
            const label = v.size ? `${v.size}${v.colorName ? ` - ${v.colorName}` : ''}` : v.sku ?? product.name
            return {
              id: v.id,
              name: label,
              size: v.size ?? null,
              color: v.colorName ?? null,
              sku: v.sku ?? '',
              price: Number(v.price) > 0 ? Number(v.price) : Number(product.basePrice),
              stock: v.stock,
            }
          }),
        }
      }
    }

    const config: FunnelUniverseConfig = {
      storeId: store.id,
      storeName: store.name,
      slug: store.slug,
      domain: store.domain,
      subdomain: store.subdomain,
      themePreset: (rawConfig['themePreset'] as string) || 'obsidian-gold',
      themeName: (rawConfig['themeName'] as string) || undefined,
      customColors: sanitizeCustomColors(rawConfig['customColors'] as Record<string, string>) ?? undefined,
      headline: (rawConfig['headline'] as string) || undefined,
      subheadline: (rawConfig['subheadline'] as string) || undefined,
      heroMediaUrl: (rawConfig['heroMediaUrl'] as string) || undefined,
      heroMediaType: (rawConfig['heroMediaType'] as 'image' | 'video') || 'image',
      bulletPoints: (rawConfig['bulletPoints'] as string[]) || undefined,
      bundles: (rawConfig['bundles'] as FunnelUniverseConfig['bundles']) || undefined,
      ctaText: (rawConfig['ctaText'] as string) || undefined,
      urgencyText: (rawConfig['urgencyText'] as string) || undefined,
      guaranteeBadge: (rawConfig['guaranteeBadge'] as string) || undefined,
      whatsappNumber: (rawConfig['whatsappNumber'] as string)?.trim() || '01905010205',
      videoUrl: (rawConfig['videoUrl'] as string) || undefined,
      facebookPixelId:
        (rawConfig['facebookPixelId'] as string)?.trim() ||
        store.settings?.facebookPixelId?.trim() ||
        process.env['FB_PIXEL_ID']?.trim() ||
        process.env['NEXT_PUBLIC_FB_PIXEL_ID']?.trim() ||
        '1078121511554124',
      tiktokPixelId: (rawConfig['tiktokPixelId'] as string) || undefined,
      productLanguage: (rawConfig['productLanguage'] as 'bn' | 'en') || 'bn',
      customProductTitle: (rawConfig['customProductTitle'] as string) || undefined,
      customProductDescription: (rawConfig['customProductDescription'] as string) || undefined,
      customProductPrice: rawConfig['customProductPrice'] ? Number(rawConfig['customProductPrice']) : undefined,
      customCompareAtPrice: rawConfig['customCompareAtPrice'] ? Number(rawConfig['customCompareAtPrice']) : undefined,
      heroBadgeText: (rawConfig['heroBadgeText'] as string) || undefined,
      reviewRatingText: (rawConfig['reviewRatingText'] as string) || undefined,
      deliveryTimelineText: (rawConfig['deliveryTimelineText'] as string) || undefined,
      bundleTier2Discount: rawConfig['bundleTier2Discount'] !== undefined ? Number(rawConfig['bundleTier2Discount']) : undefined,
      bundleTier3Discount: rawConfig['bundleTier3Discount'] !== undefined ? Number(rawConfig['bundleTier3Discount']) : undefined,
      bundleTier1Tag: (rawConfig['bundleTier1Tag'] as string) || undefined,
      bundleTier2Tag: (rawConfig['bundleTier2Tag'] as string) || undefined,
      bundleTier3Tag: (rawConfig['bundleTier3Tag'] as string) || undefined,
      bundleTier1Title: (rawConfig['bundleTier1Title'] as string) || undefined,
      bundleTier2Title: (rawConfig['bundleTier2Title'] as string) || undefined,
      bundleTier3Title: (rawConfig['bundleTier3Title'] as string) || undefined,
      showBundleCards: rawConfig['showBundleCards'] !== undefined ? Boolean(rawConfig['showBundleCards']) : true,
      product: productPayload,
      deliveryMatrix: {
        insideDhaka: Number(store.settings?.dhakaDeliveryCharge ?? 70),
        outsideDhaka: Number(store.settings?.outsideDhakaCharge ?? 130),
      },
    }

    // 4. Cache in Redis for 1 hour (skip on localhost to avoid stale cache during development)
    try {
      if (this.redis.isReady && !isLocalhost) {
        await this.redis.setJson(cacheKey, config, 3600)
      }
    } catch (err) {
      this.logger.warn(`Redis cache write failed for ${cacheKey}: ${String(err)}`)
    }

    return config
  }

  /**
   * Express 1-Page Checkout for Funnel drops.
   * Zero-trust pricing, phone normalization, idempotency lock, and Telegram alert.
   */
  async createOrder(dto: CreateFunnelOrderDto) {
    // 1. Idempotency Lock
    if (dto.idempotencyKey && this.redis.isReady) {
      const lockKey = `funnel:order:idempotency:${dto.idempotencyKey}`
      const acquired = await this.redis.tryAcquireLock(lockKey, 60)
      if (!acquired) {
        throw new ConflictException('An order with this request is already processing.')
      }
    }

    // 2. Validate Bangladeshi Phone
    if (!isValidBdMobile(dto.customerPhone)) {
      throw new BadRequestException('A valid Bangladeshi phone number is required (01XXXXXXXXX).')
    }
    const normalizedPhone = normalizeBdPhone(dto.customerPhone)

    // 3. Resolve Store & Settings
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
      include: { settings: true },
    })
    if (!store || !store.isActive) {
      throw new BadRequestException('Invalid or inactive store for this funnel.')
    }

    // 4. Resolve Product
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        images: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
        variants: {
          where: dto.variantId ? { id: dto.variantId } : undefined,
        },
      },
    })
    if (!product || product.status !== 'PUBLISHED') {
      throw new BadRequestException('The requested product is no longer active.')
    }

    // 5. Zero-Trust Pricing Calculation
    const rawConfig = (store.settings?.storefrontConfig as Record<string, unknown>) ?? {}
    let unitPrice = Number(product.basePrice)
    if (rawConfig['customProductPrice'] && Number(rawConfig['customProductPrice']) > 0) {
      unitPrice = Number(rawConfig['customProductPrice'])
    }
    const matchedVariant = dto.variantId ? product.variants.find((v) => v.id === dto.variantId) : null
    if (matchedVariant && Number(matchedVariant.price) > 0) {
      unitPrice = Number(matchedVariant.price)
    }

    // Check if custom bundle pricing or tier discounts apply
    const bundles = (rawConfig['bundles'] as Array<{ qty: number; price: number }>) ?? []
    const matchedBundle = bundles.find((b) => b.qty === dto.quantity)

    let subtotal = 0
    if (matchedBundle && matchedBundle.price > 0) {
      subtotal = matchedBundle.price
    } else {
      const rawSubtotal = unitPrice * dto.quantity
      const tier2Discount = rawConfig['bundleTier2Discount'] !== undefined ? Number(rawConfig['bundleTier2Discount']) : 200
      const tier3Discount = rawConfig['bundleTier3Discount'] !== undefined ? Number(rawConfig['bundleTier3Discount']) : 450
      let discount = 0
      if (dto.quantity === 2) {
        discount = Math.max(0, tier2Discount)
      } else if (dto.quantity >= 3) {
        discount = Math.max(0, tier3Discount)
      }
      subtotal = Math.max(0, rawSubtotal - discount)
    }

    // Calculate delivery charge server-side
    const deliveryCharge = computeExpectedDeliveryChargeBdt(
      dto.shippingDistrict,
      {
        dhakaDeliveryCharge: Number(store.settings?.dhakaDeliveryCharge ?? 70),
        outsideDhakaCharge: Number(store.settings?.outsideDhakaCharge ?? 130),
        freeDeliveryThreshold: Number(store.settings?.freeDeliveryThreshold ?? 0),
      },
      { subtotal },
    )

    const total = subtotal + deliveryCharge

    // 6. Generate Canonical SPLARO Invoice Code (SPL-####) & Insert into Main Store Order Queue
    const mainStoreId = await resolveStoreId(this.prisma)
    const funnelDomain = store.domain || (store.subdomain ? `${store.subdomain}.splaro.co` : 'funnel')

    const result = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateOrderCode(tx, mainStoreId)

      const order = await tx.order.create({
        data: {
          storeId: mainStoreId,
          invoiceNumber,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          paymentMethod: dto.paymentMethod,
          subtotal,
          deliveryCharge,
          total,
          isInsideDhaka: isDhakaDistrict(dto.shippingDistrict),
          notes: `⚡ Funnel Drop: ${store.name || store.slug}`,
          adminNotes: `D2C Product Funnel (${funnelDomain})`,
          shippingName: dto.customerName.trim(),
          shippingPhone: normalizedPhone,
          shippingEmail: dto.customerEmail?.trim() || null,
          shippingAddress: dto.shippingAddress.trim(),
          shippingCity: dto.shippingDistrict.trim(),
          shippingDistrict: dto.shippingDistrict.trim(),
          shippingDivision: 'Bangladesh',
          trafficSource: 'D2C_FUNNEL',
          landingPage: `Funnel: ${store.name || store.slug}`,
          utmSource: dto.attribution?.utmSource,
          utmMedium: dto.attribution?.utmMedium,
          utmCampaign: dto.attribution?.utmCampaign,
          utmContent: dto.attribution?.utmContent,
          fbclid: dto.attribution?.fbclid,
          gclid: dto.attribution?.gclid,
          items: {
            create: [
              {
                productId: product.id,
                variantId: matchedVariant?.id ?? null,
                productName: product.name,
                variantName: matchedVariant?.sku ?? null,
                sku: matchedVariant?.sku ?? product.sku ?? null,
                price: unitPrice,
                quantity: dto.quantity,
                subtotal: unitPrice * dto.quantity,
                image: product.images[0]?.url ?? null,
              },
            ],
          },
          internalNotes: {
            create: [
              {
                body: `D2C Funnel Order · Store: ${store.name || store.slug} (${funnelDomain})`,
                isPrivate: true,
              },
            ],
          },
        },
      })

      return order
    })

    // 7. Fire Official SPLARO Telegram Alert & Customer Confirmation Email via OrderNotificationsService
    if (this.orderNotifications) {
      void this.orderNotifications
        .onOrderPlaced(mainStoreId, result.id, dto.customerEmail?.trim() || undefined)
        .catch((err) => {
          this.logger.error(`Order notifications onOrderPlaced failed for ${result.invoiceNumber}: ${String(err)}`)
        })
    } else {
      this.sendTelegramAlert(mainStoreId, {
        invoiceNumber: result.invoiceNumber,
        productTitle: product.name,
        customerName: dto.customerName,
        customerPhone: normalizedPhone,
        district: dto.shippingDistrict,
        address: dto.shippingAddress,
        total,
        deliveryCharge,
        domain: funnelDomain,
      }).catch((err) => {
        this.logger.warn(`Telegram funnel alert failed: ${String(err)}`)
      })
    }

    return {
      ok: true,
      id: result.id,
      invoiceNumber: result.invoiceNumber,
      total: Number(result.total),
      subtotal: Number(result.subtotal),
      deliveryCharge: Number(result.deliveryCharge),
      status: result.status,
      customer: {
        name: result.shippingName,
        phone: result.shippingPhone,
        address: result.shippingAddress,
        city: result.shippingCity,
      },
    }
  }

  /* ─── Admin Management Endpoints ──────────────────────────────── */

  async listFunnels() {
    const stores = await this.prisma.store.findMany({
      where: {
        isActive: true,
        OR: [
          { subdomain: { not: null } },
          { domain: { not: 'splaro.co' } },
        ],
      },
      include: {
        settings: true,
        _count: {
          select: { orders: true, products: true },
        },
      },
      orderBy: { id: 'desc' },
    })

    return stores.map((s) => {
      const config = (s.settings?.storefrontConfig as Record<string, unknown>) ?? {}
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        domain: s.domain,
        subdomain: s.subdomain,
        isActive: s.isActive,
        themePreset: config['themePreset'] || 'obsidian-gold',
        themeName: config['themeName'] || null,
        customColors: config['customColors'] || null,
        activeProductId: config['activeProductId'] || null,
        headline: config['headline'] || null,
        subheadline: config['subheadline'] || null,
        heroMediaUrl: config['heroMediaUrl'] || null,
        heroMediaType: config['heroMediaType'] || 'image',
        bulletPoints: config['bulletPoints'] || [],
        bundles: config['bundles'] || [],
        ctaText: config['ctaText'] || null,
        urgencyText: config['urgencyText'] || null,
        guaranteeBadge: config['guaranteeBadge'] || null,
        whatsappNumber: config['whatsappNumber'] || null,
        videoUrl: config['videoUrl'] || null,
        facebookPixelId: s.settings?.facebookPixelId || null,
        tiktokPixelId: config['tiktokPixelId'] || null,
        productLanguage: config['productLanguage'] || 'bn',
        customProductTitle: config['customProductTitle'] || null,
        customProductDescription: config['customProductDescription'] || null,
        customProductPrice: config['customProductPrice'] ? Number(config['customProductPrice']) : null,
        customCompareAtPrice: config['customCompareAtPrice'] ? Number(config['customCompareAtPrice']) : null,
        heroBadgeText: config['heroBadgeText'] || null,
        reviewRatingText: config['reviewRatingText'] || null,
        deliveryTimelineText: config['deliveryTimelineText'] || null,
        bundleTier2Discount: config['bundleTier2Discount'] !== undefined ? Number(config['bundleTier2Discount']) : 200,
        bundleTier3Discount: config['bundleTier3Discount'] !== undefined ? Number(config['bundleTier3Discount']) : 450,
        bundleTier1Tag: config['bundleTier1Tag'] || null,
        bundleTier2Tag: config['bundleTier2Tag'] || null,
        bundleTier3Tag: config['bundleTier3Tag'] || null,
        bundleTier1Title: config['bundleTier1Title'] || null,
        bundleTier2Title: config['bundleTier2Title'] || null,
        bundleTier3Title: config['bundleTier3Title'] || null,
        showBundleCards: config['showBundleCards'] !== undefined ? Boolean(config['showBundleCards']) : true,
        deliveryInsideDhaka: Number(s.settings?.dhakaDeliveryCharge ?? 70),
        deliveryOutsideDhaka: Number(s.settings?.outsideDhakaCharge ?? 130),
        ordersCount: s._count.orders,
        productsCount: s._count.products,
      }
    })
  }

  async createFunnel(dto: CreateFunnelStoreDto, ownerId: string) {
    const slug = dto.slug.toLowerCase().trim()
    const configPayload = {
      themePreset: dto.themePreset,
      themeName: dto.themeName ?? null,
      customColors: sanitizeCustomColors(dto.customColors),
      activeProductId: dto.activeProductId,
      headline: dto.headline ?? null,
      subheadline: dto.subheadline ?? null,
      heroMediaUrl: dto.heroMediaUrl ?? null,
      heroMediaType: dto.heroMediaType ?? 'image',
      bulletPoints: dto.bulletPoints ?? [],
      bundles: dto.bundles ? (JSON.parse(JSON.stringify(dto.bundles)) as Prisma.InputJsonValue) : [],
      ctaText: dto.ctaText ?? null,
      urgencyText: dto.urgencyText ?? null,
      guaranteeBadge: dto.guaranteeBadge ?? null,
      whatsappNumber: dto.whatsappNumber ?? null,
      videoUrl: dto.videoUrl ?? null,
      tiktokPixelId: dto.tiktokPixelId ?? null,
      productLanguage: dto.productLanguage ?? 'bn',
      customProductTitle: dto.customProductTitle ?? null,
      customProductDescription: dto.customProductDescription ?? null,
      customProductPrice: dto.customProductPrice ?? null,
      customCompareAtPrice: dto.customCompareAtPrice ?? null,
      heroBadgeText: dto.heroBadgeText ?? null,
      reviewRatingText: dto.reviewRatingText ?? null,
      deliveryTimelineText: dto.deliveryTimelineText ?? null,
      bundleTier2Discount: dto.bundleTier2Discount ?? 200,
      bundleTier3Discount: dto.bundleTier3Discount ?? 450,
      bundleTier1Tag: dto.bundleTier1Tag ?? null,
      bundleTier2Tag: dto.bundleTier2Tag ?? null,
      bundleTier3Tag: dto.bundleTier3Tag ?? null,
      bundleTier1Title: dto.bundleTier1Title ?? null,
      bundleTier2Title: dto.bundleTier2Title ?? null,
      bundleTier3Title: dto.bundleTier3Title ?? null,
      showBundleCards: dto.showBundleCards !== undefined ? dto.showBundleCards : true,
    } as Prisma.InputJsonObject

    const store = await this.prisma.store.create({
      data: {
        name: dto.name,
        slug,
        subdomain: dto.subdomain ? dto.subdomain.toLowerCase().trim() : null,
        domain: dto.domain ? dto.domain.toLowerCase().trim() : null,
        email: 'funnel@splaro.co',
        ownerId,
        settings: {
          create: {
            dhakaDeliveryCharge: dto.deliveryInsideDhaka ?? 70,
            outsideDhakaCharge: dto.deliveryOutsideDhaka ?? 130,
            facebookPixelId: dto.facebookPixelId ?? null,
            storefrontConfig: configPayload,
          },
        },
      },
      include: { settings: true },
    })

    // Invalidate Redis caches
    await this.invalidateHostCache(store.domain, store.subdomain, store.slug)

    return store
  }

  async updateFunnel(id: string, dto: UpdateFunnelStoreDto) {
    const existing = await this.prisma.store.findUnique({
      where: { id },
      include: { settings: true },
    })
    if (!existing) {
      throw new NotFoundException(`Funnel not found: ${id}`)
    }

    const currentConfig = (existing.settings?.storefrontConfig as Record<string, unknown>) ?? {}
    const updatedConfig = {
      ...currentConfig,
      ...(dto.themePreset !== undefined ? { themePreset: dto.themePreset } : {}),
      ...(dto.themeName !== undefined ? { themeName: dto.themeName } : {}),
      ...(dto.customColors !== undefined ? { customColors: sanitizeCustomColors(dto.customColors) } : {}),
      ...(dto.activeProductId !== undefined ? { activeProductId: dto.activeProductId } : {}),
      ...(dto.headline !== undefined ? { headline: dto.headline } : {}),
      ...(dto.subheadline !== undefined ? { subheadline: dto.subheadline } : {}),
      ...(dto.heroMediaUrl !== undefined ? { heroMediaUrl: dto.heroMediaUrl } : {}),
      ...(dto.heroMediaType !== undefined ? { heroMediaType: dto.heroMediaType } : {}),
      ...(dto.bulletPoints !== undefined ? { bulletPoints: dto.bulletPoints } : {}),
      ...(dto.bundles !== undefined ? { bundles: JSON.parse(JSON.stringify(dto.bundles)) as Prisma.InputJsonValue } : {}),
      ...(dto.ctaText !== undefined ? { ctaText: dto.ctaText } : {}),
      ...(dto.urgencyText !== undefined ? { urgencyText: dto.urgencyText } : {}),
      ...(dto.guaranteeBadge !== undefined ? { guaranteeBadge: dto.guaranteeBadge } : {}),
      ...(dto.whatsappNumber !== undefined ? { whatsappNumber: dto.whatsappNumber } : {}),
      ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl } : {}),
      ...(dto.tiktokPixelId !== undefined ? { tiktokPixelId: dto.tiktokPixelId } : {}),
      ...(dto.productLanguage !== undefined ? { productLanguage: dto.productLanguage } : {}),
      ...(dto.customProductTitle !== undefined ? { customProductTitle: dto.customProductTitle } : {}),
      ...(dto.customProductDescription !== undefined ? { customProductDescription: dto.customProductDescription } : {}),
      ...(dto.customProductPrice !== undefined ? { customProductPrice: dto.customProductPrice } : {}),
      ...(dto.customCompareAtPrice !== undefined ? { customCompareAtPrice: dto.customCompareAtPrice } : {}),
      ...(dto.heroBadgeText !== undefined ? { heroBadgeText: dto.heroBadgeText } : {}),
      ...(dto.reviewRatingText !== undefined ? { reviewRatingText: dto.reviewRatingText } : {}),
      ...(dto.deliveryTimelineText !== undefined ? { deliveryTimelineText: dto.deliveryTimelineText } : {}),
      ...(dto.bundleTier2Discount !== undefined ? { bundleTier2Discount: dto.bundleTier2Discount } : {}),
      ...(dto.bundleTier3Discount !== undefined ? { bundleTier3Discount: dto.bundleTier3Discount } : {}),
      ...(dto.bundleTier1Tag !== undefined ? { bundleTier1Tag: dto.bundleTier1Tag } : {}),
      ...(dto.bundleTier2Tag !== undefined ? { bundleTier2Tag: dto.bundleTier2Tag } : {}),
      ...(dto.bundleTier3Tag !== undefined ? { bundleTier3Tag: dto.bundleTier3Tag } : {}),
      ...(dto.bundleTier1Title !== undefined ? { bundleTier1Title: dto.bundleTier1Title } : {}),
      ...(dto.bundleTier2Title !== undefined ? { bundleTier2Title: dto.bundleTier2Title } : {}),
      ...(dto.bundleTier3Title !== undefined ? { bundleTier3Title: dto.bundleTier3Title } : {}),
      ...(dto.showBundleCards !== undefined ? { showBundleCards: dto.showBundleCards } : {}),
    } as Prisma.InputJsonObject

    const updated = await this.prisma.store.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.subdomain !== undefined ? { subdomain: dto.subdomain?.toLowerCase().trim() || null } : {}),
        ...(dto.domain !== undefined ? { domain: dto.domain?.toLowerCase().trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        settings: {
          upsert: {
            create: {
              dhakaDeliveryCharge: dto.deliveryInsideDhaka ?? 70,
              outsideDhakaCharge: dto.deliveryOutsideDhaka ?? 130,
              facebookPixelId: dto.facebookPixelId ?? null,
              storefrontConfig: updatedConfig,
            },
            update: {
              ...(dto.facebookPixelId !== undefined ? { facebookPixelId: dto.facebookPixelId } : {}),
              ...(dto.deliveryInsideDhaka !== undefined ? { dhakaDeliveryCharge: dto.deliveryInsideDhaka } : {}),
              ...(dto.deliveryOutsideDhaka !== undefined ? { outsideDhakaCharge: dto.deliveryOutsideDhaka } : {}),
              storefrontConfig: updatedConfig,
            },
          },
        },
      },
      include: { settings: true },
    })

    await this.invalidateHostCache(existing.domain, existing.subdomain, existing.slug)
    await this.invalidateHostCache(updated.domain, updated.subdomain, updated.slug)

    return updated
  }

  async deleteFunnel(id: string) {
    const existing = await this.prisma.store.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    })
    if (!existing) {
      throw new NotFoundException(`Funnel not found: ${id}`)
    }

    await this.invalidateHostCache(existing.domain, existing.subdomain, existing.slug)

    if (existing._count.orders === 0) {
      await this.prisma.siteSettings.deleteMany({ where: { storeId: id } })
      await this.prisma.store.delete({ where: { id } })
    } else {
      await this.prisma.store.update({
        where: { id },
        data: { isActive: false },
      })
    }
    return { ok: true }
  }

  async updateFunnelOrderStatus(id: string, status: string, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, invoiceNumber: true, status: true },
    })
    if (!order) {
      throw new NotFoundException(`Order not found: ${id}`)
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'DELIVERED' ? { paymentStatus: 'PAID' } : {}),
      },
    })
    return { ok: true, order: updated }
  }

  async deleteFunnelOrder(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const removed = await deleteOrderWithRelations(tx, id)
      if (!removed) {
        throw new NotFoundException(`Order not found or already deleted: ${id}`)
      }
      return { ok: true, id }
    })
  }

  /* ─── Private Helpers ─────────────────────────────────────────── */

  private normalizeHost(raw: string): string {
    return raw.trim().toLowerCase().split(':')[0] ?? ''
  }

  private extractSubdomain(host: string): string | null {
    const parts = host.split('.')
    if (parts.length >= 2) {
      const first = parts[0]
      if (first && first !== 'www' && first !== 'splaro' && first !== 'admin') {
        return first
      }
    }
    return null
  }

  private async invalidateHostCache(domain?: string | null, subdomain?: string | null, slug?: string | null) {
    if (!this.redis.isReady) return
    const keys: string[] = ['funnel:host:localhost', 'funnel:host:127.0.0.1']
    if (slug) {
      keys.push(`funnel:slug:${slug}`)
      keys.push(`funnel:host:${slug}`)
    }
    if (domain) keys.push(`funnel:host:${domain}`)
    if (subdomain) {
      keys.push(`funnel:host:${subdomain}.splaro.co`)
      keys.push(`funnel:host:${subdomain}.localhost`)
      keys.push(`funnel:host:${subdomain}`)
    }
    for (const key of keys) {
      try {
        await this.redis.del(key)
      } catch {
        // Silently skip
      }
    }
  }

  private async sendTelegramAlert(
    storeId: string,
    data: {
      invoiceNumber: string
      productTitle: string
      customerName: string
      customerPhone: string
      district: string
      address: string
      total: number
      deliveryCharge: number
      domain: string
    },
  ) {
    if (!this.telegram) return
    const message = [
      `⚡ <b>NEW D2C FUNNEL ORDER!</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📦 <b>Product:</b> ${data.productTitle}`,
      `🔖 <b>Invoice:</b> <code>${data.invoiceNumber}</code>`,
      `👤 <b>Customer:</b> ${data.customerName}`,
      `📞 <b>Phone:</b> <code>${data.customerPhone}</code>`,
      `📍 <b>Location:</b> ${data.address}, ${data.district}`,
      `💵 <b>Total:</b> ৳${data.total.toLocaleString('en-BD')} (Delivery: ৳${data.deliveryCharge})`,
      `🌐 <b>Universe:</b> <code>${data.domain}</code>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🚀 <i>Ready for 1-Click Steadfast dispatch in Admin!</i>`,
    ].join('\n')

    await this.telegram.sendToStoreWithResult(storeId, message)
  }

  /**
   * List orders placed through D2C Funnel Universes
   */
  async listFunnelOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        trafficSource: 'D2C_FUNNEL',
      },
      include: {
        store: { select: { name: true, domain: true, subdomain: true, slug: true } },
        items: { select: { productName: true, quantity: true, price: true } },
        courier: { select: { trackingCode: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return orders
  }
}
