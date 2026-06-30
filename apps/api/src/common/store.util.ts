import { NotFoundException } from '@nestjs/common'
import type { PrismaService } from './prisma.service'

export async function resolveStoreId(
  prisma: PrismaService,
  storeIdOrSlug?: string,
): Promise<string> {
  const candidates = [
    storeIdOrSlug?.trim(),
    process.env['DEFAULT_STORE_SLUG'],
    process.env['NEXT_PUBLIC_STORE_ID'],
    'splaro',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i) as string[]

  for (const candidate of candidates) {
    const store = await prisma.store.findFirst({
      where: { OR: [{ id: candidate }, { slug: candidate }] },
      select: { id: true },
    })
    if (store) return store.id
  }

  throw new NotFoundException(
    `Store not found (${candidates.join(' → ')}). Run: pnpm db:push && pnpm db:seed`,
  )
}

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}
