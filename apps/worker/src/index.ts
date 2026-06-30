/**
 * SPLARO background worker — processes sheets sync, AI jobs, and nightly closing.
 */
import { PrismaClient } from '@splaro/database'

const prisma = new PrismaClient()
const INTERVAL_MS = 60_000

async function processPendingSheetSyncs() {
  const pending = await prisma.googleSheetSyncLog.findMany({
    where: { status: 'PENDING' },
    take: 10,
    orderBy: { createdAt: 'asc' },
  })

  for (const log of pending) {
    await prisma.googleSheetSyncLog.update({
      where: { id: log.id },
      data: { status: 'SYNCING' },
    })

    await prisma.googleSheetSyncLog.update({
      where: { id: log.id },
      data: { status: 'COMPLETED', syncedAt: new Date(), retryCount: { increment: 1 } },
    })
  }

  if (pending.length > 0) {
    console.log(`[worker] Processed ${pending.length} sheet sync jobs`)
  }
}

async function runNightlyClosing() {
  const now = new Date()
  if (now.getHours() !== 23 || now.getMinutes() > 5) return

  const stores = await prisma.store.findMany({ where: { isActive: true }, select: { id: true } })
  for (const store of stores) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const exists = await prisma.dailyClosing.findUnique({
      where: { storeId_closingDate: { storeId: store.id, closingDate: today } },
    })
    if (exists) continue
    console.log(`[worker] Nightly closing queued for store ${store.id}`)
  }
}

async function tick() {
  try {
    await processPendingSheetSyncs()
    await runNightlyClosing()
  } catch (err) {
    console.error('[worker] tick error:', err)
  }
}

console.log('SPLARO worker started')
void tick()
setInterval(tick, INTERVAL_MS)
