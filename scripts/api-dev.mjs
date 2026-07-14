#!/usr/bin/env node
/**
 * Dev entry for @splaro/api — clears stale :4000 listeners, then ts-node-dev.
 */
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { cleanupOrphanApiProcesses, getApiPort, reclaimPort, waitForPortFree } from './api-port.mjs'
import { killProcessTree, spawnCli } from './spawn-utils.mjs'

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

const child = spawnCli(
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
    env: process.env,
  },
)

const stop = () => {
  killProcessTree(child, 'SIGTERM')
  setTimeout(() => {
    killProcessTree(child, 'SIGKILL')
    process.exit(0)
  }, 400)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
