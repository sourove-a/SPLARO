import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { timingSafeEqual } from 'node:crypto'
import { Public } from '../../common/auth/public.decorator'
import { InfrastructureIntegrationService } from '../integrations/infrastructure-integration.service'
import {
  SteadfastWebhookService,
  type SteadfastWebhookBody,
} from './steadfast-webhook.service'

/**
 * Inbound Steadfast Webhook Integration.
 * Paste Callback Url + Auth Token (Bearer) from Admin → Settings → Infrastructure
 * into the Steadfast merchant portal Webhook Integration panel.
 */
@Public()
@Controller('webhooks/steadfast')
export class SteadfastWebhookController {
  constructor(
    private readonly infra: InfrastructureIntegrationService,
    private readonly webhooks: SteadfastWebhookService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Body() body: SteadfastWebhookBody,
    @Headers('authorization') authorization?: string,
  ) {
    const expected = await this.infra.resolveWebhookBearerToken()
    if (!expected) {
      throw new UnauthorizedException(
        'Steadfast webhook Bearer token is not configured — save Auth Token in Admin → Settings → Infrastructure',
      )
    }

    const provided = extractBearer(authorization)
    if (!provided || !bearerTokensEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid webhook Bearer token')
    }

    return this.webhooks.handle(body ?? {})
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(header)
  return m?.[1] ?? null
}

function bearerTokensEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
