import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import {
  featureDisabledReason,
  isFeatureEnabled,
  type FeatureFlags,
} from '@splaro/config'
import { FEATURE_FLAG_META } from './require-feature.decorator'

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const flag = this.reflector.getAllAndOverride<keyof FeatureFlags | undefined>(
      FEATURE_FLAG_META,
      [context.getHandler(), context.getClass()],
    )
    if (!flag) return true
    if (isFeatureEnabled(flag)) return true
    throw new ForbiddenException(featureDisabledReason(flag))
  }
}
