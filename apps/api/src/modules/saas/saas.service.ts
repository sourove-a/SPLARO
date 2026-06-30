import { Injectable } from '@nestjs/common'
import { PlatformService } from '../platform/platform.service'

@Injectable()
export class SaasService {
  constructor(private readonly platform: PlatformService) {}

  overview(storeId: string) {
    return this.platform.getSaaS(storeId)
  }
}
