import { ForbiddenException } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { resolveStoreId } from '../../common/store.util'
import type { PrismaService } from '../../common/prisma.service'
import { DEFAULT_AGENT_SYSTEM_PROMPT } from './prompts/system.prompt'

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

/**
 * Concurrent health/smoke probes race on first create — Prisma upsert can throw
 * P2002 Unique constraint on storeId. Retry as findUnique when that happens.
 */
export async function ensureAgentConfigRow(prisma: PrismaService, storeId: string) {
  try {
    return await prisma.agentConfig.upsert({
      where: { storeId },
      create: { storeId, systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT },
      update: {},
    })
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === 'P2002') {
      return prisma.agentConfig.findUniqueOrThrow({ where: { storeId } })
    }
    throw error
  }
}
