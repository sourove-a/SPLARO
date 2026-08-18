/**
 * Restore / heal primary owner admin (ADMIN_EMAIL / splaro.bd@gmail.com).
 *
 * Usage (VPS or local with .env loaded):
 *   node scripts/api-ts-run.mjs scripts/restore-primary-admin.ts
 */
import { PrismaClient } from '@prisma/client'
import { ensurePrimaryOwnerAdmin } from '../src/modules/auth/ensure-primary-admin'

const prisma = new PrismaClient()

async function main() {
  const result = await ensurePrimaryOwnerAdmin(prisma)
  const admin = await prisma.user.findUnique({
    where: { id: result.id },
    select: { email: true, role: true, isActive: true, telegramId: true },
  })
  console.log(
    JSON.stringify(
      {
        ok: true,
        created: result.created,
        email: admin?.email ?? result.email,
        role: admin?.role,
        isActive: admin?.isActive,
        telegramId: admin?.telegramId,
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
