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
  Query,
  Req,
  Patch,
  UnauthorizedException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { LEGAL_PAGE_SLUGS } from '@splaro/types'
import { Public } from '../../common/auth/public.decorator'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { resolveStoreId } from '../../common/store.util'
import { mergeStorefrontConfig } from '../settings/storefront-config'
import { CreateStorefrontOrderInput, StorefrontOrdersService } from './storefront-orders.service'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
import { AdminTelegramHubService } from '../notifications/admin-telegram-hub.service'
import { CustomersService } from '../customers/customers.service'
import { StorefrontAuthService } from './storefront-auth.service'
import { StorefrontWishlistService } from './storefront-wishlist.service'
import { StorefrontOtpService } from './storefront-otp.service'
import { InvoiceService } from '../invoices/invoice.service'
import { LegalPagesService } from '../content/legal-pages.service'

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
@Controller('storefront')
export class StorefrontController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly storefrontOrders: StorefrontOrdersService,
    private readonly cache: CacheService,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly telegramHub: AdminTelegramHubService,
    private readonly customers: CustomersService,
    private readonly storefrontAuth: StorefrontAuthService,
    private readonly storefrontWishlist: StorefrontWishlistService,
    private readonly storefrontOtp: StorefrontOtpService,
    private readonly invoices: InvoiceService,
    private readonly legalPages: LegalPagesService,
  ) {}

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
          bkash: settings?.bkashEnabled ?? true,
          nagad: settings?.nagadEnabled ?? true,
          sslcommerz: settings?.sslcommerzEnabled ?? true,
        },
        marketing: {
          facebookPixelId: settings?.facebookPixelId ?? '',
          googleAnalyticsId: settings?.googleAnalyticsId ?? '',
        },
        config,
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
      const products = await this.prisma.product.findMany({
        where: { storeId: sid, isPublished: true, id: { in: ids } },
        include: {
          images: { orderBy: { position: 'asc' as const } },
          variants: { where: { isActive: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      })
      const order = new Map(ids.map((id, index) => [id, index]))
      products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      return { products, total: products.length }
    }

    const category = categorySlug?.trim() || undefined
    const parentCategory = parentCategorySlug?.trim() || undefined
    const collection = collectionSlug?.trim() || undefined
    const filtered = Boolean(
      category || parentCategory || collection || limitParam !== undefined || pageParam !== undefined,
    )
    const limit = Math.min(Math.max(Number(limitParam) || 40, 1), 100)
    const page = Math.max(Number(pageParam) || 1, 1)

    const where = {
      storeId: sid,
      isPublished: true,
      ...(category
        ? {
            category: {
              OR: [{ slug: category }, { slug: { startsWith: `${category}-` } }],
            },
          }
        : {}),
      ...(parentCategory
        ? {
            category: {
              OR: [{ slug: parentCategory }, { parent: { slug: parentCategory } }],
            },
          }
        : {}),
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
    }

    const productInclude = {
      images: { orderBy: { position: 'asc' as const } },
      variants: { where: { isActive: true } },
      category: { select: { id: true, name: true, slug: true } },
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
      return this.cache.getOrSet(this.cache.storeKey(sid, 'products'), 60, load)
    }

    const cacheKey = `${this.cache.storeKey(sid, 'products')}:cat:${category ?? ''}:parent:${parentCategory ?? ''}:col:${collection ?? ''}:p${page}:l${limit}`
    return this.cache.getOrSet(cacheKey, 60, load)
  }

  @Get('products/:slug')
  async getProduct(@Query('storeId') storeId: string, @Param('slug') slug: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const product = await this.prisma.product.findFirst({
      where: { storeId: sid, slug, isPublished: true },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: { where: { isActive: true } },
        category: { select: { id: true, name: true, slug: true } },
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
    @Body() body: { name?: string; email?: string; phone?: string; password?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const result = await this.storefrontAuth.signup(sid, {
      name: body.name ?? '',
      email: body.email ?? '',
      phone: body.phone ?? '',
      password: body.password ?? '',
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
    @Body() body: { email?: string; password?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.storefrontAuth.login(sid, {
      identifier: body.email ?? '',
      password: body.password ?? '',
    })
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

  @Get('customer/wishlist')
  async getWishlist(
    @Query('storeId') storeId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user?.customerId) throw new UnauthorizedException('Customer account required')

    const productIds = await this.storefrontWishlist.listProductIds(user.customerId)
    return { productIds }
  }

  @Post('customer/wishlist/merge')
  async mergeWishlist(
    @Query('storeId') storeId: string,
    @Body() body: { productIds?: string[] },
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Not signed in')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user?.customerId) throw new UnauthorizedException('Customer account required')

    const productIds = await this.storefrontWishlist.merge(user.customerId, body.productIds ?? [])
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
    if (!user?.customerId) throw new UnauthorizedException('Customer account required')

    return this.storefrontWishlist.toggle(sid, user.customerId, body.productId ?? '')
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
  async sendOtp(@Query('storeId') storeId: string, @Body() body: { phone?: string }) {
    if (!body.phone?.trim()) throw new BadRequestException('Phone is required')
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.storefrontOtp.sendOtp(sid, body.phone)
  }

  @Post('auth/otp/verify')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async verifyOtp(
    @Query('storeId') storeId: string,
    @Body() body: { phone?: string; code?: string },
  ) {
    if (!body.phone?.trim() || !body.code?.trim()) {
      throw new BadRequestException('Phone and code are required')
    }
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.storefrontOtp.verifyOtp(sid, body.phone, body.code)
  }

  @Post('orders')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async createOrder(
    @Query('storeId') storeId: string,
    @Body() body: CreateStorefrontOrderInput,
    @Req() req: Request,
  ) {
    const order = await this.storefrontOrders.create({
      ...body,
      storeId: body.storeId ?? storeId,
      clientIp: clientIp(req),
      userAgent: req.headers['user-agent'],
    })
    return { order }
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
  async trackOrders(
    @Query('storeId') storeId: string,
    @Query('phone') phone: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
    @Headers('x-splaro-phone-access') phoneAccess?: string,
  ) {
    if (!phone) return { orders: [] }
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    const sessionPhone = sessionToken
      ? await this.storefrontAuth.sessionPhone(sessionToken)
      : null
    await this.storefrontOtp.assertPhoneAccess(sid, phone, phoneAccess, sessionPhone)

    const orders = await this.storefrontOrders.listForUser(storeId, phone)
    return { orders }
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
      autoPrint: autoPrint === '1' || autoPrint === 'true',
    })
  }

  @Get('orders/:id')
  async getOrder(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Query('key') key?: string,
    @Query('phone') phone?: string,
  ) {
    if (!key && !phone) {
      throw new BadRequestException('key or phone is required')
    }
    const order = await this.storefrontOrders.findForStorefrontAccess(storeId, id, {
      ...(key ? { key } : {}),
      ...(phone ? { phone } : {}),
    })
    if (!order) throw new NotFoundException('Order not found')
    return { order }
  }

  @Post('newsletter/subscribe')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async subscribeNewsletter(
    @Query('storeId') storeId: string,
    @Body() body: { email?: string },
  ) {
    const email = body.email?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.')
    }

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

  @Get('banners')
  async listBanners(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'banners'), 60, async () => {
      const banners = await this.prisma.banner.findMany({
        where: { storeId: sid, isActive: true, position: 'hero' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, title: true, subtitle: true, image: true, linkUrl: true, sortOrder: true },
      })
      return { banners, total: banners.length }
    })
  }

  // ── Categories & Collections ───────────────────────────────

  @Get('categories')
  async listCategories(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'categories'), 120, async () => {
      const categories = await this.prisma.category.findMany({
        where: { storeId: sid, isActive: true },
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: 'asc' },
      })
      return { categories }
    })
  }

  @Get('collections')
  async listCollections(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.cache.getOrSet(this.cache.storeKey(sid, 'collections'), 120, async () => {
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
    @Body() body: { productId: string; variantId?: string; quantity?: number },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)

    const cart = await this.prisma.cartSession.upsert({
      where: { sessionId },
      create: { sessionId, storeId: sid, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      update: { updatedAt: new Date() },
    })

    const qty = Math.max(1, body.quantity ?? 1)
    const variantId = body.variantId?.trim() || null

    const existing = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: body.productId,
        variantId,
      },
    })

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty },
      })
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: body.productId,
          variantId,
          quantity: qty,
        },
      })
    }

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

  @Post('reviews')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submitReview(
    @Query('storeId') storeId: string,
    @Body() body: { productId: string; rating: number; title?: string; body?: string },
    @Headers('authorization') authorization?: string,
    @Headers('x-splaro-session') sessionHeader?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const sessionToken = sessionFromHeaders(authorization, sessionHeader)
    if (!sessionToken) throw new UnauthorizedException('Sign in to leave a review')
    const user = await this.storefrontAuth.validateSession(sessionToken)
    if (!user?.customerId) throw new UnauthorizedException('Customer account required')

    if (!body.productId || !body.rating) throw new BadRequestException('productId and rating required')
    if (body.rating < 1 || body.rating > 5) throw new BadRequestException('Rating must be 1-5')

    const text = body.body?.trim()
    if (!text || text.length < 10) {
      throw new BadRequestException('Review must be at least 10 characters')
    }

    const product = await this.prisma.product.findFirst({
      where: { id: body.productId, storeId: sid, isPublished: true },
      select: { id: true, name: true, slug: true },
    })
    if (!product) throw new NotFoundException('Product not found')

    const existing = await this.prisma.review.findFirst({
      where: { productId: body.productId, customerId: user.customerId },
    })
    if (existing) throw new BadRequestException('You have already reviewed this product')

    const purchase = await this.prisma.orderItem.findFirst({
      where: {
        productId: body.productId,
        order: {
          customerId: user.customerId,
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      select: { id: true },
    })

    const review = await this.prisma.review.create({
      data: {
        productId: body.productId,
        customerId: user.customerId,
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
      where: {
        storeId: sid,
        isPublished: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { tags: { has: term } },
          { category: { name: { contains: term, mode: 'insensitive' } } },
        ],
      },
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
    const secret = process.env['INTERNAL_HEALTH_SECRET']
    const header = req.headers['x-splaro-internal']
    if (secret && header !== secret) {
      throw new BadRequestException('Unauthorized event source')
    }

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
    const secret = process.env['INTERNAL_HEALTH_SECRET']
    const header = req.headers['x-splaro-internal']
    if (secret && header !== secret) {
      throw new BadRequestException('Unauthorized event source')
    }

    const sid = await resolveStoreId(this.prisma, storeId)
    void this.telegramHub.notifyApiConnectionIssue(
      sid,
      body.area ?? 'Storefront',
      body.detail ?? 'API unreachable',
    )
    return { ok: true }
  }
}
