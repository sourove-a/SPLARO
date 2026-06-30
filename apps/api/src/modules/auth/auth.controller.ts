import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
