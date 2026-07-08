#!/usr/bin/env node
/**
 * Dev entry for @splaro/api — clears stale :4000 listeners, then ts-node-dev.
 */
import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { cleanupOrphanApiProcesses, getApiPort, reclaimPort, waitForPortFree } from './api-port.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = resolve(ROOT, 'apps/api')
const port = getApiPort()

cleanupOrphanApiProcesses(port)
const reclaim = await reclaimPort(port)
if (reclaim.reason === 'healthy') {
  // Do NOT spawn a duplicate — it loses the port race and ts-node-dev --respawn
  // restarts the doomed child forever at ~90% CPU (zombie crash-loop).
  console.warn(
    `\n⚠️  SPLARO API already running on :${port} (PID ${reclaim.pids[0]}) — reusing it.\n` +
      `   Stop the other dev:api / dev:stack terminal first for a fresh instance,\n` +
      `   or set API_PORT to run a second one.\n`,
  )
  process.exit(0)
} else if (reclaim.reclaimed) {
  console.log(`🔧 Cleared stale listener on :${port}`)
  await waitForPortFree(port)
}

const child = spawn(
  'pnpm',
  [
    'exec',
    'ts-node-dev',
    '--respawn',
    '--transpile-only',
    '--exit-child',
    '--no-notify',
    '--project',
    'tsconfig.dev.json',
    '-r',
    'reflect-metadata',
    'src/main.ts',
  ],
  {
    cwd: API_DIR,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  },
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
