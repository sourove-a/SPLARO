import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/** Deletes an order and all related rows that block FK constraints. */
export async function deleteOrderWithRelations(tx: Tx, orderId: string): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      courier: { select: { id: true } },
      invoice: { select: { id: true } },
    },
  })
  if (!order) return false

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
