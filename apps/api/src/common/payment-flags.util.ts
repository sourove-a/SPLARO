import { BadRequestException } from '@nestjs/common'
import type { PaymentMethod, PrismaClient } from '@prisma/client'

export interface StorePaymentFlags {
  cod: boolean
  bkash: boolean
  nagad: boolean
  sslcommerz: boolean
}

export async function loadStorePaymentFlags(
  prisma: PrismaClient,
  storeId: string,
): Promise<StorePaymentFlags> {
  const settings = await prisma.siteSettings.findUnique({
    where: { storeId },
    select: {
      codEnabled: true,
      bkashEnabled: true,
      nagadEnabled: true,
      sslcommerzEnabled: true,
    },
  })
  return {
    cod: settings?.codEnabled ?? true,
    bkash: settings?.bkashEnabled ?? false,
    nagad: settings?.nagadEnabled ?? false,
    sslcommerz: settings?.sslcommerzEnabled ?? false,
  }
}

export function assertPaymentMethodEnabled(
  method: PaymentMethod,
  flags: StorePaymentFlags,
): void {
  const map: Record<PaymentMethod, keyof StorePaymentFlags> = {
    CASH_ON_DELIVERY: 'cod',
    BKASH: 'bkash',
    NAGAD: 'nagad',
    SSLCOMMERZ: 'sslcommerz',
    CARD: 'sslcommerz',
    BANK_TRANSFER: 'cod',
  }
  const key = map[method]
  if (key && !flags[key]) {
    throw new BadRequestException('This payment method is not available right now')
  }
}

export function assertGatewayEnabled(
  gateway: 'bkash' | 'nagad' | 'sslcommerz',
  flags: StorePaymentFlags,
): void {
  if (!flags[gateway]) {
    throw new BadRequestException(`${gateway} payments are not enabled for this store`)
  }
}
