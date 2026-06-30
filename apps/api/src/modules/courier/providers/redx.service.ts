import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

interface RedXParcelData {
  invoiceNumber: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientCity: string
  totalAmount: number
  weight?: number
  remarks?: string
}

interface RedXResponse {
  trackingId: string
  status: string
}

@Injectable()
export class RedxService {
  private readonly logger = new Logger(RedxService.name)
  private readonly baseUrl = 'https://openapi.redx.com.bd/v1.0.0-beta'

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async createParcel(data: RedXParcelData): Promise<RedXResponse> {
    const apiKey = this.config.get<string>('REDX_API_KEY')
    if (!apiKey) throw new Error('REDX_API_KEY not configured')

    const response = await axios.post<RedXResponse>(
      `${this.baseUrl}/parcel`,
      {
        name: data.recipientName,
        number: data.recipientPhone,
        address: data.recipientAddress,
        area: data.recipientCity,
        city_id: 1,
        cash_amount: data.totalAmount,
        parcel_weight: data.weight ?? 500,
        customer_invoice_no: data.invoiceNumber,
        special_instruction: data.remarks ?? '',
        delivery_charge: 0,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'API-ACCESS-TOKEN': `Bearer ${apiKey}`,
        },
        timeout: 15000,
      },
    )

    this.logger.log(`RedX parcel created: ${response.data.trackingId} for order ${data.invoiceNumber}`)
    return response.data
  }

  async trackParcel(trackingId: string): Promise<{ status: string; events: unknown[] }> {
    const apiKey = this.config.get<string>('REDX_API_KEY')
    if (!apiKey) throw new Error('REDX_API_KEY not configured')

    const response = await axios.get<{ current_status: string; log: unknown[] }>(
      `${this.baseUrl}/parcel/track/${trackingId}`,
      {
        headers: { 'API-ACCESS-TOKEN': `Bearer ${apiKey}` },
        timeout: 10000,
      },
    )

    return {
      status: response.data.current_status,
      events: response.data.log,
    }
  }

  async cancelParcel(trackingId: string): Promise<void> {
    const apiKey = this.config.get<string>('REDX_API_KEY')
    if (!apiKey) throw new Error('REDX_API_KEY not configured')

    await axios.patch(
      `${this.baseUrl}/parcel/${trackingId}/cancel`,
      {},
      {
        headers: { 'API-ACCESS-TOKEN': `Bearer ${apiKey}` },
        timeout: 10000,
      },
    )
  }
}
