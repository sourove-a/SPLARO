import {
  Body,
  Controller,
  Get,
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
 *
 * Canonical: POST /api/v1/webhooks/steadfast
 * Legacy alias (same handler): POST /api/v1/courier/steadfast-webhook
 */
@Public()
@Controller(['webhooks/steadfast', 'courier/steadfast-webhook'])
export class SteadfastWebhookController {
  constructor(
    private readonly infra: InfrastructureIntegrationService,
    private readonly webhooks: SteadfastWebhookService,
  ) {}

  /** Browser / portal URL checks — delivery notifications use POST with Bearer auth. */
  @Get()
  @HttpCode(200)
  async probe() {
    const bearerConfigured = Boolean(await this.infra.resolveWebhookBearerToken())
    return {
      ok: true,
      service: 'steadfast-webhook',
      accept: 'POST',
      contentType: 'application/json',
      auth: 'Authorization: Bearer <token from Admin → Infrastructure>',
      canonicalUrl: this.infra.buildSteadfastCallbackUrl(),
      legacyAliasUrl: this.infra.buildSteadfastCallbackLegacyUrl(),
      bearerConfigured,
    }
  }

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
