#!/usr/bin/env node
/**
 * Stop next *dev* on a port before `next build`.
 * Running build while next dev is active corrupts .next (Cannot find module './899.js').
 *
 * Never kill production (PM2 standalone / Nest dist) — that used to take down
 * the live VPS site when deploy ran `next build` on :3000/:3001.
 */
import { getListeningPids, reclaimPort } from './api-port.mjs'
import { getProcessTable } from './port-utils.mjs'

const port = Number(process.argv[2])
if (!port) {
  console.error('Usage: node scripts/stop-next-dev-for-build.mjs <port>')
  process.exit(1)
}

const pids = getListeningPids(port)
if (!pids.length) process.exit(0)

const table = getProcessTable()
const byPid = new Map(table.map((row) => [row.pid, row]))

function commandFor(pid) {
  const row = byPid.get(pid)
  return String(row?.command ?? row?.cmd ?? '')
}

function isProductionListener(cmd) {
  // PM2 production apps (standalone Next / Nest API)
  if (/standalone|\.next\/standalone|dist\/main\.js/i.test(cmd)) return true
  if (/\bPM2\b|God Daemon/i.test(cmd)) return true
  // next production server started without "dev"
  if (/next[\s"'].*start/i.test(cmd)) return true
  return false
}

function looksLikeNextDev(cmd) {
  if (isProductionListener(cmd)) return false
  if (/next[\s"']+build/i.test(cmd)) return false
  return /next[\s"']+dev\b/i.test(cmd) || /next\/dist\/server\/lib\/start-server/i.test(cmd)
}

const prod = pids.filter((pid) => isProductionListener(commandFor(pid)))
if (prod.length) {
  console.log(
    `\nℹ️  Port :${port} is production (PM2) — leaving it alone for build (pids: ${prod.join(', ')})`,
  )
  process.exit(0)
}

const devPids = pids.filter((pid) => looksLikeNextDev(commandFor(pid)))
if (!devPids.length) {
  console.log(`\nℹ️  Port :${port} busy but not next dev — not killing (pids: ${pids.join(', ')})`)
  process.exit(0)
}

console.log(`\n⚠️  Stopping next dev on :${port} before production build`)
await reclaimPort(port, { force: true })
