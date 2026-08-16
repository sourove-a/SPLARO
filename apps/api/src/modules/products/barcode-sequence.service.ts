import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { BARCODE_START, formatBarcode } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'

const BARCODE_KEY = 'barcode'

/**
 * Reserve `count` consecutive internal barcodes.
 *
 * Exported as a plain function so the CSV importer (which runs outside Nest DI)
 * uses the exact same counter as the admin panel — two implementations would be
 * two independent sequences.
 */
export async function reserveBarcodes(
  tx: Prisma.TransactionClient,
  count: number,
): Promise<string[]> {
  const size = Math.max(0, Math.floor(count))
  if (size === 0) return []

  // Seeded by migration; the upsert only matters for a database restored
  // without it (and never resets an existing counter).
  await tx.$executeRaw`
    INSERT INTO "CodeSequence" ("key", "nextValue", "updatedAt")
    VALUES (${BARCODE_KEY}, ${BigInt(BARCODE_START)}, NOW())
    ON CONFLICT ("key") DO NOTHING
  `

  const rows = await tx.$queryRaw<{ nextValue: bigint }[]>`
    UPDATE "CodeSequence"
    SET "nextValue" = "nextValue" + ${BigInt(size)}, "updatedAt" = NOW()
    WHERE "key" = ${BARCODE_KEY}
    RETURNING "nextValue"
  `
  const after = rows[0]?.nextValue
  if (after === undefined) {
    throw new Error('Barcode counter row is missing')
  }

  // `after` is the value *following* this block, so the block starts that many back.
  const first = after - BigInt(size)
  return Array.from({ length: size }, (_, index) => formatBarcode(first + BigInt(index)))
}

/**
 * Hands out the next internal CODE128 barcode.
 *
 * The counter lives in `CodeSequence` and is advanced with a single
 * `UPDATE ... RETURNING`, which takes a row lock for the duration of the caller's
 * transaction. Two admins saving products concurrently therefore serialise on
 * that row and receive different numbers — `MAX(barcode) + 1` would hand both
 * the same value.
 */
@Injectable()
export class BarcodeSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reserve one barcode. Must be called inside the transaction that saves the variant. */
  async next(tx: Prisma.TransactionClient): Promise<string> {
    const [value] = await this.nextBatch(tx, 1)
    return value!
  }

  /**
   * Reserve `count` consecutive barcodes in one round trip — a 6-variant matrix
   * should not take six locks.
   */
  async nextBatch(tx: Prisma.TransactionClient, count: number): Promise<string[]> {
    return reserveBarcodes(tx, count)
  }

  /** True when the barcode is already used by a different variant. */
  async isTaken(barcode: string, ignoreVariantId?: string): Promise<boolean> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { barcode },
      select: { id: true },
    })
    return Boolean(existing && existing.id !== ignoreVariantId)
  }
}
