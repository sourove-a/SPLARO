import { Body, Controller, Get, Inject, NotFoundException, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { EmailService } from '../email/email.service'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
import { DEFAULT_CATALOG_CHANNELS } from '@splaro/types'
import { emptyStorefrontConfig, mergeStorefrontConfig, mergeHeaderNav, mergeCatalogChannels, type StorefrontConfig } from './storefront-config'

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
    await this.cache.invalidateStoreResource(storeId, 'settings')
  }

  private async revalidateStorefrontWeb() {
    const base = process.env['WEB_URL'] ?? process.env['NEXT_PUBLIC_SITE_URL']
    const secret = process.env['REVALIDATE_SECRET']
    if (!base || !secret) return

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
        headerNav: config.headerNav ?? [],
        footerGroups: config.footerGroups ?? [],
      },
      marquee: config.marquee ?? { enabled: false, items: [] },
      specialOffer: config.specialOffer ?? { enabled: false, template: 'countdown', title: '', ctaLabel: 'Shop now', ctaHref: '/shop' },
      newsletter: config.newsletter ?? emptyStorefrontConfig().newsletter,
      ourStory: config.ourStory ?? emptyStorefrontConfig().ourStory,
      homepage: config.homepage ?? emptyStorefrontConfig().homepage,
      catalogChannels: mergeCatalogChannels(config.catalogChannels),
      catalog: {
        autoGenerateSku: config.catalog?.autoGenerateSku ?? false,
      },
      payments: {
        cod: settings?.codEnabled ?? true,
        bkash: settings?.bkashEnabled ?? true,
        sslcommerz: settings?.sslcommerzEnabled ?? true,
        nagad: settings?.nagadEnabled ?? true,
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
      marquee?: StorefrontConfig['marquee']
      specialOffer?: StorefrontConfig['specialOffer']
      newsletter?: StorefrontConfig['newsletter']
      ourStory?: StorefrontConfig['ourStory']
      homepage?: StorefrontConfig['homepage']
      catalogChannels?: StorefrontConfig['catalogChannels']
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
      emailEnabled?: boolean
      marketing?: {
        facebookPixelId?: string
        googleAnalyticsId?: string
      }
      telegram?: {
        botToken?: string
        chatId?: string
        isActive?: boolean
        notifyOrders?: boolean
        notifyPayments?: boolean
        notifyCourier?: boolean
        notifyStock?: boolean
        reportDaily?: boolean
      }
    },
  ) {
    const store = await this.resolveStore(storeId)
    const currentConfig = mergeStorefrontConfig(store.settings?.storefrontConfig)

    const nextConfig: StorefrontConfig = {
      ...currentConfig,
      ...(body.branding?.storeImage !== undefined ? { storeImage: body.branding.storeImage } : {}),
      ...(body.branding?.storeLabel !== undefined ? { storeLabel: body.branding.storeLabel } : {}),
      ...(body.branding?.footerTagline !== undefined ? { footerTagline: body.branding.footerTagline } : {}),
      ...(body.branding?.footerCopyright !== undefined ? { footerCopyright: body.branding.footerCopyright } : {}),
      ...(body.navigation?.headerNav
        ? { headerNav: mergeHeaderNav(currentConfig.headerNav, body.navigation.headerNav) }
        : {}),
      ...(body.navigation?.footerGroups ? { footerGroups: body.navigation.footerGroups } : {}),
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

    if (body.telegram) {
      const existing = await this.prisma.telegramConfig.findUnique({ where: { storeId: store.id } })
      const botToken = body.telegram.botToken?.trim()
      await this.prisma.telegramConfig.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          botToken: botToken || process.env.TELEGRAM_BOT_TOKEN || 'pending',
          chatId: body.telegram.chatId || '',
          isActive: body.telegram.isActive ?? false,
          notifyOrders: body.telegram.notifyOrders ?? true,
          notifyPayments: body.telegram.notifyPayments ?? true,
          notifyCourier: body.telegram.notifyCourier ?? true,
          notifyStock: body.telegram.notifyStock ?? true,
          reportDaily: body.telegram.reportDaily ?? true,
        },
        update: {
          ...(botToken ? { botToken } : {}),
          ...(body.telegram.chatId !== undefined ? { chatId: body.telegram.chatId } : {}),
          ...(body.telegram.isActive !== undefined ? { isActive: body.telegram.isActive } : {}),
          ...(body.telegram.notifyOrders !== undefined ? { notifyOrders: body.telegram.notifyOrders } : {}),
          ...(body.telegram.notifyPayments !== undefined ? { notifyPayments: body.telegram.notifyPayments } : {}),
          ...(body.telegram.notifyCourier !== undefined ? { notifyCourier: body.telegram.notifyCourier } : {}),
          ...(body.telegram.notifyStock !== undefined ? { notifyStock: body.telegram.notifyStock } : {}),
          ...(body.telegram.reportDaily !== undefined ? { reportDaily: body.telegram.reportDaily } : {}),
        },
      })
      await this.prisma.siteSettings.upsert({
        where: { storeId: store.id },
        create: { storeId: store.id, telegramEnabled: body.telegram.isActive ?? true },
        update: { telegramEnabled: body.telegram.isActive ?? existing?.isActive ?? true },
      })
    }

    if (paymentPatch || shippingPatch || socialPatch || contactPatch || body.marquee || body.specialOffer || body.newsletter || body.ourStory || body.homepage || body.catalogChannels || body.catalog || body.navigation || body.branding || body.smtp || body.emailEnabled !== undefined || body.marketing || body.telegram) {
      await this.prisma.siteSettings.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          codEnabled: paymentPatch?.cod ?? true,
          bkashEnabled: paymentPatch?.bkash ?? true,
          sslcommerzEnabled: paymentPatch?.sslcommerz ?? true,
          nagadEnabled: paymentPatch?.nagad ?? true,
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
      void this.orderNotifications.onSmtpConfigured(store.id, {
        host: body.smtp.host,
        fromEmail: body.smtp.fromEmail,
        fromName: body.smtp.fromName || store.name,
      })
    }

    const refreshed = await this.resolveStore(storeId)
    const shouldRefreshStorefront =
      Boolean(body.catalogChannels) ||
      Boolean(body.navigation) ||
      Boolean(body.branding) ||
      Boolean(body.homepage) ||
      Boolean(body.contact) ||
      Boolean(body.social) ||
      Boolean(body.store) ||
      Boolean(body.marketing) ||
      Boolean(body.shipping) ||
      Boolean(body.payments)

    if (shouldRefreshStorefront) {
      void this.purgeStorefrontCache(refreshed.id)
      void this.revalidateStorefrontWeb()
    }

    return await this.mapResponse(refreshed)
  }

  @Post('smtp/test')
  async testSmtp(@Query('storeId') storeId: string) {
    const store = await this.resolveStore(storeId)
    const result = await this.emailService.verifySmtp(store.id)
    return result
  }
}
