import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import type { CourierBookingResult } from '../courier.service'

interface SundarbanPayload {
  invoiceNumber: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientDistrict: string
  codAmount: number
  weight: number
  note: string
}

@Injectable()
export class SundarbanService {
  private readonly logger = new Logger(SundarbanService.name)
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly merchantId: string

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('SUNDARBAN_BASE_URL') ?? 'https://sundarbanapi.com/api/v1'
    this.apiKey = this.config.get<string>('SUNDARBAN_API_KEY') ?? ''
    this.merchantId = this.config.get<string>('SUNDARBAN_MERCHANT_ID') ?? ''
  }

  async createParcel(payload: SundarbanPayload): Promise<CourierBookingResult> {
    if (!this.apiKey || !this.merchantId) {
      return { success: false, error: 'SUNDARBAN_API_KEY and SUNDARBAN_MERCHANT_ID not configured' }
    }

    try {
      const res = await axios.post(
        `${this.baseUrl}/add-parcel`,
        {
          merchant_id: this.merchantId,
          invoice_id: payload.invoiceNumber,
          recipient_name: payload.recipientName,
          recipient_mobile: payload.recipientPhone,
          recipient_address: payload.recipientAddress,
          recipient_district: payload.recipientDistrict,
          amount: payload.codAmount,
          weight: payload.weight,
          note: payload.note,
          parcel_type: 'regular',
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      )

      const data = res.data as {
        success?: boolean
        tracking_id?: string
        message?: string
        error?: string
      }

      if (data.success && data.tracking_id) {
        return {
          success: true,
          consignmentId: data.tracking_id,
          trackingCode: data.tracking_id,
          trackingUrl: `https://www.sundarbanexpress.com.bd/track?tracking_id=${data.tracking_id}`,
        }
      }

      return { success: false, error: data.message ?? data.error ?? 'Sundarban booking failed' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sundarban API error'
      this.logger.error(`Sundarban createParcel failed: ${msg}`)
      return { success: false, error: msg }
    }
  }

  async trackParcel(trackingId: string): Promise<string> {
    if (!this.apiKey) return 'Unknown'
    try {
      const res = await axios.get(`${this.baseUrl}/parcel-tracking/${trackingId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 10000,
      })
      const data = res.data as { status?: string; delivery_status?: string }
      return data.status ?? data.delivery_status ?? 'Unknown'
    } catch {
      return 'Unknown'
    }
  }
}
