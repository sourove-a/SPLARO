import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/**
 * Return an order's items to variant stock (cancel/refund/delete). Uses an
 * InventoryLog row with action=RETURN keyed by orderId as the idempotency
 * marker, so a cancel followed by a refund (or a retried request) can never
 * restore the same stock twice.
 *
 * Returns the number of variants restored (0 when already restored or no
 * variant-linked items).
 */
export async function restoreOrderStock(tx: Tx, orderId: string, note: string): Promise<number> {
  const alreadyRestored = await tx.inventoryLog.findFirst({
    where: { orderId, action: 'RETURN' },
    select: { id: true },
  })
  if (alreadyRestored) return 0

  const items = await tx.orderItem.findMany({
    where: { orderId, variantId: { not: null } },
    select: { productId: true, variantId: true, quantity: true },
  })

  let restored = 0
  for (const item of items) {
    if (!item.variantId) continue
    const variant = await tx.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stock: true },
    })
    if (!variant) continue

    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { increment: item.quantity } },
    })
    await tx.inventoryLog.create({
      data: {
        productId: item.productId,
        variantId: item.variantId,
        action: 'RETURN',
        quantity: item.quantity,
        stockBefore: variant.stock,
        stockAfter: variant.stock + item.quantity,
        orderId,
        note,
      },
    })
    restored += 1
  }
  return restored
}
