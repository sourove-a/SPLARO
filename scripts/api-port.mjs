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

export async function waitForPortFree(port = getApiPort(), maxMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (!getListeningPids(port).length) return true
    await sleep(150)
  }
  return !getListeningPids(port).length
}
