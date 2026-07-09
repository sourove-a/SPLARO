import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PLAIN_KEYS: Record<string, string> = {
  isEnabled: 'true',
  notifyOrders: 'true',
  notifyCustomers: 'true',
  notifyPayments: 'true',
  notifyCourier: 'true',
  notifyStock: 'true',
  notifyReviews: 'true',
  reportDaily: 'true',
  reportTime: '09:00',
}

async function main() {
  const updated = await prisma.telegramConfig.updateMany({
    data: {
      isActive: true,
      notifyOrders: true,
      notifyCustomers: true,
      notifyPayments: true,
      notifyCourier: true,
      notifyStock: true,
      notifyReviews: true,
      notifyRMA: true,
      reportDaily: true,
      reportWeekly: true,
    },
  })

  await prisma.siteSettings.updateMany({ data: { telegramEnabled: true } })

  const configs = await prisma.telegramConfig.findMany({ select: { storeId: true } })
  for (const { storeId } of configs) {
    for (const [key, value] of Object.entries(PLAIN_KEYS)) {
      await prisma.integrationSetting.upsert({
        where: { storeId_provider_key: { storeId, provider: 'telegram', key } },
        create: { storeId, provider: 'telegram', key, value },
        update: { value },
      })
    }
  }

  console.log(`[enable-telegram-all] ${updated.count} config(s) enabled; ${configs.length} store(s) synced`)
  if (configs.length === 0) {
    console.warn('[enable-telegram-all] No TelegramConfig — save token + chat ID in admin first')
  }
}

main()
  .catch((err) => {
    console.error('[enable-telegram-all] failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
