import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import {
  AdminAcceptInviteDto,
  AdminForgotPasswordDto,
  AdminLoginDto,
  AdminLoginMethodDto,
  AdminRequestLoginDto,
  AdminResetPasswordDto,
} from '../../common/dtos/admin-auth.dto'
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

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login-method')
  async loginMethod(@Body() body: AdminLoginMethodDto) {
    return this.auth.resolveLoginMethod(body.email.trim(), body.storeId)
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('request-login')
  async requestLogin(@Body() body: AdminRequestLoginDto) {
    const email = body.email.trim()
    const storeId = body.storeId ?? 'splaro'

    // Staff accounts must use password — Telegram OTP is Super Admin only.
    const method = await this.auth.resolveLoginMethod(email, body.storeId)
    if (method.method !== 'telegram') {
      throw new ForbiddenException('Use email and password to sign in — Telegram login is for Super Admin only')
    }

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

    const method = await this.auth.resolveLoginMethod(email, body.storeId)

    if (method.method === 'telegram') {
      const token = body.token?.trim()
      if (!token) {
        throw new UnauthorizedException('Telegram login token required')
      }
      if (body.password?.trim()) {
        throw new UnauthorizedException('Super Admin must use Telegram login token — password is disabled')
      }
      const user = await this.auth.loginWithToken(email, token, body.storeId, meta)
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
      throw new UnauthorizedException('Email and password required')
    }
    if (body.token?.trim()) {
      throw new UnauthorizedException('Use email and password — Telegram login is for Super Admin only')
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

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: AdminForgotPasswordDto) {
    await this.auth.requestPasswordReset(body.email.trim(), body.storeId)
    return {
      ok: true,
      message: 'If that email has admin access, a reset link was sent.',
    }
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() body: AdminResetPasswordDto) {
    await this.auth.resetPasswordWithToken(body.token, body.password)
    return { ok: true, message: 'Password updated — sign in with your email and password.' }
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('invite/:token')
  async invitePreview(@Param('token') token: string) {
    return this.auth.getInvitePreview(token)
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('accept-invite')
  async acceptInvite(@Body() body: AdminAcceptInviteDto, @Req() req: Request) {
    const meta = {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
    }
    const user = await this.auth.acceptInvite(body.token, body.password, body.firstName, meta)
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
