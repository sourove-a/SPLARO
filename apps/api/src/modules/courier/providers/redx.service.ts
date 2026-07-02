import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { InfrastructureIntegrationService } from '../../integrations/infrastructure-integration.service'

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

  constructor(private readonly infrastructure: InfrastructureIntegrationService) {}

  private async getApiKey(storeId: string): Promise<string> {
    const { apiKey } = await this.infrastructure.resolveRuntimeCredentials(storeId, 'redx')
    if (!apiKey) {
      throw new Error('RedX API key not configured — save in Admin → Settings → Infrastructure')
    }
    return apiKey
  }

  async createParcel(storeId: string, data: RedXParcelData): Promise<RedXResponse> {
    const apiKey = await this.getApiKey(storeId)

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

  async trackParcel(storeId: string, trackingId: string): Promise<{ status: string; events: unknown[] }> {
    const apiKey = await this.getApiKey(storeId)

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

  async cancelParcel(storeId: string, trackingId: string): Promise<void> {
    const apiKey = await this.getApiKey(storeId)

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
