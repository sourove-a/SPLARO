import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from './public.decorator'
import {
  canWriteAdmin,
  isPublicApiPath,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from './admin-session.util'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<AdminRequest>()
    const rawPath = (request.url ?? request.path ?? '').split('?')[0] ?? ''

    if (isPublicApiPath(rawPath, request.method ?? 'GET')) return true

    const internalSecret = process.env['INTERNAL_HEALTH_SECRET']
    const normalizedPath = rawPath.replace(/^\/api\/v1\//, '').replace(/^\//, '')
    if (
      internalSecret &&
      request.headers['x-splaro-internal'] === internalSecret &&
      (request.method ?? 'GET').toUpperCase() === 'GET' &&
      (normalizedPath === 'health' || normalizedPath.startsWith('health/'))
    ) {
      return true
    }

    if (
      process.env['API_AUTH_DISABLED'] === 'true' &&
      process.env['NODE_ENV'] !== 'production'
    ) {
      request.adminUser = {
        userId: 'dev_bypass',
        email: 'dev@local',
        name: 'Dev Bypass',
        role: 'SUPER_ADMIN',
        exp: Date.now() + 3600_000,
      }
      return true
    }

    const authHeader = request.headers.authorization
    const token =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ??
      (typeof request.headers['x-admin-token'] === 'string'
        ? request.headers['x-admin-token']
        : null)

    if (!token) {
      throw new UnauthorizedException('Admin authentication required')
    }

    const session = verifyAdminSessionToken(token)
    if (!session) {
      throw new UnauthorizedException('Invalid or expired admin session')
    }

    const method = (request.method ?? 'GET').toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !canWriteAdmin(session.role)) {
      throw new ForbiddenException('Insufficient permissions for this action')
    }

    request.adminUser = session
    return true
  }
}
