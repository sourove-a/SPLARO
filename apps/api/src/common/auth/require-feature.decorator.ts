import { SetMetadata } from '@nestjs/common'
import type { FeatureFlags } from '@splaro/config'

export const FEATURE_FLAG_META = 'splaro:featureFlag'

/** Require a feature flag to be enabled — else 403. */
export const RequireFeature = (flag: keyof FeatureFlags) =>
  SetMetadata(FEATURE_FLAG_META, flag)
