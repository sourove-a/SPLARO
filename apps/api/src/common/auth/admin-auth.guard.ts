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
import { AdminSessionResolver } from './admin-session.resolver'
import { staffHasPermission } from '../../modules/security/security-permissions.util'
import { McpTokenService, MCP_WRITE_SCOPE } from '../../modules/mcp/mcp-token.service'
import { isMcpAllowedApiPath } from '../../modules/mcp/mcp-allowed-paths'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionResolver: AdminSessionResolver,
    private readonly mcpTokens: McpTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
        : null) ??
      (typeof request.headers['x-mcp-key'] === 'string' ? request.headers['x-mcp-key'] : null)

    if (!token) {
      throw new UnauthorizedException('Admin authentication required')
    }

    const session = verifyAdminSessionToken(token)
    // Prefer MCP link tokens when they use the splaro_mcp_ prefix (never look like JWT).
    const looksLikeMcpLink = token.startsWith('splaro_mcp_')
    if (session && !looksLikeMcpLink) {
      const liveSession = await this.sessionResolver.resolveLiveSession(session)
      if (!liveSession) {
        throw new UnauthorizedException('Admin account inactive or access revoked')
      }

      const routePermission = resolveRoutePermission(rawPath, method)
      if (
        routePermission &&
        !staffHasPermission(
          liveSession.role,
          liveSession.permissions,
          routePermission.moduleSlug,
          routePermission.action,
        )
      ) {
        throw new ForbiddenException('Insufficient permissions for this action')
      }

      request.adminUser = liveSession
      return true
    }

    const mcp = await this.mcpTokens.validateBearer(token)
    if (!mcp) {
      throw new UnauthorizedException('Invalid or expired admin session')
    }

    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method)
    const pathNorm = rawPath.replace(/^\/api\/v1\/?/, '').replace(/^\//, '')
    if (pathNorm.startsWith('admin/mcp/tokens')) {
      throw new UnauthorizedException('MCP link tokens require an admin panel session')
    }
    if (!isMcpAllowedApiPath(pathNorm, method)) {
      throw new ForbiddenException(
        'MCP link token cannot access this API path — only order status and variant stock writes are allowed',
      )
    }
    if (isWrite && !mcp.scopes.includes(MCP_WRITE_SCOPE) && !mcp.scopes.includes('*')) {
      throw new ForbiddenException('MCP token lacks mcp:write scope')
    }

    request.adminUser = this.mcpTokens.toAdminSession(mcp, isWrite)
    return true
  }
}
