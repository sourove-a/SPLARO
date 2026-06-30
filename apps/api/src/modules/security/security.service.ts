import { Injectable } from '@nestjs/common'
import { PlatformService } from '../platform/platform.service'

@Injectable()
export class SecurityService {
  constructor(private readonly platform: PlatformService) {}

  overview(storeId: string) {
    return this.platform.getSecurity(storeId)
  }
}
