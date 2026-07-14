#!/usr/bin/env node
/**
 * Pre-push gate — same checks that broke CI on GitHub (type-check + web lint).
 * Full mirror: pnpm ci:verify  |  bypass once: SPLARO_SKIP_PRE_PUSH=1 git push
 */
import { spawnSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cliSpawnOpts } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args) {
  const label = `${cmd} ${args.join(' ')}`
  console.log(`\n▶ ${label}`)
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...cliSpawnOpts() })
  if (result.status !== 0) {
    console.error(`\n❌ Pre-push blocked: ${label}`)
    console.error('Fix the errors above, or run full check: pnpm ci:verify')
    console.error('Emergency bypass (once): SPLARO_SKIP_PRE_PUSH=1 git push')
    process.exit(result.status ?? 1)
  }
}

if (process.env.SPLARO_SKIP_PRE_PUSH === '1') {
  console.warn('⚠️  SPLARO_SKIP_PRE_PUSH=1 — skipping pre-push checks')
  process.exit(0)
}

console.log('═══ SPLARO pre-push (CI gate) ═══')
run('node', ['scripts/verify-css.mjs'])
run('pnpm', ['type-check'])
run('pnpm', ['--filter', '@splaro/web', 'lint'])
run('pnpm', ['--filter', '@splaro/admin', 'lint'])
run('pnpm', ['--filter', '@splaro/api', 'lint'])
run('pnpm', ['--filter', '@splaro/api', 'test:unit'])
run('pnpm', ['--filter', '@splaro/api', 'test:e2e'])
console.log('\n✅ Pre-push checks passed — pushing…')
console.log('   Full mirror (build + smoke): pnpm ci:verify')
console.log('   Production deploy: push main → VPS (see infrastructure/vps/)\n')
