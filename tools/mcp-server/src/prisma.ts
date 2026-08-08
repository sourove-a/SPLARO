import { PrismaClient } from '@prisma/client'
import { configuredStoreId, log, requireDatabaseUrl } from './env.ts'

/**
 * Methods a delegate is allowed to expose. Anything that can write — create,
 * update, delete, upsert, createMany, raw execution — is refused at the proxy
 * so a prompt-injected or buggy tool cannot mutate production data.
 */
const READ_METHODS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'fields',
])

class ReadOnlyViolation extends Error {
  constructor(what: string) {
    super(`Read-only MCP server refused a write operation: ${what}`)
    this.name = 'ReadOnlyViolation'
  }
}

function guardDelegate(delegate: object, model: string): object {
  return new Proxy(delegate, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(target, prop, receiver)
      if (!READ_METHODS.has(prop)) throw new ReadOnlyViolation(`${model}.${prop}`)
      return Reflect.get(target, prop, receiver)
    },
  })
}

function guardClient(client: PrismaClient): PrismaClient {
  const delegateCache = new Map<string, object>()

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(target, prop, receiver)

      if (prop.startsWith('$')) {
        // $connect / $disconnect are lifecycle; raw access and transactions are not.
        if (prop === '$connect' || prop === '$disconnect' || prop === '$on') {
          return Reflect.get(target, prop, receiver)
        }
        throw new ReadOnlyViolation(prop)
      }

      // Underscore-prefixed members are Prisma's own internals (the engine,
      // the client config). They are not model delegates, so pass them
      // through untouched or lifecycle calls break.
      if (prop.startsWith('_')) return Reflect.get(target, prop, receiver)

      const value = Reflect.get(target, prop, receiver)
      if (!value || typeof value !== 'object') return value

      const cached = delegateCache.get(prop)
      if (cached) return cached

      const guarded = guardDelegate(value as object, prop)
      delegateCache.set(prop, guarded)
      return guarded
    },
  }) as PrismaClient
}

let client: PrismaClient | null = null

export function prisma(): PrismaClient {
  if (client) return client
  const raw = new PrismaClient({
    datasources: { db: { url: requireDatabaseUrl() } },
    log: ['warn', 'error'],
  })
  client = guardClient(raw)
  return client
}

let resolvedStoreId: string | null = null

/**
 * Every query is scoped to one store. Pinned by SPLARO_MCP_STORE_ID when set,
 * otherwise the oldest active store — which is the real one on this install.
 */
export async function storeId(): Promise<string> {
  if (resolvedStoreId) return resolvedStoreId

  const pinned = configuredStoreId()
  if (pinned) {
    // NEXT_PUBLIC_STORE_ID holds a slug on this install, so accept either form.
    const found = await prisma().store.findFirst({
      where: { OR: [{ id: pinned }, { slug: pinned }] },
      select: { id: true, name: true },
    })
    if (!found) throw new Error(`Configured store "${pinned}" matched no store id or slug.`)
    log(`store: ${found.name} (${found.id})`)
    resolvedStoreId = found.id
    return found.id
  }

  const first = await prisma().store.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  })
  if (!first) throw new Error('No active store found in the database.')
  log(`store: ${first.name} (${first.id})`)
  resolvedStoreId = first.id
  return first.id
}
