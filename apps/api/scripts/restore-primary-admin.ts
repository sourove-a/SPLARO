/**
 * Restore / heal primary owner admin (ADMIN_EMAIL / splaro.bd@gmail.com).
 *
 * Usage (VPS or local with .env loaded):
 *   node scripts/api-ts-run.mjs scripts/restore-primary-admin.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = (
  process.env['ADMIN_EMAIL'] ??
  process.env['CEO_EMAIL'] ??
  'splaro.bd@gmail.com'
)
  .trim()
  .toLowerCase()

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) {
    throw new Error('Store slug=splaro not found')
  }

  let admin = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    throw new Error(
      `User ${ADMIN_EMAIL} not found — run pnpm db:seed first (creates the primary admin).`,
    )
  }

  const tgUser = await prisma.telegramUser.findFirst({
    where: { isActive: true, role: 'SUPER_ADMIN', config: { storeId: store.id, isActive: true } },
    orderBy: { createdAt: 'asc' },
    select: { telegramId: true, username: true },
  })
  const cfg = await prisma.telegramConfig.findFirst({
    where: { storeId: store.id, isActive: true },
    select: { chatId: true },
  })
  const envTg = process.env['TELEGRAM_ADMIN_USER_ID']?.trim()
  const chatId = admin.telegramId?.trim() || tgUser?.telegramId?.trim() || cfg?.chatId?.trim() || envTg || null

  admin = await prisma.user.update({
    where: { id: admin.id },
    data: {
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
      firstName: admin.firstName?.trim() || 'SPLARO',
      lastName: ADMIN_EMAIL === 'splaro.bd@gmail.com' ? 'CEO' : admin.lastName?.trim() || 'Admin',
      ...(chatId
        ? {
            telegramId: chatId,
            telegramUsername: tgUser?.username ?? admin.telegramUsername,
            twoFAEnabled: true,
          }
        : {}),
    },
  })

  await prisma.staffRole.upsert({
    where: { userId_storeId: { userId: admin.id, storeId: store.id } },
    create: {
      userId: admin.id,
      storeId: store.id,
      role: 'SUPER_ADMIN',
      permissions: ['*'],
    },
    update: { role: 'SUPER_ADMIN', permissions: ['*'] },
  })

  if (store.ownerId !== admin.id) {
    await prisma.store.update({
      where: { id: store.id },
      data: { ownerId: admin.id },
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        telegramId: admin.telegramId,
        storeOwner: true,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
