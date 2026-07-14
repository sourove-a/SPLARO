import { ForbiddenException } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { resolveStoreId } from '../../common/store.util'
import type { PrismaService } from '../../common/prisma.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

/** Bind query storeId to authenticated admin session store when present. */
export async function resolveAgentStoreId(
  prisma: PrismaService,
  storeIdRaw: string | undefined,
  req?: AdminRequest,
): Promise<string> {
  const resolved = await resolveStoreId(prisma, storeIdRaw)
  const sessionStore = req?.adminUser?.storeId
  if (sessionStore && sessionStore !== resolved) {
    throw new ForbiddenException('storeId does not match your admin session store')
  }
  return resolved
}
