/**
 * SPLARO background worker — nightly closing watch.
 *
 * It used to also "process" googleSheetSyncLog: it flipped every PENDING row to
 * COMPLETED without writing a single cell, so the admin saw a green sync that
 * never happened. Real Google Sheets pushes go through the google-sync BullMQ
 * queue in the API (GoogleSyncProcessor), which owns those rows now.
 */
import { PrismaClient } from '@splaro/database'

const prisma = new PrismaClient()
const INTERVAL_MS = 60_000

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
    await runNightlyClosing()
  } catch (err) {
    console.error('[worker] tick error:', err)
  }
}

console.log('SPLARO worker started')
void tick()
setInterval(tick, INTERVAL_MS)
