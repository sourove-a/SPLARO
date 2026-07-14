import { Body, Controller, Get, Headers, Inject, Post, Req, ServiceUnavailableException, UnauthorizedException, forwardRef } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { AdminLoginDto, AdminRequestLoginDto } from '../../common/dtos/admin-auth.dto'
import { AuthService } from './auth.service'
import { TelegramService } from '../telegram/telegram.service'

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('request-login')
  async requestLogin(@Body() body: AdminRequestLoginDto) {
    const email = body.email.trim()
    const storeId = body.storeId ?? 'splaro'

    const delivery = await this.telegram.resolveAdminLoginDelivery(storeId, email)
    if (!delivery.ok) {
      throw new ServiceUnavailableException(delivery.message)
    }

    const { code, email: adminEmail } = await this.auth.issueLoginTokenForEmail(email, body.storeId)
    const tokenSent = await this.telegram.sendLoginTokenForAdmin(storeId, adminEmail, code)

    if (!tokenSent) {
      const diag = await this.telegram.getLoginDeliveryDiagnostics(storeId, adminEmail)
      throw new ServiceUnavailableException(
        `Login token created but Telegram delivery failed: ${diag.reason}. ${diag.hint}`,
      )
    }

    return { ok: true, email: adminEmail, tokenSent: true }
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() body: AdminLoginDto, @Req() req: Request) {
    const email = body.email.trim()

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
          permissions: user.permissions,
        },
      }
    }

    const password = body.password ?? ''
    if (!password) {
      throw new UnauthorizedException('Telegram login token required')
    }

    // Password login is a deliberate, opt-in fallback only — Telegram 2FA is
    // the enforced admin login path. Disabled unless explicitly turned on.
    if (process.env['ALLOW_ADMIN_PASSWORD_LOGIN'] !== 'true') {
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
        permissions: user.permissions,
      },
    }
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new UnauthorizedException('Missing bearer token')

    const user = await this.auth.verifyLiveToken(token)
    if (!user) throw new UnauthorizedException('Invalid or expired session')

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
        permissions: user.permissions,
      },
    }
  }
}
