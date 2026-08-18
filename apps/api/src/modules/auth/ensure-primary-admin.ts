import type { PrismaClient } from '@prisma/client'
import { hashPassword } from '../../common/password.util'
import { PRIMARY_OWNER_EMAIL } from '../../common/primary-owner.util'

type PrimaryOwnerDb = Pick<
  PrismaClient,
  'store' | 'user' | 'staffRole' | 'telegramUser' | 'telegramConfig'
>

export type EnsuredPrimaryOwner = {
  id: string
  email: string
  created: boolean
}

/**
 * Create or heal the lifetime SUPER_ADMIN owner (ADMIN_EMAIL).
 * Customer deletes must never leave this login missing.
 */
export async function ensurePrimaryOwnerAdmin(prisma: PrimaryOwnerDb): Promise<EnsuredPrimaryOwner> {
  const email = PRIMARY_OWNER_EMAIL
  const store = await prisma.store.findFirst({
    where: { slug: 'splaro' },
    select: { id: true, ownerId: true },
  })
  if (!store) {
    throw new Error('Store slug=splaro not found')
  }

  let created = false
  let admin = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      telegramId: true,
      telegramUsername: true,
      passwordHash: true,
    },
  })

  if (!admin) {
    const envPassword = process.env['ADMIN_PASSWORD']?.trim()
    admin = await prisma.user.create({
      data: {
        email,
        emailVerified: true,
        firstName: 'SPLARO',
        lastName: email === 'splaro.bd@gmail.com' ? 'CEO' : 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        twoFAEnabled: false,
        ...(envPassword ? { passwordHash: hashPassword(envPassword) } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        telegramUsername: true,
        passwordHash: true,
      },
    })
    created = true
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        emailVerified: true,
        role: 'SUPER_ADMIN',
        isActive: true,
        firstName: admin.firstName?.trim() || 'SPLARO',
        lastName:
          email === 'splaro.bd@gmail.com' ? 'CEO' : admin.lastName?.trim() || 'Admin',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        telegramUsername: true,
        passwordHash: true,
      },
    })
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

  if (chatId && !admin.telegramId?.trim()) {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        telegramId: chatId,
        telegramUsername: tgUser?.username ?? admin.telegramUsername,
        twoFAEnabled: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        telegramUsername: true,
        passwordHash: true,
      },
    })
  }

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

  return { id: admin.id, email: admin.email ?? email, created }
}
