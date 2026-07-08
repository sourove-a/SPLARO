#!/usr/bin/env node
/**
 * Shared port helpers for SPLARO API dev (preflight, dev-stack, api-dev).
 */
import { spawnSync } from 'child_process'

export function getApiPort() {
  return Number(process.env.API_PORT ?? process.env.PORT_API ?? 4000)
}

export function getListeningPids(port) {
  const result = spawnSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' })
  if (result.status !== 0 || !result.stdout?.trim()) return []
  return result.stdout
    .trim()
    .split('\n')
    .map((value) => Number(value))
    .filter((pid) => Number.isFinite(pid) && pid > 0)
}

export async function checkApiHealth(port = getApiPort()) {
  const url = `http://127.0.0.1:${port}/api/v1/health`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), cache: 'no-store' })
    if (!res.ok) return false
    const body = await res.json()
    return body?.service === 'splaro-api' && body?.status === 'ok'
  } catch {
    return false
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Free a stale listener on `port`. Keeps a healthy SPLARO API unless force=true.
 */
export async function reclaimPort(port = getApiPort(), { force = false } = {}) {
  const pids = getListeningPids(port)
  if (!pids.length) return { reclaimed: false, reason: 'free', pids: [] }

  const healthy = await checkApiHealth(port)
  if (healthy && !force) {
    return { reclaimed: false, reason: 'healthy', pids }
  }

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      /* ignore */
    }
  }

  await sleep(450)

  for (const pid of getListeningPids(port)) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* ignore */
    }
  }

  await sleep(250)

  return { reclaimed: true, reason: healthy ? 'forced' : 'stale', pids }
}

function getProcessTable() {
  const result = spawnSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' })
  if (result.status !== 0 || !result.stdout) return []
  return result.stdout
    .trim()
    .split('\n')
    .map((line) => {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
      return m ? { pid: Number(m[1]), ppid: Number(m[2]), command: m[3] } : null
    })
    .filter(Boolean)
}

function buildParentIndex(table) {
  const byParent = new Map()
  for (const row of table) {
    if (!byParent.has(row.ppid)) byParent.set(row.ppid, [])
    byParent.get(row.ppid).push(row.pid)
  }
  return byParent
}

/** Descendants + ancestors — used to PROTECT the live listener's whole chain. */
function collectTree(rootPids, table) {
  const byParent = buildParentIndex(table)
  const byPid = new Map(table.map((row) => [row.pid, row]))
  const seen = new Set()
  const queue = [...rootPids]
  while (queue.length) {
    const pid = queue.shift()
    if (seen.has(pid)) continue
    seen.add(pid)
    for (const child of byParent.get(pid) ?? []) queue.push(child)
    const row = byPid.get(pid)
    if (row && row.ppid > 1 && !seen.has(row.ppid)) queue.push(row.ppid)
  }
  return seen
}

/** Descendants ONLY — used for kill targets so we never climb into the
 *  user's terminal/IDE that happened to launch an orphaned dev script. */
function collectDescendants(rootPids, table) {
  const byParent = buildParentIndex(table)
  const seen = new Set()
  const queue = [...rootPids]
  while (queue.length) {
    const pid = queue.shift()
    if (seen.has(pid)) continue
    seen.add(pid)
    for (const child of byParent.get(pid) ?? []) queue.push(child)
  }
  return seen
}

/**
 * Kill orphaned SPLARO API dev processes (crash-respawn zombies that lost the
 * port race — they spin at ~90% CPU without holding the port). The process
 * tree of whoever actually listens on `port` is always preserved.
 */
export function cleanupOrphanApiProcesses(port = getApiPort()) {
  const table = getProcessTable()
  const keepers = collectTree([...getListeningPids(port), process.pid], table)

  const isApiDevProcess = (cmd) =>
    cmd.includes('scripts/api-dev.mjs') ||
    (cmd.includes('ts-node-dev') && cmd.includes('SPLARO-BRAND')) ||
    (cmd.includes('ts-node-dev') && cmd.includes('src/main.ts'))

  const roots = table.filter((row) => isApiDevProcess(row.command) && !keepers.has(row.pid))
  if (!roots.length) return { killed: [] }

  const doomed = collectDescendants(roots.map((row) => row.pid), table)
  const killed = []
  for (const pid of doomed) {
    if (keepers.has(pid) || pid === process.pid || pid <= 1) continue
    try {
      process.kill(pid, 'SIGTERM')
      killed.push(pid)
    } catch {
      /* already gone */
    }
  }
  if (killed.length) {
    setTimeout(() => {
      for (const pid of killed) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          /* exited cleanly */
        }
      }
    }, 600)
    console.log(`🧹 Cleaned ${killed.length} orphaned API dev process(es): ${killed.join(', ')}`)
  }
  return { killed }
}

export async function waitForPortFree(port = getApiPort(), maxMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (!getListeningPids(port).length) return true
    await sleep(150)
  }
  return !getListeningPids(port).length
}
