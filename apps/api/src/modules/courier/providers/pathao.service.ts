import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

interface PathaoTokenResponse {
  access_token: string
  expires_in: number
}

interface PathaoParcelData {
  invoiceNumber: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientCityId: number
  recipientZoneId: number
  totalAmount: number
  weight?: number
  itemQuantity?: number
}

interface PathaoParcelResponse {
  consignment_id: string
  order_status: string
  tracking_code: string
}

@Injectable()
export class PathaoService {
  private readonly logger = new Logger(PathaoService.name)
  private readonly baseUrl = 'https://courier.pathao.com/aladdin/api/v1'
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private async getToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken
    }

    const clientId = this.config.get<string>('PATHAO_CLIENT_ID')
    const clientSecret = this.config.get<string>('PATHAO_CLIENT_SECRET')
    const username = this.config.get<string>('PATHAO_USERNAME')
    const password = this.config.get<string>('PATHAO_PASSWORD')

    if (!clientId || !clientSecret || !username || !password) {
      throw new Error('Pathao credentials not configured')
    }

    const response = await axios.post<PathaoTokenResponse>(
      `${this.baseUrl}/issue-token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
        grant_type: 'password',
      },
      { timeout: 15000 },
    )

    this.accessToken = response.data.access_token
    this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000 - 60000)
    return this.accessToken
  }

  async createOrder(data: PathaoParcelData): Promise<PathaoParcelResponse> {
    const storeId = this.config.get<string>('PATHAO_STORE_ID')
    if (!storeId) throw new Error('PATHAO_STORE_ID not configured')

    const token = await this.getToken()

    const response = await axios.post<{ data: PathaoParcelResponse }>(
      `${this.baseUrl}/orders`,
      {
        store_id: parseInt(storeId),
        merchant_order_id: data.invoiceNumber,
        recipient_name: data.recipientName,
        recipient_phone: data.recipientPhone,
        recipient_address: data.recipientAddress,
        recipient_city: data.recipientCityId,
        recipient_zone: data.recipientZoneId,
        delivery_type: 48,
        item_type: 2,
        special_instruction: '',
        item_quantity: data.itemQuantity ?? 1,
        item_weight: (data.weight ?? 500) / 1000,
        item_description: 'Fashion clothing',
        amount_to_collect: data.totalAmount,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      },
    )

    this.logger.log(`Pathao order created: ${response.data.data.consignment_id} for ${data.invoiceNumber}`)
    return response.data.data
  }

  async trackOrder(consignmentId: string): Promise<{ status: string; events: unknown[] }> {
    const token = await this.getToken()

    const response = await axios.get<{ data: { order_status: string; log: unknown[] } }>(
      `${this.baseUrl}/orders/${consignmentId}/info`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      },
    )

    return {
      status: response.data.data.order_status,
      events: response.data.data.log,
    }
  }
}
