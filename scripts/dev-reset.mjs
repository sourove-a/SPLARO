#!/usr/bin/env node
/**
 * Fix corrupt Next dev (webpack "reading 'call'", fallback/_app errors):
 * kill stale :3000/:3001/:4000, clear .next cache, restart dev:stack.
 */
import { spawn } from 'child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reclaimPort } from './api-port.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORTS = [3000, 3001, 4000]

function rm(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
    console.log(`  removed ${path.replace(ROOT + '/', '')}`)
  }
}

console.log('SPLARO dev:reset — killing stale servers…')
for (const port of PORTS) {
  const result = await reclaimPort(port, { force: true })
  if (result.reclaimed) console.log(`  :${port} reclaimed (was pids ${result.pids.join(',')})`)
  else console.log(`  :${port} ${result.reason}`)
}

console.log('\nClearing Next.js cache…')
rm(join(ROOT, 'apps/web/.next'))
rm(join(ROOT, 'apps/web/tsconfig.tsbuildinfo'))
rm(join(ROOT, 'apps/admin/.next'))
rm(join(ROOT, 'apps/admin/tsconfig.tsbuildinfo'))

console.log('\nStarting pnpm dev:stack …')
console.log('Tip: hard-refresh browser (Cmd+Shift+R) after Ready.\n')

const child = spawn('pnpm', ['dev:stack'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 0))
