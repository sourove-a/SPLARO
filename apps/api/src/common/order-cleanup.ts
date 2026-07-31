import type { LoyaltyTier, Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

const DEFAULT_LOYALTY_THRESHOLDS: Array<{ tier: LoyaltyTier; minPoints: number }> = [
  { tier: 'DIAMOND', minPoints: 10_000 },
  { tier: 'PLATINUM', minPoints: 5_000 },
  { tier: 'GOLD', minPoints: 2_000 },
  { tier: 'SILVER', minPoints: 500 },
  { tier: 'BRONZE', minPoints: 0 },
]

/** Deletes an order and all related rows that block FK constraints. */
export async function deleteOrderWithRelations(tx: Tx, orderId: string): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      storeId: true,
      customerId: true,
      couponId: true,
      courier: { select: { id: true } },
      invoice: { select: { id: true } },
    },
  })
  if (!order) return false

  const loyaltyEntries = await tx.loyaltyHistory.findMany({
    where: { orderId },
    select: { customerId: true, points: true },
  })
  const loyaltyDelta = loyaltyEntries.reduce((sum, entry) => sum + entry.points, 0)
  if (order.customerId && loyaltyEntries.length > 0) {
    const customer = await tx.customer.findUnique({
      where: { id: order.customerId },
      select: { loyaltyPoints: true },
    })
    if (customer) {
      const nextPoints = Math.max(0, customer.loyaltyPoints - loyaltyDelta)
      const configured = await tx.loyaltyTierConfig.findMany({
        where: { storeId: order.storeId },
        orderBy: { minPoints: 'desc' },
        select: { tier: true, minPoints: true },
      })
      const thresholds = configured.length > 0 ? configured : DEFAULT_LOYALTY_THRESHOLDS
      const loyaltyTier = thresholds.find((row) => nextPoints >= row.minPoints)?.tier ?? 'BRONZE'
      await tx.customer.update({
        where: { id: order.customerId },
        data: { loyaltyPoints: nextPoints, loyaltyTier },
      })
    }
  }
  await tx.loyaltyHistory.deleteMany({ where: { orderId } })

  const couponRedemptions = await tx.couponRedemption.count({ where: { orderId } })
  await tx.couponRedemption.deleteMany({ where: { orderId } })
  if (order.couponId && couponRedemptions > 0) {
    await tx.coupon.updateMany({
      where: { id: order.couponId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: couponRedemptions } },
    })
  }

  const rmas = await tx.rMA.findMany({ where: { orderId }, select: { id: true } })
  for (const rma of rmas) {
    await tx.rMAItem.deleteMany({ where: { rmaId: rma.id } })
    await tx.rMAStatusHistory.deleteMany({ where: { rmaId: rma.id } })
    await tx.rMA.delete({ where: { id: rma.id } })
  }

  await tx.profitCalculation.deleteMany({ where: { orderId } })
  await tx.partnerTransaction.deleteMany({ where: { orderId } })
  await tx.googleSheetSync.deleteMany({ where: { orderId } })
  await tx.notification.deleteMany({ where: { orderId } })
  await tx.aIJob.deleteMany({ where: { orderId } })
  await tx.deliveryAssignment.deleteMany({ where: { orderId } })
  await tx.payment.deleteMany({ where: { orderId } })

  if (order.courier?.id) {
    await tx.courierWebhookEvent.deleteMany({ where: { shipmentId: order.courier.id } })
    await tx.courierShipment.delete({ where: { id: order.courier.id } })
  }

  if (order.invoice?.id) {
    await tx.printJob.deleteMany({
      where: { OR: [{ invoiceId: order.invoice.id }, { orderId }] },
    })
    await tx.invoice.delete({ where: { id: order.invoice.id } })
  } else {
    await tx.printJob.deleteMany({ where: { orderId } })
  }

  await tx.orderStatusHistory.deleteMany({ where: { orderId } })
  await tx.orderItem.deleteMany({ where: { orderId } })
  await tx.orderNote.deleteMany({ where: { orderId } })
  await tx.splitShipment.deleteMany({ where: { orderId } })
  await tx.order.delete({ where: { id: orderId } })
  return true
}
