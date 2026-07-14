#!/usr/bin/env node
/**
 * Cross-platform clean — turbo clean + remove root node_modules/.turbo.
 */
import { existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { cliSpawnOpts } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function rm(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
    console.log(`  removed ${path}`)
  }
}

console.log('SPLARO clean — turbo + root caches…')
spawnSync('pnpm', ['exec', 'turbo', 'run', 'clean'], {
  cwd: ROOT,
  stdio: 'inherit',
  ...cliSpawnOpts(),
})

rm(resolve(ROOT, 'node_modules'))
rm(resolve(ROOT, '.turbo'))
console.log('\nDone. Run: pnpm install\n')
