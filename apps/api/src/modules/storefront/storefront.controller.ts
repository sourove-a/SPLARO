import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Patch,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { LEGAL_PAGE_SLUGS } from '@splaro/types'
import { isFeatureEnabled } from '@splaro/config'
import { Public } from '../../common/auth/public.decorator'
import {
  CreateStorefrontOrderDto,
  NewsletterSubscribeDto,
  StorefrontCartAddItemDto,
  StorefrontCartReplaceDto,
  StorefrontForgotPasswordDto,
  StorefrontGoogleAuthDto,
  StorefrontCompletePhoneDto,
  StorefrontLoginDto,
  StorefrontOtpSendDto,
  StorefrontOtpVerifyDto,
  StorefrontResetPasswordDto,
  StorefrontSignupDto,
  StorefrontSubmitReviewDto,
} from '../../common/dtos/storefront.dto'
import { PrismaService } from '../../common/prisma.service'
import { CATALOG_CACHE_TTL } from '../../common/catalog-cache.constants'
import { buildCategoryTree, collectDescendantIds } from '../../common/category-tree.util'
import { CacheService } from '../../common/cache.service'
import {
  assertCartLineStock,
  CART_MAX_LINES,
  clampCartLineQuantity,
  resolveCartReplaceLines,
  resolveCartVariant,
} from '../../common/cart-line.util'
import { resolveStoreId } from '../../common/store.util'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'
import { serializePublicOrder, serializePublicOrders } from '../../common/public-order.util'
import { mergeStorefrontConfig } from '../settings/storefront-config'
import { NavBuilderService } from '../settings/nav-builder.service'
import { StorefrontOrdersService } from './storefront-orders.service'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
import { AdminTelegramHubService } from '../notifications/admin-telegram-hub.service'
import { EmailService } from '../email/email.service'
import { CustomersService } from '../customers/customers.service'
import { StorefrontAuthService } from './storefront-auth.service'
import { StorefrontWishlistService } from './storefront-wishlist.service'
import { StorefrontOtpService } from './storefront-otp.service'
import { InvoiceService } from '../invoices/invoice.service'
import { LegalPagesService } from '../content/legal-pages.service'
import { FootwearConfigService } from '../content/footwear-config.service'
import { PurgeDemoCatalogService } from '../catalog/purge-demo-catalog.service'
import { SeedDemoCatalogService } from '../catalog/seed-demo-catalog.service'
import { PaymentIntegrationService } from '../integrations/payment-integration.service'

function bearerToken(authorization?: string): string | undefined {
  return authorization?.replace(/^Bearer\s+/i, '').trim() || undefined
}

function sessionFromHeaders(
  authorization?: string,
  sessionHeader?: string,
): string | undefined {
  return sessionHeader?.trim() || bearerToken(authorization)
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim()
  return req.ip
}

@Public()
@ApiTags('storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly storefrontOrders: StorefrontOrdersService,
    private readonly cache: CacheService,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly telegramHub: AdminTelegramHubService,
    private readonly email: EmailService,
    private readonly customers: CustomersService,
    private readonly storefrontAuth: StorefrontAuthService,
    private readonly storefrontWishlist: StorefrontWishlistService,
    private readonly storefrontOtp: StorefrontOtpService,
    private readonly invoices: InvoiceService,
    private readonly legalPages: LegalPagesService,
    private readonly footwearConfig: FootwearConfigService,
    private readonly purgeDemoCatalog: PurgeDemoCatalogService,
    private readonly seedDemoCatalog: SeedDemoCatalogService,
    private readonly navBuilder: NavBuilderService,
    private readonly paymentIntegration: PaymentIntegrationService,
  ) {}

  @Get('nav')
  async getNav(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'nav'), 60, async () => {
      const store = await this.prisma.store.findUnique({
        where: { id: sid },
        include: { settings: true },
      })
      if (!store) throw new NotFoundException('Store not found')
      const config = mergeStorefrontConfig(store.settings?.storefrontConfig)
      const headerNav = await this.navBuilder.buildStorefrontNav(sid, config)
      return { headerNav }
    })
  }

  @Get('settings')
  async getSettings(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'settings'), 120, async () => {
      const store = await this.prisma.store.findUnique({
        where: { id: sid },
        include: { settings: true },
      })
      if (!store) throw new NotFoundException('Store not found')

      const config = mergeStorefrontConfig(store.settings?.storefrontConfig)
      const settings = store.settings
      const [bkashConfigured, nagadConfigured, sslcommerzConfigured] = await Promise.all([
        this.paymentIntegration.isConfigured(sid, 'bkash').catch(() => false),
        this.paymentIntegration.isConfigured(sid, 'nagad').catch(() => false),
        this.paymentIntegration.isConfigured(sid, 'sslcommerz').catch(() => false),
      ])

      return {
        store: {
          name: store.name,
          logo: store.logo ?? '',
          favicon: store.favicon ?? '',
          email: store.email,
          phone: store.phone ?? '',
          address: store.address ?? '',
        },
        social: {
          instagram: settings?.instagramUrl ?? '',
          facebook: settings?.facebookUrl ?? '',
          tiktok: settings?.tiktokUrl ?? '',
          youtube: settings?.youtubeUrl ?? '',
          whatsapp: settings?.whatsappNumber ?? '',
        },
        shipping: {
          freeDeliveryThreshold: Number(settings?.freeDeliveryThreshold ?? 0),
          dhakaDeliveryCharge: Number(settings?.dhakaDeliveryCharge ?? 60),
          outsideDhakaCharge: Number(settings?.outsideDhakaCharge ?? 120),
        },
        payments: {
          cod: settings?.codEnabled ?? true,
          bkash: Boolean(settings?.bkashEnabled) && bkashConfigured,
          nagad: Boolean(settings?.nagadEnabled) && nagadConfigured,
          sslcommerz: Boolean(settings?.sslcommerzEnabled) && sslcommerzConfigured,
        },
        marketing: {
          facebookPixelId: settings?.facebookPixelId ?? '',
          googleAnalyticsId: settings?.googleAnalyticsId ?? '',
        },
        config,
      }
    })
  }

  /** Checkout BFF only — 3 numbers, no payment probes / storefrontConfig merge. */
  @Public()
  @Get('shipping')
  async getShipping(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'shipping'), 120, async () => {
      const settings = await this.prisma.siteSettings.findUnique({
        where: { storeId: sid },
        select: {
          freeDeliveryThreshold: true,
          dhakaDeliveryCharge: true,
          outsideDhakaCharge: true,
        },
      })
      return {
        freeDeliveryThreshold: Number(settings?.freeDeliveryThreshold ?? 0),
        dhakaDeliveryCharge: Number(settings?.dhakaDeliveryCharge ?? 60),
        outsideDhakaCharge: Number(settings?.outsideDhakaCharge ?? 120),
      }
    })
  }

  @Get('legal-pages/:slug')
  async getLegalPage(@Query('storeId') storeId: string, @Param('slug') slug: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'legal-pages', slug), 120, async () =>
      this.legalPages.getPublished(sid, slug),
    )
  }

  @Public()
  @Get('footwear')
  getFootwearPage(@Query('storeId') storeId: string) {
    return this.footwearConfig.get(storeId)
  }

  @Public()
  @Get('redirects')
  async listRedirects(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'redirects'), 60, async () => {
      const redirects = await this.prisma.urlRedirect.findMany({
        where: { storeId: sid, isActive: true },
        select: { fromPath: true, toPath: true, type: true },
        orderBy: { createdAt: 'asc' },
      })
      return { redirects }
    })
  }

  @Public()
  @Get('landing-pages/:slug')
  async getLandingPage(@Query('storeId') storeId: string, @Param('slug') slug: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    if ((LEGAL_PAGE_SLUGS as readonly string[]).includes(slug)) {
      throw new NotFoundException('Landing page not found')
    }
    return this.cache.getOrSet(this.cache.storeKey(sid, 'landing-pages', slug), 120, async () => {
      const page = await this.prisma.sitePage.findUnique({
        where: { storeId_slug: { storeId: sid, slug } },
      })
      if (!page?.isPublished || page.isHomepage) {
        throw new NotFoundException('Landing page not found')
      }
      return page
    })
  }

  @Get('products')
  async listProducts(
    @Query('storeId') storeId: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('parentCategorySlug') parentCategorySlug?: string,
    @Query('collectionSlug') collectionSlug?: string,
    @Query('limit') limitParam?: string,
    @Query('page') pageParam?: string,
    @Query('ids') idsParam?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const ids = idsParam
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    if (ids?.length) {
      const sortedIds = [...ids].sort().join(',')
      const cacheKey = this.cache.storeKey(sid, 'products', `ids:${sortedIds}`)
      return this.cache.getOrSet(cacheKey, CATALOG_CACHE_TTL.productIds, async () => {
        const products = await this.prisma.product.findMany({
          where: storefrontVisibleProductWhere({ storeId: sid, id: { in: ids } }),
          include: {
            images: { orderBy: { position: 'asc' as const } },
            variants: { where: { isActive: true } },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                parent: { select: { name: true, slug: true } },
              },
            },
          },
        })
        const order = new Map(ids.map((id, index) => [id, index]))
        products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        return { products, total: products.length }
      })
    }

    const category = categorySlug?.trim() || undefined
    const parentCategory = parentCategorySlug?.trim() || undefined
    const collection = collectionSlug?.trim() || undefined
    const filtered = Boolean(
      category || parentCategory || collection || limitParam !== undefined || pageParam !== undefined,
    )
    const limit = Math.min(Math.max(Number(limitParam) || 40, 1), 100)
    const page = Math.max(Number(pageParam) || 1, 1)

    // Tree filter (any depth). Prefer parentCategorySlug — never slug "startsWith"
    // (that pulled men-footwear into /c/men). Unknown slug → empty set, not full catalog.
    const treeSlug = parentCategory ?? category
    let categoryIds: string[] | undefined
    if (treeSlug) {
      const flat = await this.prisma.category.findMany({
        where: { storeId: sid },
        select: { id: true, parentId: true, slug: true },
      })
      const root = flat.find((entry) => entry.slug === treeSlug)
      categoryIds = root ? collectDescendantIds(flat, root.id) : []
    }

    const where = storefrontVisibleProductWhere({
      storeId: sid,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(collection
        ? {
            collections: {
              some: {
                collection: {
                  slug: collection,
                  storeId: sid,
                },
              },
            },
          }
        : {}),
    })

    const productInclude = {
      images: { orderBy: { position: 'asc' as const } },
      variants: { where: { isActive: true } },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          parent: { select: { name: true, slug: true } },
        },
      },
    }

    const load = async () => {
      if (!filtered) {
        const products = await this.prisma.product.findMany({
          where,
          include: productInclude,
          orderBy: { createdAt: 'desc' },
        })
        return { products, total: products.length }
      }

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: productInclude,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
        }),
        this.prisma.product.count({ where }),
      ])

      return {
        products,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 0,
      }
    }

    if (!filtered) {
      return this.cache.getOrSet(this.cache.storeKey(sid, 'products'), CATALOG_CACHE_TTL.products, load)
    }

    const cacheKey = `${this.cache.storeKey(sid, 'products')}:treev2:cat:${category ?? ''}:parent:${parentCategory ?? ''}:col:${collection ?? ''}:p${page}:l${limit}`
    return this.cache.getOrSet(cacheKey, CATALOG_CACHE_TTL.products, load)
  }

  @Get('products/:slug')
  async getProduct(@Query('storeId') storeId: string, @Param('slug') slug: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(
      this.cache.storeKey(sid, 'product', slug),
      CATALOG_CACHE_TTL.productDetail,
      async () => {
        const product = await this.prisma.product.findFirst({
          where: storefrontVisibleProductWhere({ storeId: sid, slug }),
          include: {
            images: { orderBy: { position: 'asc' } },
            variants: { where: { isActive: true } },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                parent: { select: { name: true, slug: true } },
              },
            },
            reviews: {
              where: { status: 'APPROVED' },
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: {
                id: true,
                rating: true,
                title: true,
                body: true,
                verifiedPurchase: true,
                helpfulCount: true,
                adminReply: true,
                adminReplyAt: true,
                createdAt: true,
                customer: { select: { firstName: true, lastName: true } },
              },
            },
          },
        })
        if (!product) throw new NotFoundException('Product not found')
        return { product }
      },
    )
  }

  @Get('customer/profile')
  async getCustomerProfile(
    @Query('storeId') storeId: string,
    @Query('phone') phone: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
    @Headers('x-splaro-phone-access') phoneAccess?: string,
  ) {
    if (!phone?.trim()) return { customer: null }
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    const sessionPhone = sessionToken
      ? await this.storefrontAuth.sessionPhone(sessionToken)
      : null
    await this.storefrontOtp.assertPhoneAccess(sid, phone, phoneAccess, sessionPhone)

    const normalized = phone.replace(/\D/g, '').slice(-10)
    const customer = await this.prisma.customer.findFirst({
      where: {
        storeId: sid,
        phone: { contains: normalized },
      },
      select: {
        loyaltyPoints: true,
        loyaltyTier: true,
        totalOrders: true,
        createdAt: true,
      },
    })
    return { customer }
  }

  // ── Customer auth ──────────────────────────────────────────

  @Post('auth/signup')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async authSignup(
    @Query('storeId') storeId: string,
    @Body() body: StorefrontSignupDto,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const result = await this.storefrontAuth.signup(sid, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
    })

    void this.telegramHub.notifyCustomerRegistered(sid, {
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      source: 'Website signup',
    })

    return result
  }

  @Post('auth/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async authLogin(
    @Query('storeId') storeId: string,
    @Body() body: StorefrontLoginDto,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.storefrontAuth.login(sid, {
      identifier: body.email,
      password: body.password,
    })
  }

  @Post('auth/google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async authGoogle(
    @Query('storeId') storeId: string,
    @Body() body: StorefrontGoogleAuthDto,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const result = await this.storefrontAuth.googleSignIn(sid, body.credential)

    if (!result.needsPhone) {
      void this.telegramHub.notifyCustomerRegistered(sid, {
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        source: 'Google signup',
      })
    }

    return result
  }

  @Post('auth/complete-phone')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async authCompletePhone(
    @Query('storeId') storeId: string,
    @Body() body: StorefrontCompletePhoneDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')

    const result = await this.storefrontAuth.completePhone(sid, sessionToken, {
      phone: body.phone,
      ...(body.code ? { code: body.code } : {}),
    })

    void this.telegramHub.notifyCustomerRegistered(sid, {
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      source: 'Google signup',
    })

    return result
  }

  @Public()
  @Post('auth/forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async authForgotPassword(
    @Query('storeId') storeId: string,
    @Body() body: StorefrontForgotPasswordDto,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.storefrontAuth.forgotPassword(sid, body.email)
  }

  @Public()
  @Post('auth/reset-password')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async authResetPassword(@Body() body: StorefrontResetPasswordDto) {
    return this.storefrontAuth.resetPassword(body.token, body.password)
  }

  @Get('auth/me')
  async authMe(
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Session expired')
    return { user }
  }

  @Patch('auth/profile')
  async updateProfile(
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
    @Body() body?: { name?: string; avatar?: string | null },
  ) {
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.updateProfile(sessionToken, {
      ...(body?.name !== undefined ? { name: body.name } : {}),
      ...(body?.avatar !== undefined ? { avatar: body.avatar } : {}),
    })
    return { user }
  }

  @Post('auth/email-verification/send')
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  async sendEmailVerification(
    @Query('storeId') storeId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    try {
      const result = await this.storefrontAuth.sendEmailVerification(sid, sessionToken)
      if (result.expiresIn > 0) {
        const user = await this.storefrontAuth.validateSession(sessionToken)
        if (user) {
          void this.telegramHub.notifyCustomerEmailVerification(sid, {
            name: user.name,
            email: user.email,
            status: 'REQUESTED',
          })
        }
      }
      return result
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        void this.telegramHub.notifyAdminError(
          sid,
          'Customer Verification Email Failed',
          error.message,
          { area: 'Storefront email verification' },
        )
      }
      throw error
    }
  }

  @Post('auth/email-verification/verify')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async verifyEmail(
    @Query('storeId') storeId: string,
    @Body() body: { code?: string },
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const result = await this.storefrontAuth.verifyEmail(sid, sessionToken, body.code ?? '')
    void this.telegramHub.notifyCustomerEmailVerification(sid, {
      name: result.user.name,
      email: result.user.email,
      status: 'VERIFIED',
    })
    return result
  }

  @Get('customer/address')
  async getCustomerAddress(
    @Query('storeId') storeId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Session expired')
    const customerId = await this.storefrontAuth.ensureCustomerId(user, sid)
    const saved = await this.storefrontAuth.getDefaultAddress(customerId)
    if (!saved) return { address: null }

    return {
      address: {
        address: saved.addressLine1,
        district: saved.district,
        thana: saved.city,
      },
    }
  }

  @Patch('customer/address')
  async updateCustomerAddress(
    @Query('storeId') storeId: string,
    @Body() body: { address?: string; district?: string; thana?: string },
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Session expired')
    const customerId = await this.storefrontAuth.ensureCustomerId(user, sid)

    const saved = await this.storefrontAuth.saveDefaultAddress(customerId, user, {
      address: body.address ?? '',
      district: body.district ?? '',
      thana: body.thana ?? '',
    })

    return {
      address: {
        address: saved.addressLine1,
        district: saved.district,
        thana: saved.city,
      },
    }
  }

  @Get('customer/wishlist')
  async getWishlist(
    @Query('storeId') storeId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Not signed in')
    const customerId = await this.storefrontAuth.ensureCustomerId(user, sid)

    const productIds = await this.storefrontWishlist.listProductIds(customerId)
    return { productIds }
  }

  @Post('customer/wishlist/merge')
  async mergeWishlist(
    @Query('storeId') storeId: string,
    @Body() body: { productIds?: string[] },
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Not signed in')
    const customerId = await this.storefrontAuth.ensureCustomerId(user, sid)

    const productIds = await this.storefrontWishlist.merge(customerId, body.productIds ?? [])
    return { productIds }
  }

  @Post('customer/wishlist/toggle')
  async toggleWishlist(
    @Query('storeId') storeId: string,
    @Body() body: { productId?: string },
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Not signed in')
    const customerId = await this.storefrontAuth.ensureCustomerId(user, sid)

    return this.storefrontWishlist.toggle(sid, customerId, body.productId ?? '')
  }

  @Post('auth/logout')
  async authLogout(
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (sessionToken) await this.storefrontAuth.logout(sessionToken)
    return { ok: true }
  }

  @Post('auth/otp/send')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async sendOtp(@Query('storeId') storeId: string, @Body() body: StorefrontOtpSendDto) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.storefrontOtp.sendOtp(sid, body.phone)
  }

  @Post('auth/otp/verify')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async verifyOtp(@Query('storeId') storeId: string, @Body() body: StorefrontOtpVerifyDto) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.storefrontOtp.verifyOtp(sid, body.phone, body.code)
  }

  @Post('orders')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async createOrder(
    @Query('storeId') storeId: string,
    @Body() body: CreateStorefrontOrderDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId ?? storeId)
    const requestIdempotencyKey = (body.idempotencyKey ?? idempotencyKey)?.trim()
    if (
      !requestIdempotencyKey ||
      requestIdempotencyKey.length < 16 ||
      requestIdempotencyKey.length > 80 ||
      !/^[A-Za-z0-9_-]+$/.test(requestIdempotencyKey)
    ) {
      throw new BadRequestException('A valid idempotency key is required')
    }
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    const user = sessionToken
      ? await this.storefrontAuth.validateSession(sessionToken)
      : null
    const normalizedMethod = body.paymentMethod.trim().toLowerCase()
    const isCod =
      normalizedMethod === 'cod' ||
      normalizedMethod === 'cash' ||
      normalizedMethod === 'cash_on_delivery' ||
      normalizedMethod === 'cash on delivery'
    if (!user && !isCod) {
      throw new UnauthorizedException('Sign in to use digital payment')
    }
    const customerId = user
      ? await this.storefrontAuth.ensureCustomerId(user, sid)
      : undefined

    const order = await this.storefrontOrders.create({
      ...body,
      storeId: body.storeId ?? storeId,
      ...(customerId ? { customerId } : {}),
      idempotencyKey: requestIdempotencyKey,
      clientIp: clientIp(req),
      userAgent: req.headers['user-agent'],
    })
    return { order: serializePublicOrder(order) }
  }

  @Get('customer/orders')
  async listCustomerOrders(
    @Query('storeId') storeId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Session expired')
    const sid = await resolveStoreId(this.prisma, storeId)
    const customerId = await this.storefrontAuth.ensureCustomerId(user, sid)
    const orders = await this.storefrontOrders.listForCustomer(sid, customerId)
    return { orders: serializePublicOrders(orders) }
  }

  @Post('orders/payment-event')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async paymentEvent(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      invoiceNumber: string
      status: 'started' | 'returned' | 'failed'
      gateway?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    if (!body.invoiceNumber?.trim()) {
      throw new BadRequestException('invoiceNumber is required')
    }
    await this.orderNotifications.onPaymentRedirect(sid, {
      invoiceNumber: body.invoiceNumber.trim(),
      status: body.status,
      gateway: body.gateway,
    })
    return { ok: true }
  }

  @Get('orders/track')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async trackOrders(
    @Query('storeId') storeId: string,
    @Query('phone') phone: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
    @Headers('x-splaro-phone-access') phoneAccess?: string,
  ) {
    if (!phone) throw new BadRequestException('phone is required')
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    const sessionPhone = sessionToken
      ? await this.storefrontAuth.sessionPhone(sessionToken)
      : null
    await this.storefrontOtp.assertPhoneAccess(sid, phone, phoneAccess, sessionPhone)

    const orders = await this.storefrontOrders.listForUser(storeId, phone)
    return { orders: serializePublicOrders(orders) }
  }

  @Get('orders/:id/invoice')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async orderInvoiceHtml(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Query('key') key?: string,
    @Query('phone') phone?: string,
    @Query('autoPrint') autoPrint?: string,
  ) {
    if (!key && !phone) {
      throw new BadRequestException('key or phone is required')
    }
    const order = await this.storefrontOrders.findForStorefrontAccess(storeId, id, {
      ...(key ? { key } : {}),
      ...(phone ? { phone } : {}),
    })
    if (!order) throw new NotFoundException('Order not found')
    return this.invoices.buildHtml(order.id, {
      showToolbar: true,
      autoPrint:
        isFeatureEnabled('printAuto') && (autoPrint === '1' || autoPrint === 'true'),
    })
  }

  @Get('orders/:id')
  async getOrder(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Query('key') key?: string,
    @Query('phone') phone?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
    @Headers('x-splaro-phone-access') phoneAccess?: string,
  ) {
    if (!key && !phone) {
      throw new BadRequestException('key or phone is required')
    }
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    const sessionPhone = sessionToken
      ? await this.storefrontAuth.sessionPhone(sessionToken)
      : null
    if (phone) {
      await this.storefrontOtp.assertPhoneAccess(sid, phone, phoneAccess, sessionPhone)
    }
    const order = await this.storefrontOrders.findForStorefrontAccess(storeId, id, {
      ...(key ? { key } : {}),
      ...(phone ? { phone } : {}),
    })
    if (!order) throw new NotFoundException('Order not found')
    return { order: serializePublicOrder(order) }
  }

  @Post('newsletter/subscribe')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async subscribeNewsletter(
    @Query('storeId') storeId: string,
    @Body() body: NewsletterSubscribeDto,
  ) {
    const email = body.email.trim().toLowerCase()

    const sid = await resolveStoreId(this.prisma, storeId)
    const config = mergeStorefrontConfig(
      (
        await this.prisma.siteSettings.findUnique({
          where: { storeId: sid },
          select: { storefrontConfig: true },
        })
      )?.storefrontConfig,
    )

    if (config.newsletter?.enabled === false) {
      throw new BadRequestException('Newsletter signups are currently closed.')
    }

    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { storeId_email: { storeId: sid, email } },
      create: { storeId: sid, email, source: 'homepage', status: 'active' },
      update: { status: 'active', updatedAt: new Date() },
      select: { id: true, email: true, createdAt: true },
    })

    return { ok: true, subscriber }
  }

  @Post('contact')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submitContact(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      name?: string
      email?: string
      phone?: string
      contact?: string
      subject?: string
      message?: string
    },
  ) {
    const name = body.name?.trim() ?? ''
    const message = body.message?.trim() ?? ''
    const subject = body.subject?.trim() ?? ''

    if (name.length < 2) {
      throw new BadRequestException('Enter your full name.')
    }
    if (message.length < 10) {
      throw new BadRequestException('Message must be at least 10 characters.')
    }

    let email = body.email?.trim().toLowerCase() ?? ''
    let phone = body.phone?.replace(/\D/g, '') ?? ''
    const contact = body.contact?.trim() ?? ''

    if (!email && !phone && contact) {
      if (contact.includes('@')) {
        email = contact.toLowerCase()
      } else {
        phone = contact.replace(/\D/g, '')
      }
    }

    if (!email && !phone) {
      throw new BadRequestException('Enter a valid email or phone number.')
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.')
    }
    if (phone && phone.length < 10) {
      throw new BadRequestException('Enter a valid phone number.')
    }

    const sid = await resolveStoreId(this.prisma, storeId)
    const sent = await this.telegramHub.notifyContactFormSubmission(sid, {
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(subject ? { subject } : {}),
      message,
    })

    if (!sent) {
      const store = await this.prisma.store.findUnique({ where: { id: sid } })
      const supportEmail = store?.email?.trim() || 'support@splaro.co'
      const subjectLine = subject
        ? `[Contact] ${subject} — ${name}`
        : `[Contact] Website message — ${name}`
      const textBody = [
        `Name: ${name}`,
        email ? `Email: ${email}` : null,
        phone ? `Phone: ${phone}` : null,
        subject ? `Subject: ${subject}` : null,
        '',
        message,
        '',
        '— splaro.co/contact',
      ]
        .filter(Boolean)
        .join('\n')

      const emailed = await this.email.sendForStore({
        storeId: sid,
        to: supportEmail,
        subject: subjectLine,
        html: textBody.replace(/\n/g, '<br>'),
        text: textBody,
        transactional: true,
      })

      if (!emailed) {
        throw new ServiceUnavailableException(
          'Support messaging is temporarily unavailable. Please use WhatsApp or call us directly.',
        )
      }
    }

    return { ok: true, message: 'Message sent — our team will reply shortly.' }
  }

  @Get('banners')
  async listBanners(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'banners'), 60, async () => {
      const now = new Date()
      const banners = await this.prisma.banner.findMany({
        where: {
          storeId: sid,
          isActive: true,
          position: 'hero',
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          subtitle: true,
          image: true,
          mobileImage: true,
          linkUrl: true,
          sortOrder: true,
        },
      })
      return { banners, total: banners.length }
    })
  }

  // ── Categories & Collections ───────────────────────────────

  @Get('categories')
  async listCategories(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'categories'), CATALOG_CACHE_TTL.categories, async () => {
      const categories = await this.prisma.category.findMany({
        where: { storeId: sid, isActive: true },
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: 'asc' },
      })
      return { categories, tree: buildCategoryTree(categories) }
    })
  }

  @Get('collections')
  async listCollections(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'collections'), CATALOG_CACHE_TTL.collections, async () => {
      const collections = await this.prisma.collection.findMany({
        where: { storeId: sid, isActive: true },
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: 'asc' },
      })
      return { collections }
    })
  }

  // ── Navigation / Menus ─────────────────────────────────────

  @Get('menu/:handle')
  async getMenu(@Query('storeId') storeId: string, @Param('handle') handle: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(`${this.cache.storeKey(sid, 'menu')}:${handle}`, 120, async () => {
      const menu = await this.prisma.menu.findUnique({
        where: { storeId_handle: { storeId: sid, handle } },
        include: {
          items: {
            where: { parentId: null, isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
          },
        },
      })
      return { menu }
    })
  }

  // ── Cart ───────────────────────────────────────────────────

  @Get('cart/:sessionId')
  async getCart(@Query('storeId') storeId: string, @Param('sessionId') sessionId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let cart = await this.prisma.cartSession.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: {
            product: { include: { images: { take: 1 } } },
            variant: true,
          },
        },
      },
    })

    if (!cart) {
      cart = await this.prisma.cartSession.create({
        data: {
          sessionId,
          storeId: sid,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        include: { items: { include: { product: { include: { images: { take: 1 } } }, variant: true } } },
      })
    }

    return { cart }
  }

  @Post('cart/:sessionId/items')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async addToCart(
    @Query('storeId') storeId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: StorefrontCartAddItemDto,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)

    const product = await this.prisma.product.findFirst({
      where: storefrontVisibleProductWhere({ id: body.productId, storeId: sid }),
      select: { id: true, name: true },
    })
    if (!product) throw new NotFoundException('Product not found or no longer available')

    const variantIdInput = body.variantId?.trim() || null
    const variant = await resolveCartVariant(this.prisma, sid, body.productId, variantIdInput, {
      size: body.size,
      color: body.color,
    })
    if (!variant) throw new NotFoundException('Product variant not found')

    const qty = clampCartLineQuantity(body.quantity)

    const cart = await this.prisma.cartSession.upsert({
      where: { sessionId },
      create: { sessionId, storeId: sid, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      update: { updatedAt: new Date() },
    })

    const existing = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: body.productId,
        variantId: variant.id,
      },
    })

    const nextQty = clampCartLineQuantity((existing?.quantity ?? 0) + qty)
    assertCartLineStock(product.name, nextQty, variant.stock)

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
      })
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: body.productId,
          variantId: variant.id,
          quantity: nextQty,
        },
      })
    }

    return this.getCart(storeId, sessionId)
  }

  /**
   * Atomically replace the cart contents. Unlike clear-then-add from the
   * client, this runs in one transaction so a mid-sync failure can never
   * leave the server cart wiped.
   */
  @Put('cart/:sessionId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async replaceCart(
    @Query('storeId') storeId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: StorefrontCartReplaceDto,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const requested = Array.isArray(body.items) ? body.items.slice(0, CART_MAX_LINES) : []

    // Batch resolve — invalid lines skipped (stale local item never blocks sync).
    const validated = await resolveCartReplaceLines(this.prisma, sid, requested)

    // Merge duplicate product+variant lines before createMany — otherwise
    // @@unique([cartId, productId, variantId]) throws P2002 → HTTP 500.
    const merged = new Map<string, { productId: string; variantId: string; quantity: number }>()
    for (const line of validated) {
      const key = `${line.productId}:${line.variantId}`
      const existing = merged.get(key)
      if (existing) {
        existing.quantity = clampCartLineQuantity(existing.quantity + line.quantity)
      } else {
        merged.set(key, { ...line })
      }
    }
    const lines = [...merged.values()]

    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cartSession.upsert({
        where: { sessionId },
        create: { sessionId, storeId: sid, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        update: { updatedAt: new Date() },
      })
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      if (lines.length) {
        await tx.cartItem.createMany({
          data: lines.map((item) => ({ cartId: cart.id, ...item })),
        })
      }
    })

    return this.getCart(storeId, sessionId)
  }

  @Delete('cart/:sessionId/items/:itemId')
  async removeFromCart(@Param('sessionId') sessionId: string, @Param('itemId') itemId: string, @Query('storeId') storeId: string) {
    const cart = await this.prisma.cartSession.findUnique({ where: { sessionId } })
    if (!cart) throw new NotFoundException('Cart not found')
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } })
    return this.getCart(storeId, sessionId)
  }

  @Post('cart/:sessionId/clear')
  async clearCart(@Param('sessionId') sessionId: string) {
    const cart = await this.prisma.cartSession.findUnique({ where: { sessionId } })
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    return { cleared: true }
  }

  // ── Reviews ────────────────────────────────────────────────

  @Get('reviews')
  async listApprovedReviews(
    @Query('storeId') storeId: string,
    @Query('limit') limitStr?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const limit = Math.min(20, Math.max(1, Number(limitStr) || 10))
    const productWhere = storefrontVisibleProductWhere({ storeId: sid })
    const reviewWhere = { status: 'APPROVED' as const, product: productWhere }

    const [reviews, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: reviewWhere,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          verifiedPurchase: true,
          helpfulCount: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.review.aggregate({
        where: reviewWhere,
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ])

    const reviewCount = aggregate._count._all
    const aggregateRating =
      reviewCount > 0 && aggregate._avg.rating != null
        ? Math.round(aggregate._avg.rating * 10) / 10
        : null

    return {
      reviews: reviews
        .map((review) => {
          const text = review.body?.trim() || review.title?.trim() || ''
          if (!text) return null
          const firstName = review.customer?.firstName?.trim() || ''
          const lastName = review.customer?.lastName?.trim() || ''
          const customerName = firstName
            ? `${firstName}${lastName ? ` ${lastName.charAt(0)}.` : ''}`.trim()
            : 'Verified buyer'
          const avatar = (firstName.charAt(0) || 'V').toUpperCase()
          return {
            id: review.id,
            rating: review.rating,
            title: review.title,
            body: text,
            verifiedPurchase: review.verifiedPurchase,
            helpfulCount: review.helpfulCount,
            createdAt: review.createdAt.toISOString(),
            customerName,
            avatar,
            product: review.product,
          }
        })
        .filter((review): review is NonNullable<typeof review> => review !== null),
      aggregateRating,
      reviewCount,
    }
  }

  @Post('reviews')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submitReview(
    @Query('storeId') storeId: string,
    @Body() body: StorefrontSubmitReviewDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Sign in to leave a review')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Sign in to leave a review')
    const customerId = await this.storefrontAuth.ensureCustomerId(user, sid)

    if (!body.productId || !body.rating) throw new BadRequestException('productId and rating required')
    if (body.rating < 1 || body.rating > 5) throw new BadRequestException('Rating must be 1-5')

    const text = body.body?.trim()
    if (!text || text.length < 10) {
      throw new BadRequestException('Review must be at least 10 characters')
    }

    const product = await this.prisma.product.findFirst({
      where: storefrontVisibleProductWhere({ id: body.productId, storeId: sid }),
      select: { id: true, name: true, slug: true },
    })
    if (!product) throw new NotFoundException('Product not found')

    const existing = await this.prisma.review.findFirst({
      where: { productId: body.productId, customerId },
    })
    if (existing) throw new BadRequestException('You have already reviewed this product')

    const purchase = await this.prisma.orderItem.findFirst({
      where: {
        productId: body.productId,
        order: {
          customerId,
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      select: { id: true },
    })

    const review = await this.prisma.review.create({
      data: {
        productId: body.productId,
        customerId,
        rating: body.rating,
        title: body.title?.trim() || null,
        body: text,
        verifiedPurchase: Boolean(purchase),
        status: 'PENDING',
      },
    })

    void this.telegramHub.notifyNewReview(sid, {
      productName: product.name,
      productSlug: product.slug,
      customerName: user.name,
      rating: body.rating,
      excerpt: text,
      verifiedPurchase: Boolean(purchase),
    })

    return {
      review: {
        id: review.id,
        status: review.status,
        message: 'Review submitted — it will appear after approval',
      },
    }
  }

  @Post('reviews/:id/helpful')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async markReviewHelpful(@Param('id') id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, status: 'APPROVED' },
      select: { id: true, helpfulCount: true },
    })
    if (!review) throw new NotFoundException('Review not found')

    const updated = await this.prisma.review.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
      select: { id: true, helpfulCount: true },
    })
    return { review: updated }
  }

  // ── Search ─────────────────────────────────────────────────

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async search(
    @Query('storeId') storeId: string,
    @Query('q') q: string,
    @Query('limit') limit = 20,
  ) {
    if (!q?.trim()) return { products: [], total: 0 }
    const sid = await resolveStoreId(this.prisma, storeId)
    const term = q.trim()

    const products = await this.prisma.product.findMany({
      where: storefrontVisibleProductWhere({
        storeId: sid,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { tags: { has: term } },
          { category: { name: { contains: term, mode: 'insensitive' } } },
        ],
      }),
      include: { images: { take: 1 }, variants: { take: 1, where: { isActive: true } } },
      take: Number(limit),
      orderBy: { soldCount: 'desc' },
    })

    return { products, total: products.length, query: term }
  }

  @Post('events/customer-signup')
  async customerSignupEvent(
    @Query('storeId') storeId: string,
    @Req() req: Request,
    @Body() body: { name?: string; email?: string; phone?: string; source?: string; passwordHash?: string },
  ) {
    this.assertInternalEventAuth(req)

    const sid = await resolveStoreId(this.prisma, storeId)
    const name = body.name?.trim()
    const email = body.email?.trim()
    const phone = body.phone?.trim()
    if (!name || !email || !phone) {
      throw new BadRequestException('name, email, and phone are required')
    }

    const customer = await this.customers.registerFromSignup(sid, {
      name,
      email,
      phone,
      passwordHash: body.passwordHash,
      source: body.source ?? 'Website signup',
    })

    void this.telegramHub.notifyCustomerRegistered(sid, {
      name,
      email,
      phone,
      source: body.source ?? 'Website',
    })

    return { ok: true, customerId: customer.id }
  }

  @Post('events/api-error')
  async apiErrorEvent(
    @Query('storeId') storeId: string,
    @Req() req: Request,
    @Body() body: { area?: string; detail?: string },
  ) {
    this.assertInternalEventAuth(req)

    const sid = await resolveStoreId(this.prisma, storeId)
    void this.telegramHub.notifyApiConnectionIssue(
      sid,
      body.area ?? 'Storefront',
      body.detail ?? 'API unreachable',
    )
    return { ok: true }
  }

  /** Deploy hook — remove Unsplash/seed demo catalog (requires INTERNAL_HEALTH_SECRET). */
  @Post('deploy/purge-demo')
  async deployPurgeDemo(@Query('storeId') storeId: string, @Req() req: Request) {
    const secret = process.env['INTERNAL_HEALTH_SECRET']
    const header = req.headers['x-splaro-internal']
    if (!secret || header !== secret) {
      throw new UnauthorizedException('Invalid internal token')
    }
    const sid = await resolveStoreId(
      this.prisma,
      (storeId?.trim() || process.env['NEXT_PUBLIC_STORE_ID'] || 'splaro').trim(),
    )
    const result = await this.purgeDemoCatalog.purge(sid)
    await this.cache.invalidateCatalog(sid)
    return { ok: true, ...result }
  }

  /** Deploy hook — seed demo catalog when store has zero products (requires INTERNAL_HEALTH_SECRET). */
  @Post('deploy/seed-demo')
  async deploySeedDemo(@Query('storeId') storeId: string, @Req() req: Request) {
    const secret = process.env['INTERNAL_HEALTH_SECRET']
    const header = req.headers['x-splaro-internal']
    if (!secret || header !== secret) {
      throw new UnauthorizedException('Invalid internal token')
    }
    const sid = await resolveStoreId(
      this.prisma,
      (storeId?.trim() || process.env['NEXT_PUBLIC_STORE_ID'] || 'splaro').trim(),
    )
    const result = await this.seedDemoCatalog.seedIfEmpty(sid)
    if (result.productsCreated > 0) {
      await this.cache.invalidateCatalog(sid)
    }
    return { ok: true, ...result }
  }

  /** Internal-only storefront events (web server → API). */
  private assertInternalEventAuth(req: Request): void {
    const secret = process.env['INTERNAL_HEALTH_SECRET']
    const header = req.headers['x-splaro-internal']
    if (!secret || header !== secret) {
      throw new UnauthorizedException('Unauthorized event source')
    }
  }
}
