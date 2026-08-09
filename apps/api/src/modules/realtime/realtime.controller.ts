import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { Public } from '../../common/auth/public.decorator'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { resolveStoreId } from '../../common/store.util'
import { PrismaService } from '../../common/prisma.service'
import { RealtimeBusService } from '../../common/realtime/realtime-bus.service'
import {
  adminOrdersRealtimeChannel,
  isSafeRealtimeId,
  orderRealtimeChannel,
} from '../../common/realtime/realtime-channels'
import {
  formatSseComment,
  formatSseData,
  sanitizeRealtimeOrderEvent,
} from '../../common/realtime/realtime-event.util'
import { StorefrontAuthService } from '../storefront/storefront-auth.service'
import { StorefrontOrdersService } from '../storefront/storefront-orders.service'
import { StorefrontOtpService } from '../storefront/storefront-otp.service'
import {
  authorizeCustomerOrderSubscribe,
  sessionTokenFromHeaders,
} from './realtime-subscribe-auth'

const HEARTBEAT_MS = 15_000

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

function clientIp(req: Request): string {
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    const hops = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (hops.length) return hops[hops.length - 1] ?? req.ip ?? 'unknown'
  }
  return req.ip ?? 'unknown'
}

function wantsSse(accept: string | undefined): boolean {
  return typeof accept === 'string' && accept.includes('text/event-stream')
}

function openSse(res: Response): (chunk: string) => void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  const flush = () => (res as Response & { flush?: () => void }).flush?.()
  return (chunk: string) => {
    res.write(chunk)
    flush()
  }
}

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBusService,
    private readonly storefrontOrders: StorefrontOrdersService,
    private readonly storefrontAuth: StorefrontAuthService,
    private readonly storefrontOtp: StorefrontOtpService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Get('orders/:id')
  async subscribeOrder(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Query('key') key: string | undefined,
    @Query('phone') phone: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-splaro-session') sessionHeader: string | undefined,
    @Headers('x-splaro-phone-access') phoneAccess: string | undefined,
    @Headers('accept') accept: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!wantsSse(accept)) {
      return res.status(200).json({ ok: true, transport: 'sse' })
    }

    const sid = await resolveStoreId(this.prisma, storeId)
    try {
      const access = await authorizeCustomerOrderSubscribe({
        storeId: sid,
        orderRef: id,
        key,
        phone,
        phoneAccess,
        sessionToken: sessionTokenFromHeaders(authorization, sessionHeader),
        prisma: this.prisma,
        storefrontOrders: this.storefrontOrders,
        storefrontAuth: this.storefrontAuth,
        storefrontOtp: this.storefrontOtp,
      })
      const ip = clientIp(req)
      if (!this.bus.tryAcquireCustomerSlot(ip)) {
        throw new ServiceUnavailableException('Too many live connections')
      }

      const write = openSse(res)
      write(formatSseComment(`connected ${Date.now()}`))
      const unsubscribe = this.bus.subscribe(orderRealtimeChannel(access.orderId), (message) => {
        const event = sanitizeRealtimeOrderEvent(safeParse(message))
        if (!event || event.orderId !== access.orderId) return
        write(formatSseData(event))
      })

      const heartbeat = setInterval(() => {
        try {
          write(formatSseComment(`keepalive ${Date.now()}`))
        } catch {
          /* client gone */
        }
      }, HEARTBEAT_MS)

      let cleaned = false
      const cleanup = () => {
        if (cleaned) return
        cleaned = true
        clearInterval(heartbeat)
        unsubscribe()
        this.bus.releaseCustomerSlot(ip)
      }
      req.on('close', cleanup)
      res.on('close', cleanup)
    } catch (err) {
      this.bus.recordAuthFailure()
      if (err instanceof UnauthorizedException) throw err
      throw err
    }
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('admin/orders')
  async subscribeAdminOrders(
    @Query('storeId') storeId: string,
    @Headers('accept') accept: string | undefined,
    @Req() req: AdminRequest,
    @Res() res: Response,
  ) {
    const adminUser = req.adminUser
    if (!adminUser?.userId) {
      this.bus.recordAuthFailure()
      throw new UnauthorizedException('Admin authentication required')
    }
    if (!wantsSse(accept)) {
      return res.status(200).json({ ok: true, transport: 'sse' })
    }

    const sid = await resolveStoreId(this.prisma, storeId || adminUser.storeId)
    if (!isSafeRealtimeId(sid)) {
      throw new UnauthorizedException('Invalid store')
    }
    if (!this.bus.tryAcquireAdminSlot(adminUser.userId)) {
      throw new ServiceUnavailableException('Too many live connections')
    }

    const write = openSse(res)
    write(formatSseComment(`connected ${Date.now()}`))
    const unsubscribe = this.bus.subscribe(adminOrdersRealtimeChannel(sid), (message) => {
      const event = sanitizeRealtimeOrderEvent(safeParse(message))
      if (!event) return
      write(formatSseData(event))
    })

    const heartbeat = setInterval(() => {
      try {
        write(formatSseComment(`keepalive ${Date.now()}`))
      } catch {
        /* client gone */
      }
    }, HEARTBEAT_MS)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      clearInterval(heartbeat)
      unsubscribe()
      this.bus.releaseAdminSlot(adminUser.userId)
    }
    req.on('close', cleanup)
    res.on('close', cleanup)
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
