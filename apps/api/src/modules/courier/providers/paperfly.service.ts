import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

interface PaperflyParcelData {
  invoiceNumber: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientCity: string
  totalAmount: number
  productDetails?: string
  weight?: number
}

interface PaperflyResponse {
  success: boolean
  tracking_code: string
  message?: string
}

@Injectable()
export class PaperflyService {
  private readonly logger = new Logger(PaperflyService.name)
  private readonly baseUrl = 'https://paperfly.com.bd/api'

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private get headers() {
    const clientId = this.config.get<string>('PAPERFLY_CLIENT_ID')
    const clientSecret = this.config.get<string>('PAPERFLY_CLIENT_SECRET')

    if (!clientId || !clientSecret) throw new Error('Paperfly credentials not configured')

    return {
      'Content-Type': 'application/json',
      'X-CLIENT-ID': clientId,
      'X-SECRET': clientSecret,
    }
  }

  async createParcel(data: PaperflyParcelData): Promise<PaperflyResponse> {
    const response = await axios.post<PaperflyResponse>(
      `${this.baseUrl}/parcel/create`,
      {
        order_id: data.invoiceNumber,
        recipient_name: data.recipientName,
        recipient_phone: data.recipientPhone,
        recipient_address: data.recipientAddress,
        recipient_city: data.recipientCity,
        cod_amount: data.totalAmount,
        product_description: data.productDetails ?? 'Fashion clothing',
        weight: ((data.weight ?? 500) / 1000).toFixed(2),
        delivery_type: 'regular',
      },
      {
        headers: this.headers,
        timeout: 15000,
      },
    )

    if (!response.data.success) {
      throw new Error(`Paperfly error: ${response.data.message ?? 'Unknown error'}`)
    }

    this.logger.log(`Paperfly parcel created: ${response.data.tracking_code} for order ${data.invoiceNumber}`)
    return response.data
  }

  async trackParcel(trackingCode: string): Promise<{ status: string; events: unknown[] }> {
    const response = await axios.get<{ status: string; tracking: unknown[] }>(
      `${this.baseUrl}/parcel/track/${trackingCode}`,
      {
        headers: this.headers,
        timeout: 10000,
      },
    )

    return {
      status: response.data.status,
      events: response.data.tracking,
    }
  }
}
