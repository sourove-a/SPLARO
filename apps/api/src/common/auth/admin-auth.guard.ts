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
import { resolveRoutePermission } from './admin-route-permissions.util'
import {
  isPublicApiPath,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from './admin-session.util'
import { staffHasPermission } from '../../modules/security/security-permissions.util'

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
    const method = (request.method ?? 'GET').toUpperCase()
    if (
      internalSecret &&
      request.headers['x-splaro-internal'] === internalSecret &&
      method === 'GET'
    ) {
      // Server-side health probes (admin /api/health → /health/routes loopback GETs)
      request.adminUser = {
        userId: 'health_probe',
        email: 'health@internal',
        name: 'Health Probe',
        role: 'SUPER_ADMIN',
        exp: Date.now() + 120_000,
      }
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

    const routePermission = resolveRoutePermission(rawPath, method)
    if (
      routePermission &&
      !staffHasPermission(
        session.role,
        session.permissions,
        routePermission.moduleSlug,
        routePermission.action,
      )
    ) {
      throw new ForbiddenException('Insufficient permissions for this action')
    }

    request.adminUser = session
    return true
  }
}
