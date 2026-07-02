import { Body, Controller, Get, Headers, Post, Req, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-login')
  async requestLogin(@Body() body: { email?: string; storeId?: string }) {
    const email = body.email?.trim()
    if (!email) {
      throw new UnauthorizedException('Email required')
    }
    return this.auth.validateAdminEmail(email, body.storeId)
  }

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
