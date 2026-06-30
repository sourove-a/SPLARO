import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import type { CourierBookingResult } from '../courier.service'

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

@Injectable()
export class SteadfastService {
  private readonly logger = new Logger(SteadfastService.name)
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly secretKey: string

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('STEADFAST_BASE_URL') ??
      'https://portal.steadfast.com.bd/public/api/v1'
    this.apiKey = this.config.get<string>('STEADFAST_API_KEY') ?? 'local-dev-steadfast-key'
    this.secretKey = this.config.get<string>('STEADFAST_SECRET_KEY') ?? 'local-dev-steadfast-secret'
  }

  async createParcel(payload: SteadfastParcelPayload): Promise<CourierBookingResult> {
    if (this.shouldUseDevStub()) {
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
          'Steadfast not connected. Add STEADFAST_API_KEY and STEADFAST_SECRET_KEY in .env, then restart the API.',
      }
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/create_order`,
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
            'Api-Key': this.apiKey,
            'Secret-Key': this.secretKey,
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

  private shouldUseDevStub(): boolean {
    if (process.env.COURIER_DEV_STUB === 'true') return true
    const placeholderKeys = ['local-dev-steadfast-key', 'your-steadfast-api-key', '']
    return placeholderKeys.includes(this.apiKey) || placeholderKeys.includes(this.secretKey)
  }

  async trackParcel(consignmentId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/status_by_cid/${consignmentId}`, {
        headers: { 'Api-Key': this.apiKey, 'Secret-Key': this.secretKey },
        timeout: 10000,
      })
      const data = response.data as { delivery_status?: string }
      return data.delivery_status ?? 'Unknown'
    } catch {
      return 'Unknown'
    }
  }
}
