#!/usr/bin/env node
/**
 * One-time: point git at .githooks/ so pre-push runs CI gate locally.
 * Usage: pnpm setup:hooks
 */
import { spawnSync } from 'child_process'
import { chmodSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cliSpawnOpts, IS_WIN } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOOKS = resolve(ROOT, '.githooks')
const PRE_PUSH = resolve(HOOKS, 'pre-push')

if (!existsSync(PRE_PUSH)) {
  console.error('Missing .githooks/pre-push')
  process.exit(1)
}

if (!IS_WIN) {
  chmodSync(PRE_PUSH, 0o755)
}

const setPath = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: ROOT,
  stdio: 'inherit',
  ...cliSpawnOpts(),
})

if (setPath.status !== 0) process.exit(setPath.status ?? 1)

const current = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
  cwd: ROOT,
  encoding: 'utf8',
  ...cliSpawnOpts(),
})

console.log('\n✅ Git hooks enabled')
console.log(`   core.hooksPath = ${(current.stdout ?? '').trim() || '.githooks'}`)
console.log('   Before every push: type-check + web/admin lint + CSS')
console.log('   Hostinger deploy: pnpm deploy:hostinger  (pre-deploy + push)')
console.log('   Full CI mirror:   pnpm ci:verify')
console.log('   Safe push:        pnpm push:safe\n')
