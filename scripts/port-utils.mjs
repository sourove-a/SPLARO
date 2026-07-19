#!/usr/bin/env node
/**
 * Cross-platform port helpers — macOS/Linux (lsof) + Windows (netstat/taskkill).
 *
 * Windows notes (owner lock — do not regress):
 * - Always `taskkill /T /F` — soft kill without /F leaves Node/Next zombies holding ports.
 * - Prefer 127.0.0.1 health checks (see spawn-utils / api-port) — localhost → ::1 stalls.
 * - Process command lookup uses PowerShell CIM; falls back per-PID if the bulk table is empty.
 */
import { spawnSync } from 'child_process'

const IS_WIN = process.platform === 'win32'

export function getListeningPids(port) {
  if (IS_WIN) return getListeningPidsWindows(port)
  const result = spawnSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' })
  if (result.status !== 0 || !result.stdout?.trim()) return []
  return result.stdout
    .trim()
    .split('\n')
    .map((value) => Number(value))
    .filter((pid) => Number.isFinite(pid) && pid > 0)
}

function getListeningPidsWindows(port) {
  const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true })
  if (result.status !== 0 || !result.stdout) return []
  const pids = new Set()
  /** Exact local port — avoids matching :30001 when looking for :3000. */
  const localPortRe = new RegExp(`:${port}$`)
  for (const line of result.stdout.split('\n')) {
    if (!line.includes('TCP') || !/LISTENING/i.test(line)) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const localAddr = parts[1]
    if (!localPortRe.test(localAddr)) continue
    const pid = Number(parts[parts.length - 1])
    if (Number.isFinite(pid) && pid > 0) pids.add(pid)
  }
  return [...pids]
}

export function isPortListening(port) {
  return getListeningPids(port).length > 0
}

/**
 * Resolve command line for a PID (Windows: CIM; Unix: ps).
 * Used when the bulk process table miss-filters a live Next/API listener.
 */
export function getCommandLineForPid(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return ''
  if (IS_WIN) {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `try { (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine } catch { '' }`,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    )
    return (result.stdout ?? '').replace(/^\uFEFF/, '').trim()
  }
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
  if (result.status !== 0) return ''
  return (result.stdout ?? '').trim()
}

export function killPid(pid, signal = 'SIGTERM') {
  if (!Number.isFinite(pid) || pid <= 0) return
  if (IS_WIN) {
    // Always /T /F — without /F, Node/Next often ignore WM_CLOSE and keep the port.
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  try {
    process.kill(pid, signal)
  } catch {
    /* already gone */
  }
}

/** Kill a spawned child and its tree (Windows shell wrappers + Unix descendants). */
export function killProcessTree(child, signal = 'SIGTERM') {
  if (!child?.pid) return
  if (IS_WIN) {
    killPid(child.pid, signal)
    return
  }
  try {
    process.kill(-child.pid, signal)
  } catch {
    try {
      child.kill(signal)
    } catch {
      /* already gone */
    }
  }
}

export function getProcessTable() {
  if (IS_WIN) return getProcessTableWindows()
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

function getProcessTableWindows() {
  // Path-agnostic — folder may not be named SPLARO-BRAND on every Windows clone.
  const filter =
    'next dev|ts-node-dev|api-dev\\.mjs|@splaro/|SPLARO|splaro-brand|nest start'
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `$f='${filter}'; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -match $f } | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress`,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 12000 },
  )
  if (result.status !== 0 || !result.stdout?.trim()) return []
  try {
    const raw = result.stdout.replace(/^\uFEFF/, '').trim()
    const parsed = JSON.parse(raw)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows
      .map((row) => ({
        pid: Number(row.ProcessId),
        ppid: Number(row.ParentProcessId),
        command: String(row.CommandLine ?? ''),
      }))
      .filter((row) => Number.isFinite(row.pid) && row.pid > 0)
  } catch {
    return []
  }
}
