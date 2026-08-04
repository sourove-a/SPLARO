import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { fireAndForget } from '../../common/fire-and-forget'
import { EmailService } from '../email/email.service'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
import { resolvePublicSiteUrl } from '@splaro/config'
import { DEFAULT_CATALOG_CHANNELS, mergeShopFilters } from '@splaro/types'
import {
  emptyStorefrontConfig,
  ensureEssentialHeaderDepartments,
  mergeStorefrontConfig,
  mergeHeaderNav,
  mergeCatalogChannels,
  type StorefrontConfig,
} from './storefront-config'
import { mergeStoryDeckCards } from './story-deck-defaults'

function isSafeMenuHref(value: string): boolean {
  const href = value.trim()
  return (
    href.startsWith('/') ||
    href.startsWith('https://') ||
    href.startsWith('http://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}

@Controller('admin/settings')
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(OrderNotificationsService) private readonly orderNotifications: OrderNotificationsService,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  private async resolveStore(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { OR: [{ id: storeId }, { slug: storeId }] },
      include: { settings: true },
    })
    if (!store) throw new NotFoundException(`Store not found: ${storeId}`)
    return store
  }

  private async purgeStorefrontCache(storeId: string) {
    await Promise.all([
      this.cache.invalidateStoreResource(storeId, 'settings'),
      this.cache.invalidateStoreResource(storeId, 'nav'),
    ])
  }

  private async revalidateStorefrontWeb() {
    const secret = process.env['REVALIDATE_SECRET']
    if (!secret) return
    const base = resolvePublicSiteUrl()

    try {
      await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
        method: 'POST',
        headers: {
          'x-revalidate-secret': secret,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tags: ['storefront-settings'] }),
      })
    } catch {
      /* web revalidation is best-effort */
    }
  }

  private async mapResponse(store: Awaited<ReturnType<typeof this.resolveStore>>) {
    const settings = store.settings
    const config = mergeStorefrontConfig(settings?.storefrontConfig)
    const telegram = await this.prisma.telegramConfig.findUnique({ where: { storeId: store.id } })

    return {
      store: {
        name: store.name,
        email: store.email,
        phone: store.phone ?? '',
        domain: store.domain ?? '',
        currency: store.currency,
        timezone: store.timezone,
        logo: store.logo ?? '',
        favicon: store.favicon ?? '',
        description: store.description ?? '',
        address: store.address ?? '',
      },
      branding: {
        logo: store.logo ?? '',
        favicon: store.favicon ?? '',
        storeImage: config.storeImage ?? '',
        storeLabel: config.storeLabel ?? 'Store',
        footerTagline: config.footerTagline ?? '',
        footerCopyright: config.footerCopyright ?? '',
      },
      contact: {
        email: store.email,
        phone: store.phone ?? '',
        whatsapp: settings?.whatsappNumber ?? '',
        address: store.address ?? '',
      },
      social: {
        instagram: settings?.instagramUrl ?? '',
        facebook: settings?.facebookUrl ?? '',
        tiktok: settings?.tiktokUrl ?? '',
        youtube: settings?.youtubeUrl ?? '',
      },
      navigation: {
        headerNav: ensureEssentialHeaderDepartments(config.headerNav),
        footerGroups: config.footerGroups ?? [],
      },
      menuOverrides: config.menuOverrides ?? { autoSync: true, departments: [] },
      marquee: config.marquee ?? { enabled: false, items: [] },
      specialOffer: config.specialOffer ?? { enabled: false, template: 'countdown', title: '', ctaLabel: 'Shop now', ctaHref: '/shop' },
      newsletter: config.newsletter ?? emptyStorefrontConfig().newsletter,
      ourStory: config.ourStory ?? emptyStorefrontConfig().ourStory,
      homepage: config.homepage ?? emptyStorefrontConfig().homepage,
      catalogChannels: mergeCatalogChannels(config.catalogChannels),
      shopFilters: mergeShopFilters(config.shopFilters),
      catalog: {
        autoGenerateSku: config.catalog?.autoGenerateSku ?? false,
      },
      payments: {
        cod: settings?.codEnabled ?? true,
        bkash: settings?.bkashEnabled ?? false,
        sslcommerz: settings?.sslcommerzEnabled ?? false,
        nagad: settings?.nagadEnabled ?? false,
      },
      shipping: {
        dhakaSameDay: config.shippingZones?.dhakaSameDay ?? true,
        outsideDhaka: config.shippingZones?.outsideDhaka ?? true,
        freeShippingMin: String(Number(settings?.freeDeliveryThreshold ?? 0)),
        dhakaDeliveryCharge: Number(settings?.dhakaDeliveryCharge ?? 60),
        outsideDhakaCharge: Number(settings?.outsideDhakaCharge ?? 120),
      },
      smtp: config.smtp
        ? { ...config.smtp, password: '' }
        : emptyStorefrontConfig().smtp,
      smtpAccounts: (config.smtpAccounts ?? []).map((account) => ({ ...account, password: '' })),
      emailEnabled: settings?.emailEnabled ?? true,
      marketing: {
        facebookPixelId: settings?.facebookPixelId ?? '',
        googleAnalyticsId: settings?.googleAnalyticsId ?? '',
      },
      telegram: telegram
        ? {
            botToken: '',
            chatId: telegram.chatId,
            isActive: telegram.isActive,
            notifyOrders: telegram.notifyOrders,
            notifyPayments: telegram.notifyPayments,
            notifyCourier: telegram.notifyCourier,
            notifyStock: telegram.notifyStock,
            reportDaily: telegram.reportDaily,
          }
        : null,
    }
  }

  @Get()
  async getSettings(@Query('storeId') storeId: string) {
    const store = await this.resolveStore(storeId)
    return await this.mapResponse(store)
  }

  @Get('catalog-stats')
  async getCatalogStats(@Query('storeId') storeId: string) {
    const store = await this.resolveStore(storeId)
    const channels = DEFAULT_CATALOG_CHANNELS

    const products = await this.prisma.product.findMany({
      where: {
        storeId: store.id,
        isPublished: true,
        isHidden: false,
        status: 'PUBLISHED',
      },
      select: {
        category: { select: { name: true } },
        variants: {
          where: { isActive: true },
          select: { stock: true, reservedStock: true },
        },
      },
    })

    const stats = channels.map((channel) => {
      const matched = products.filter((product) => product.category?.name === channel.shopCategory)
      const inStockProducts = matched.filter((product) =>
        product.variants.some((variant) => variant.stock - variant.reservedStock > 0),
      ).length
      const totalStockUnits = matched.reduce(
        (sum, product) =>
          sum +
          product.variants.reduce(
            (variantSum, variant) =>
              variantSum + Math.max(0, variant.stock - variant.reservedStock),
            0,
          ),
        0,
      )

      return {
        slug: channel.slug,
        shopCategory: channel.shopCategory,
        publishedProducts: matched.length,
        inStockProducts,
        totalStockUnits,
      }
    })

    return { channels: stats }
  }

  @Get('newsletter-subscribers')
  async getNewsletterSubscribers(@Query('storeId') storeId: string) {
    const store = await this.resolveStore(storeId)
    const [total, subscribers] = await Promise.all([
      this.prisma.newsletterSubscriber.count({
        where: { storeId: store.id, status: 'active' },
      }),
      this.prisma.newsletterSubscriber.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, email: true, status: true, createdAt: true },
      }),
    ])
    return { total, subscribers }
  }

  @Patch()
  async updateSettings(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      store?: {
        name?: string
        email?: string
        phone?: string
        domain?: string
        currency?: string
        timezone?: string
        logo?: string
        favicon?: string
        description?: string
        address?: string
      }
      branding?: {
        logo?: string
        favicon?: string
        storeImage?: string
        storeLabel?: string
        footerTagline?: string
        footerCopyright?: string
      }
      contact?: {
        email?: string
        phone?: string
        whatsapp?: string
        address?: string
      }
      social?: {
        instagram?: string
        facebook?: string
        tiktok?: string
        youtube?: string
      }
      navigation?: {
        headerNav?: StorefrontConfig['headerNav']
        footerGroups?: StorefrontConfig['footerGroups']
      }
      menuOverrides?: StorefrontConfig['menuOverrides']
      marquee?: StorefrontConfig['marquee']
      specialOffer?: StorefrontConfig['specialOffer']
      newsletter?: StorefrontConfig['newsletter']
      ourStory?: StorefrontConfig['ourStory']
      homepage?: StorefrontConfig['homepage']
      catalogChannels?: StorefrontConfig['catalogChannels']
      shopFilters?: StorefrontConfig['shopFilters']
      catalog?: StorefrontConfig['catalog']
      payments?: {
        cod?: boolean
        bkash?: boolean
        sslcommerz?: boolean
        nagad?: boolean
      }
      shipping?: {
        dhakaSameDay?: boolean
        outsideDhaka?: boolean
        freeShippingMin?: string
        dhakaDeliveryCharge?: number
        outsideDhakaCharge?: number
      }
      smtp?: StorefrontConfig['smtp']
      smtpAccounts?: StorefrontConfig['smtpAccounts']
      emailEnabled?: boolean
      marketing?: {
        facebookPixelId?: string
        googleAnalyticsId?: string
      }
    },
  ) {
    const store = await this.resolveStore(storeId)
    const currentConfig = mergeStorefrontConfig(store.settings?.storefrontConfig)
    const headerNavPatch = body.navigation?.headerNav

    if (headerNavPatch) {
      if (headerNavPatch.length === 0) {
        throw new BadRequestException('Header navigation needs at least one link; hide it if needed')
      }
      if (headerNavPatch.length > 20) {
        throw new BadRequestException('Header navigation supports up to 20 links')
      }
      const invalid = headerNavPatch.find(
        (item) => !item.label.trim() || !item.href.trim() || !isSafeMenuHref(item.href),
      )
      if (invalid) {
        throw new BadRequestException('Every header link needs a label and valid destination')
      }
      const seen = new Set<string>()
      for (const item of headerNavPatch) {
        const key = `${item.label.trim().toLowerCase()}\u0000${item.href.trim()}`
        if (seen.has(key)) throw new BadRequestException(`Duplicate header link: ${item.label.trim()}`)
        seen.add(key)
      }
    }

    for (const department of body.menuOverrides?.departments ?? []) {
      if (department.hidden && department.forceVisible) {
        throw new BadRequestException(`${department.departmentSlug} cannot be hidden and forced live`)
      }
      for (const hero of department.heroes ?? []) {
        const hasAny = Boolean(hero.label.trim() || hero.href.trim() || hero.image.trim())
        if (hasAny && (!hero.label.trim() || !hero.href.trim() || !isSafeMenuHref(hero.href))) {
          throw new BadRequestException(`${department.departmentSlug} hero needs label and valid destination`)
        }
        if (
          hero.image.trim() &&
          !hero.image.trim().startsWith('/') &&
          !hero.image.trim().startsWith('https://') &&
          !hero.image.trim().startsWith('http://')
        ) {
          throw new BadRequestException(`${department.departmentSlug} hero image URL is invalid`)
        }
      }
    }

    const nextConfig: StorefrontConfig = {
      ...currentConfig,
      ...(body.branding?.storeImage !== undefined ? { storeImage: body.branding.storeImage } : {}),
      ...(body.branding?.storeLabel !== undefined ? { storeLabel: body.branding.storeLabel } : {}),
      ...(body.branding?.footerTagline !== undefined ? { footerTagline: body.branding.footerTagline } : {}),
      ...(body.branding?.footerCopyright !== undefined ? { footerCopyright: body.branding.footerCopyright } : {}),
      ...(headerNavPatch
        ? {
            headerNav: mergeHeaderNav(
              currentConfig.headerNav,
              headerNavPatch.map((item) => ({
                ...item,
                label: item.label.trim(),
                href: item.href.trim(),
              })),
            ),
          }
        : {}),
      ...(body.navigation?.footerGroups ? { footerGroups: body.navigation.footerGroups } : {}),
      ...(body.menuOverrides ? { menuOverrides: body.menuOverrides } : {}),
      ...(body.marquee ? { marquee: { ...currentConfig.marquee!, ...body.marquee } } : {}),
      ...(body.specialOffer ? { specialOffer: { ...currentConfig.specialOffer!, ...body.specialOffer } } : {}),
      ...(body.newsletter
        ? {
            newsletter: {
              ...currentConfig.newsletter!,
              ...body.newsletter,
              perks: body.newsletter.perks?.length
                ? body.newsletter.perks
                : currentConfig.newsletter!.perks,
            },
          }
        : {}),
      ...(body.ourStory
        ? {
            ourStory: {
              ...currentConfig.ourStory!,
              ...body.ourStory,
              pillars: body.ourStory.pillars?.length
                ? body.ourStory.pillars
                : currentConfig.ourStory!.pillars,
              storyDeckCards: mergeStoryDeckCards(
                body.ourStory.storyDeckCards?.length
                  ? body.ourStory.storyDeckCards
                  : currentConfig.ourStory!.storyDeckCards,
              ),
              customerStories: {
                ...currentConfig.ourStory!.customerStories,
                ...body.ourStory.customerStories,
                stories: [],
                rating: '',
                hint: '',
              },
            },
          }
        : {}),
      ...(body.homepage ? { homepage: { ...currentConfig.homepage!, ...body.homepage } } : {}),
      ...(body.catalogChannels
        ? { catalogChannels: mergeCatalogChannels(body.catalogChannels) }
        : {}),
      ...(body.shopFilters ? { shopFilters: mergeShopFilters(body.shopFilters) } : {}),
      ...(body.catalog ? { catalog: { ...currentConfig.catalog!, ...body.catalog } } : {}),
      ...(body.smtp
        ? {
            smtp: {
              ...currentConfig.smtp!,
              ...body.smtp,
              password: body.smtp.password?.trim()
                ? body.smtp.password
                : (currentConfig.smtp?.password ?? ''),
            },
          }
        : {}),
      ...(body.smtpAccounts
        ? {
            smtpAccounts: body.smtpAccounts.map((account) => {
              const existing = currentConfig.smtpAccounts?.find((item) => item.id === account.id)
              return {
                ...existing,
                ...account,
                password: account.password?.trim() ? account.password : (existing?.password ?? ''),
              }
            }),
          }
        : {}),
      ...(body.shipping &&
      (body.shipping.dhakaSameDay !== undefined || body.shipping.outsideDhaka !== undefined)
        ? {
            shippingZones: {
              dhakaSameDay:
                body.shipping.dhakaSameDay ?? currentConfig.shippingZones?.dhakaSameDay ?? true,
              outsideDhaka:
                body.shipping.outsideDhaka ?? currentConfig.shippingZones?.outsideDhaka ?? true,
            },
          }
        : {}),
    }

    const storePatch = {
      ...(body.store?.name !== undefined ? { name: body.store.name } : {}),
      ...(body.store?.email !== undefined ? { email: body.store.email } : {}),
      ...(body.contact?.email !== undefined ? { email: body.contact.email } : {}),
      ...(body.store?.phone !== undefined ? { phone: body.store.phone } : {}),
      ...(body.contact?.phone !== undefined ? { phone: body.contact.phone } : {}),
      ...(body.store?.domain !== undefined ? { domain: body.store.domain } : {}),
      ...(body.store?.currency !== undefined ? { currency: body.store.currency } : {}),
      ...(body.store?.timezone !== undefined ? { timezone: body.store.timezone } : {}),
      ...(body.store?.logo !== undefined ? { logo: body.store.logo } : {}),
      ...(body.branding?.logo !== undefined ? { logo: body.branding.logo } : {}),
      ...(body.store?.favicon !== undefined ? { favicon: body.store.favicon } : {}),
      ...(body.branding?.favicon !== undefined ? { favicon: body.branding.favicon } : {}),
      ...(body.store?.description !== undefined ? { description: body.store.description } : {}),
      ...(body.store?.address !== undefined ? { address: body.store.address } : {}),
      ...(body.contact?.address !== undefined ? { address: body.contact.address } : {}),
    }

    if (Object.keys(storePatch).length) {
      await this.prisma.store.update({ where: { id: store.id }, data: storePatch })
    }

    const paymentPatch = body.payments
    const shippingPatch = body.shipping
    const socialPatch = body.social
    const contactPatch = body.contact

    if (paymentPatch || shippingPatch || socialPatch || contactPatch || body.marquee || body.specialOffer || body.newsletter || body.ourStory || body.homepage || body.catalogChannels || body.shopFilters || body.catalog || body.navigation || body.branding || body.smtp || body.smtpAccounts || body.emailEnabled !== undefined || body.marketing) {
      await this.prisma.siteSettings.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          codEnabled: paymentPatch?.cod ?? true,
          bkashEnabled: paymentPatch?.bkash ?? false,
          sslcommerzEnabled: paymentPatch?.sslcommerz ?? false,
          nagadEnabled: paymentPatch?.nagad ?? false,
          freeDeliveryThreshold: shippingPatch?.freeShippingMin ? Number(shippingPatch.freeShippingMin) : 0,
          dhakaDeliveryCharge: shippingPatch?.dhakaDeliveryCharge ?? 60,
          outsideDhakaCharge: shippingPatch?.outsideDhakaCharge ?? 120,
          instagramUrl: socialPatch?.instagram ?? null,
          facebookUrl: socialPatch?.facebook ?? null,
          tiktokUrl: socialPatch?.tiktok ?? null,
          youtubeUrl: socialPatch?.youtube ?? null,
          whatsappNumber: contactPatch?.whatsapp ?? null,
          emailEnabled: body.emailEnabled ?? true,
          facebookPixelId: body.marketing?.facebookPixelId ?? null,
          googleAnalyticsId: body.marketing?.googleAnalyticsId ?? null,
          storefrontConfig: nextConfig as object,
        },
        update: {
          ...(paymentPatch?.cod !== undefined ? { codEnabled: paymentPatch.cod } : {}),
          ...(paymentPatch?.bkash !== undefined ? { bkashEnabled: paymentPatch.bkash } : {}),
          ...(paymentPatch?.sslcommerz !== undefined ? { sslcommerzEnabled: paymentPatch.sslcommerz } : {}),
          ...(paymentPatch?.nagad !== undefined ? { nagadEnabled: paymentPatch.nagad } : {}),
          ...(shippingPatch?.freeShippingMin !== undefined
            ? { freeDeliveryThreshold: Number(shippingPatch.freeShippingMin) }
            : {}),
          ...(shippingPatch?.dhakaDeliveryCharge !== undefined
            ? { dhakaDeliveryCharge: shippingPatch.dhakaDeliveryCharge }
            : {}),
          ...(shippingPatch?.outsideDhakaCharge !== undefined
            ? { outsideDhakaCharge: shippingPatch.outsideDhakaCharge }
            : {}),
          ...(socialPatch?.instagram !== undefined ? { instagramUrl: socialPatch.instagram || null } : {}),
          ...(socialPatch?.facebook !== undefined ? { facebookUrl: socialPatch.facebook || null } : {}),
          ...(socialPatch?.tiktok !== undefined ? { tiktokUrl: socialPatch.tiktok || null } : {}),
          ...(socialPatch?.youtube !== undefined ? { youtubeUrl: socialPatch.youtube || null } : {}),
          ...(contactPatch?.whatsapp !== undefined ? { whatsappNumber: contactPatch.whatsapp || null } : {}),
          ...(body.emailEnabled !== undefined ? { emailEnabled: body.emailEnabled } : {}),
          ...(body.marketing?.facebookPixelId !== undefined
            ? { facebookPixelId: body.marketing.facebookPixelId || null }
            : {}),
          ...(body.marketing?.googleAnalyticsId !== undefined
            ? { googleAnalyticsId: body.marketing.googleAnalyticsId || null }
            : {}),
          storefrontConfig: nextConfig as object,
        },
      })
    }

    if (body.smtp?.host && body.smtp.fromEmail) {
      fireAndForget(
        this.orderNotifications.onSmtpConfigured(store.id, {
          host: body.smtp.host,
          fromEmail: body.smtp.fromEmail,
          fromName: body.smtp.fromName || store.name,
        }),
        'settings.onSmtpConfigured',
      )
    }

    const refreshed = await this.resolveStore(storeId)

    // Always bust Redis settings cache after any admin write — TTL alone is not
    // enough after deploy or direct DB fixes.
    fireAndForget(this.purgeStorefrontCache(refreshed.id), 'settings.purgeStorefrontCache')
    fireAndForget(this.revalidateStorefrontWeb(), 'settings.revalidateStorefrontWeb')

    return await this.mapResponse(refreshed)
  }

  @Post('smtp/test')
  async testSmtp(@Query('storeId') storeId: string, @Query('accountId') accountId?: string) {
    const store = await this.resolveStore(storeId)
    const result = await this.emailService.verifySmtp(store.id, accountId)
    return result
  }
}
