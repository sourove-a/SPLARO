import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

// Load .env file from the root directory
const envPath = path.resolve(__dirname, '../../../.env')
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8')
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split('=')
    const key = parts[0].trim()
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
    process.env[key] = val
  }
  console.log(`Loaded environment from: ${envPath}`)
} else {
  console.warn(`Warning: .env file not found at ${envPath}`)
}

const prisma = new PrismaClient()

async function main() {
  const storeSlug = process.env.TELEGRAM_STORE_SLUG ?? 'splaro'
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const userId = process.env.TELEGRAM_ADMIN_USER_ID?.trim()

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env')
    process.exit(1)
  }
  if (!userId) {
    console.error('❌ TELEGRAM_ADMIN_USER_ID is missing in .env (your Telegram numeric user/chat id)')
    process.exit(1)
  }

  console.log(`Configuring Telegram for store: ${storeSlug}`)

  // 1. Find store
  const store = await prisma.store.findFirst({ where: { slug: storeSlug } })
  if (!store) {
    console.error(`❌ Store with slug "${storeSlug}" not found! Please seed the database first.`)
    process.exit(1)
  }

  console.log(`✅ Found store: ${store.name} (ID: ${store.id})`)

  // 2. Upsert TelegramConfig
  const config = await prisma.telegramConfig.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      botToken: botToken,
      chatId: userId,
      isActive: true,
      notifyOrders: true,
      notifyPayments: true,
      notifyCourier: true,
      notifyStock: true,
      notifyReviews: true,
      notifyRMA: true,
      reportDaily: true,
      reportWeekly: true,
    },
    update: {
      botToken: botToken,
      chatId: userId,
      isActive: true,
      notifyOrders: true,
      notifyPayments: true,
      notifyCourier: true,
      notifyStock: true,
      notifyReviews: true,
      notifyRMA: true,
      reportDaily: true,
      reportWeekly: true,
    },
  })

  console.log(`✅ TelegramConfig configured (ID: ${config.id})`)

  // 3. Upsert TelegramUser as SUPER_ADMIN
  const teleUser = await prisma.telegramUser.upsert({
    where: {
      configId_telegramId: {
        configId: config.id,
        telegramId: userId,
      },
    },
    create: {
      configId: config.id,
      telegramId: userId,
      username: 'sourove',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    update: {
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })

  console.log(`✅ TelegramUser configured as SUPER_ADMIN (ID: ${teleUser.id})`)

  // 4. Update SiteSettings to enable Telegram
  await prisma.siteSettings.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      telegramEnabled: true,
    },
    update: {
      telegramEnabled: true,
    },
  })

  console.log(`✅ SiteSettings updated: telegramEnabled = true`)
  console.log('🎉 Telegram configuration completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error configuring telegram:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
