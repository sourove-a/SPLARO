import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import type { CourierBookingResult } from '../courier.service'

interface SaParibahonPayload {
  invoiceNumber: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientCity: string
  recipientDistrict: string
  codAmount: number
  totalAmount: number
  weight: number
  note: string
}

@Injectable()
export class SaParibahonService {
  private readonly logger = new Logger(SaParibahonService.name)
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly clientId: string

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('SA_PARIBAHAN_BASE_URL') ?? 'https://api.saparibahan.com/v1'
    this.apiKey = this.config.get<string>('SA_PARIBAHAN_API_KEY') ?? ''
    this.clientId = this.config.get<string>('SA_PARIBAHAN_CLIENT_ID') ?? ''
  }

  async createParcel(payload: SaParibahonPayload): Promise<CourierBookingResult> {
    if (!this.apiKey || !this.clientId) {
      return { success: false, error: 'SA_PARIBAHAN_API_KEY and SA_PARIBAHAN_CLIENT_ID not configured' }
    }

    try {
      const res = await axios.post(
        `${this.baseUrl}/parcel/create`,
        {
          client_id: this.clientId,
          invoice_no: payload.invoiceNumber,
          recipient_name: payload.recipientName,
          recipient_phone: payload.recipientPhone,
          recipient_address: payload.recipientAddress,
          recipient_city: payload.recipientCity,
          recipient_district: payload.recipientDistrict,
          cod_amount: payload.codAmount,
          total_price: payload.totalAmount,
          parcel_weight: payload.weight,
          special_note: payload.note,
          service_type: 'regular',
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      )

      const data = res.data as {
        status?: string
        data?: { tracking_number?: string; consignment_id?: string }
        message?: string
        error?: string
      }

      const trackingNumber = data.data?.tracking_number ?? data.data?.consignment_id

      if (data.status === 'success' && trackingNumber) {
        return {
          success: true,
          consignmentId: trackingNumber,
          trackingCode: trackingNumber,
          trackingUrl: `https://saparibahan.com/track?tracking=${trackingNumber}`,
        }
      }

      return { success: false, error: data.message ?? data.error ?? 'SA Paribahan booking failed' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SA Paribahan API error'
      this.logger.error(`SA Paribahan createParcel failed: ${msg}`)
      return { success: false, error: msg }
    }
  }

  async trackParcel(trackingNumber: string): Promise<string> {
    if (!this.apiKey) return 'Unknown'
    try {
      const res = await axios.get(`${this.baseUrl}/parcel/track/${trackingNumber}`, {
        headers: { 'X-API-KEY': this.apiKey },
        timeout: 10000,
      })
      const data = res.data as { status?: string; current_status?: string }
      return data.current_status ?? data.status ?? 'Unknown'
    } catch {
      return 'Unknown'
    }
  }
}
