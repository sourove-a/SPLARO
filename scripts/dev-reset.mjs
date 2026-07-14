#!/usr/bin/env node
/**
 * Fix corrupt Next dev (webpack "reading 'call'", fallback/_app errors):
 * kill stale :3000/:3001/:4000, clear .next cache, restart dev:stack.
 */
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reclaimNextDevPorts, reclaimPort } from './api-port.mjs'
import { IS_WIN, killProcessTree, spawnCli } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORTS = [3000, 3001, 4000]

function rm(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
    console.log(`  removed ${relative(ROOT, path)}`)
  }
}

console.log('SPLARO dev:reset — killing stale servers…')
await reclaimNextDevPorts({ label: 'dev:reset' })
const apiResult = await reclaimPort(PORTS[2], { force: true })
if (apiResult.reclaimed) {
  console.log(`  :${PORTS[2]} reclaimed (was pids ${apiResult.pids.join(',')})`)
} else {
  console.log(`  :${PORTS[2]} ${apiResult.reason}`)
}

console.log('\nClearing Next.js cache…')
rm(join(ROOT, 'apps/web/.next'))
rm(join(ROOT, 'apps/web/tsconfig.tsbuildinfo'))
rm(join(ROOT, 'apps/admin/.next'))
rm(join(ROOT, 'apps/admin/tsconfig.tsbuildinfo'))

console.log('\nStarting pnpm dev:stack …')
const refreshHint = IS_WIN ? 'Ctrl+Shift+R' : 'Cmd+Shift+R'
console.log(`Tip: hard-refresh browser (${refreshHint}) after Ready.\n`)

const child = spawnCli('pnpm', ['dev:stack'], {
  cwd: ROOT,
  env: process.env,
})

const stop = () => {
  killProcessTree(child, 'SIGTERM')
  setTimeout(() => {
    killProcessTree(child, 'SIGKILL')
    process.exit(0)
  }, 400)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

child.on('exit', (code) => process.exit(code ?? 0))
