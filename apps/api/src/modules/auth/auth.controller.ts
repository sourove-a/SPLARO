import { Body, Controller, Get, Headers, Post, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { TelegramService } from '../telegram/telegram.service'

@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly telegram: TelegramService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('request-login')
  async requestLogin(@Body() body: { email?: string; storeId?: string }) {
    const email = body.email?.trim()
    if (!email) {
      throw new UnauthorizedException('Email required')
    }

    await this.auth.validateAdminEmail(email, body.storeId)
    const { code, email: adminEmail } = await this.auth.issueLoginTokenForEmail(email, body.storeId)
    const tokenSent = await this.telegram.sendLoginTokenForAdmin(body.storeId ?? 'splaro', adminEmail, code)

    if (!tokenSent) {
      throw new ServiceUnavailableException(
        'Login token created but Telegram delivery failed. Open your SPLARO bot and send /login.',
      )
    }

    return { ok: true, email: adminEmail, tokenSent: true }
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() body: { email?: string; token?: string; password?: string; storeId?: string },
    @Req() req: Request,
  ) {
    const email = body.email?.trim()
    if (!email) {
      throw new UnauthorizedException('Email required')
    }

    const meta = {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
    }

    if (body.token?.trim()) {
      const user = await this.auth.loginWithToken(email, body.token, body.storeId, meta)
      return {
        ok: true,
        user: {
          id: user.userId,
          email: user.email,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
        },
      }
    }

    const password = body.password ?? ''
    if (!password) {
      throw new UnauthorizedException('Telegram login token required')
    }

    const user = await this.auth.loginWithPassword(email, password, body.storeId, meta)
    return {
      ok: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
      },
    }
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new UnauthorizedException('Missing bearer token')

    const user = this.auth.verifyToken(token)
    if (!user) throw new UnauthorizedException('Invalid or expired session')

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
      },
    }
  }
}
