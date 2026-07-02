import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { InfrastructureIntegrationService } from '../../integrations/infrastructure-integration.service'

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

type PathaoRuntime = Awaited<ReturnType<InfrastructureIntegrationService['resolveRuntimeCredentials']>>

@Injectable()
export class PathaoService {
  private readonly logger = new Logger(PathaoService.name)
  private readonly baseUrl = 'https://courier.pathao.com/aladdin/api/v1'
  private readonly tokenCache = new Map<string, { token: string; expiry: Date }>()

  constructor(private readonly infrastructure: InfrastructureIntegrationService) {}

  private async getCredentials(storeId: string): Promise<PathaoRuntime> {
    return this.infrastructure.resolveRuntimeCredentials(storeId, 'pathao')
  }

  private async getToken(storeId: string): Promise<string> {
    const cached = this.tokenCache.get(storeId)
    if (cached && cached.expiry > new Date()) {
      return cached.token
    }

    const { clientId, clientSecret, username, password } = await this.getCredentials(storeId)

    if (!clientId || !clientSecret || !username || !password) {
      throw new Error('Pathao credentials not configured — save keys in Admin → Settings → Infrastructure')
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

    const token = response.data.access_token
    this.tokenCache.set(storeId, {
      token,
      expiry: new Date(Date.now() + response.data.expires_in * 1000 - 60000),
    })
    return token
  }

  async createOrder(storeId: string, data: PathaoParcelData): Promise<PathaoParcelResponse> {
    const { storeId: pathaoStoreId } = await this.getCredentials(storeId)
    if (!pathaoStoreId) {
      throw new Error('Pathao store ID not configured — save in Admin → Settings → Infrastructure')
    }

    const token = await this.getToken(storeId)

    const response = await axios.post<{ data: PathaoParcelResponse }>(
      `${this.baseUrl}/orders`,
      {
        store_id: parseInt(pathaoStoreId, 10),
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

  async trackOrder(storeId: string, consignmentId: string): Promise<{ status: string; events: unknown[] }> {
    const token = await this.getToken(storeId)

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
