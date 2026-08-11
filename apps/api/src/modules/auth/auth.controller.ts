import {
  Body,
  Controller,
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
  AdminChangePasswordDto,
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
    const resolved = await this.auth.resolveLoginMethod(body.email.trim(), body.storeId)
    return { method: resolved.method, email: resolved.email }
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('request-login')
  async requestLogin(@Body() body: AdminRequestLoginDto) {
    const email = body.email.trim()
    const storeId = body.storeId ?? 'splaro'

    const resolved = await this.auth.resolveLoginMethod(email, body.storeId)
    if (!resolved.exists || resolved.method !== 'telegram') {
      // Unknown/password accounts get a silent OK so admin emails cannot be enumerated.
      // The primary owner must never be silenced — a real failure there locks the panel.
      if (this.auth.isPrimaryOwnerEmail(email)) {
        throw new ServiceUnavailableException(
          'Primary owner admin record is missing for this store. Run scripts/restore-primary-admin.ts (or pnpm db:seed) on this database.',
        )
      }
      return { ok: true, email: resolved.email, method: resolved.method, tokenSent: true }
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

    // `method` lets the login screen skip a second round trip to /login-method.
    return { ok: true, email: adminEmail, method: 'telegram' as const, tokenSent: true }
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
        throw new UnauthorizedException('This admin account must use a Telegram login code')
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
      throw new UnauthorizedException('Use email and password for this account')
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
  async me(@Headers('authorization') authorization?: string, @Req() req?: Request) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new UnauthorizedException('Missing bearer token')

    const user = await this.auth.verifyLiveToken(token)
    if (!user) throw new UnauthorizedException('Invalid or expired session')

    const extras = await this.auth.getProfileExtras(user.userId)
    const requestIp =
      (typeof req?.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      (typeof req?.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : undefined) ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      null

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
        permissions: user.permissions,
      },
      canChangePassword: extras.canChangePassword,
      lastLoginIp: extras.lastLoginIp,
      lastLoginAt: extras.lastLoginAt,
      requestIp,
    }
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('change-password')
  async changePassword(
    @Body() body: AdminChangePasswordDto,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new UnauthorizedException('Missing bearer token')
    const user = await this.auth.verifyLiveToken(token)
    if (!user) throw new UnauthorizedException('Invalid or expired session')
    await this.auth.changeOwnPassword(user.userId, body.currentPassword, body.newPassword)
    return { ok: true, message: 'Password updated — use the new password next sign-in.' }
  }
}
