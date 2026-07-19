#!/usr/bin/env node
/**
 * Stop next *dev* on a port before `next build`.
 * Running build while next dev is active corrupts .next (Cannot find module './899.js').
 *
 * Never kill production (PM2 standalone / Nest dist) — that used to take down
 * the live VPS site when deploy ran `next build` on :3000/:3001.
 */
import { getListeningPids, reclaimPort } from './api-port.mjs'
import { getCommandLineForPid, getProcessTable } from './port-utils.mjs'

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
  const fromTable = String(row?.command ?? row?.cmd ?? '').trim()
  if (fromTable) return fromTable
  // Windows: bulk table sometimes misses the listener — query that PID directly.
  return getCommandLineForPid(pid)
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
  if (!cmd) return false
  if (isProductionListener(cmd)) return false
  if (/next[\s"']+build/i.test(cmd)) return false
  return /next[\s"']+dev\b/i.test(cmd) || /next\/dist\/server\/lib\/start-server/i.test(cmd)
}

const commands = pids.map((pid) => ({ pid, cmd: commandFor(pid) }))

const prod = commands.filter((row) => isProductionListener(row.cmd))
if (prod.length) {
  console.log(
    `\nℹ️  Port :${port} is production (PM2) — leaving it alone for build (pids: ${prod.map((r) => r.pid).join(', ')})`,
  )
  process.exit(0)
}

const devPids = commands.filter((row) => looksLikeNextDev(row.cmd)).map((row) => row.pid)
if (!devPids.length) {
  // Last resort on Windows: empty command lines + known local Next ports.
  // Prefer reclaim over leaving a zombie that corrupts the next `next build`.
  const unknown = commands.every((row) => !row.cmd)
  if (unknown && (port === 3000 || port === 3001)) {
    console.log(
      `\n⚠️  Port :${port} busy but process command unavailable — reclaiming for local Next safety`,
    )
    await reclaimPort(port, { force: true })
    process.exit(0)
  }
  console.log(`\nℹ️  Port :${port} busy but not next dev — not killing (pids: ${pids.join(', ')})`)
  process.exit(0)
}

console.log(`\n⚠️  Stopping next dev on :${port} before production build`)
await reclaimPort(port, { force: true })
