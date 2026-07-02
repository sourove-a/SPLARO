import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import type { CourierBookingResult } from '../courier.service'
import { InfrastructureIntegrationService } from '../../integrations/infrastructure-integration.service'

interface SteadfastParcelPayload {
  invoiceNumber: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientCity: string
  recipientDistrict: string
  codAmount: number
  weight: number
  note: string
}

type SteadfastRuntime = Awaited<
  ReturnType<InfrastructureIntegrationService['resolveRuntimeCredentials']>
>

@Injectable()
export class SteadfastService {
  private readonly logger = new Logger(SteadfastService.name)

  constructor(private readonly infrastructure: InfrastructureIntegrationService) {}

  private async getCredentials(storeId: string): Promise<SteadfastRuntime> {
    return this.infrastructure.resolveRuntimeCredentials(storeId, 'steadfast')
  }

  private shouldUseDevStub(creds: SteadfastRuntime): boolean {
    if (process.env.COURIER_DEV_STUB === 'true') return true
    const placeholderKeys = new Set([
      '',
      'local-dev-steadfast-key',
      'local-dev-steadfast-secret',
      'your-steadfast-api-key',
    ])
    return placeholderKeys.has(creds.apiKey ?? '') || placeholderKeys.has(creds.secretKey ?? '')
  }

  async createParcel(storeId: string, payload: SteadfastParcelPayload): Promise<CourierBookingResult> {
    const creds = await this.getCredentials(storeId)

    if (this.shouldUseDevStub(creds)) {
      if (process.env.COURIER_DEV_STUB === 'true') {
        const trackingCode = `DEV${Date.now().toString(36).toUpperCase()}`
        this.logger.warn(
          `Steadfast dev stub (COURIER_DEV_STUB=true) — simulated booking for ${payload.invoiceNumber}`,
        )
        return {
          success: true,
          simulated: true,
          consignmentId: `DEV-SF-${payload.invoiceNumber}`,
          trackingCode,
          trackingUrl: `https://steadfast.com.bd/t/${trackingCode}`,
        }
      }
      this.logger.warn(`Steadfast not configured — refusing fake booking for ${payload.invoiceNumber}`)
      return {
        success: false,
        simulated: true,
        error:
          'Steadfast not connected. Save API keys in Admin → Settings → Infrastructure, or set STEADFAST_* in .env.',
      }
    }

    try {
      const response = await axios.post(
        `${creds.baseUrl}/create_order`,
        {
          invoice: payload.invoiceNumber,
          recipient_name: payload.recipientName,
          recipient_phone: payload.recipientPhone,
          recipient_address: payload.recipientAddress,
          cod_amount: payload.codAmount,
          note: payload.note,
        },
        {
          headers: {
            'Api-Key': creds.apiKey,
            'Secret-Key': creds.secretKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      )

      const data = response.data as {
        status: number
        consignment?: { consignment_id: string; tracking_code: string }
        message?: string
      }

      if (data.status === 200 && data.consignment) {
        return {
          success: true,
          consignmentId: data.consignment.consignment_id,
          trackingCode: data.consignment.tracking_code,
          trackingUrl: `https://steadfast.com.bd/t/${data.consignment.tracking_code}`,
        }
      }

      return { success: false, error: data.message ?? 'Steadfast booking failed' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Steadfast API error'
      this.logger.error(`Steadfast createParcel failed: ${message}`)
      return { success: false, error: message }
    }
  }

  /** True when real Steadfast API keys are configured (not placeholders). */
  async isConfigured(storeId: string): Promise<boolean> {
    const creds = await this.getCredentials(storeId)
    return !this.shouldUseDevStub(creds) || process.env.COURIER_DEV_STUB === 'true'
  }

  async hasRealCredentials(storeId: string): Promise<boolean> {
    const creds = await this.getCredentials(storeId)
    return !this.shouldUseDevStub(creds)
  }

  async trackParcel(storeId: string, consignmentId: string): Promise<string> {
    const creds = await this.getCredentials(storeId)
    if (this.shouldUseDevStub(creds)) return 'Unknown'

    try {
      const response = await axios.get(`${creds.baseUrl}/status_by_cid/${consignmentId}`, {
        headers: { 'Api-Key': creds.apiKey, 'Secret-Key': creds.secretKey },
        timeout: 10000,
      })
      const data = response.data as { delivery_status?: string }
      return data.delivery_status ?? 'Unknown'
    } catch {
      return 'Unknown'
    }
  }
}
