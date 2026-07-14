#!/usr/bin/env node
/**
 * Run a ts-node script in apps/api with root .env loaded (Windows-safe).
 *
 * Usage: node scripts/api-ts-run.mjs <script-path-under-apps/api> [args...]
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { loadRootEnv } from './load-env.mjs'
import { cliSpawnOpts } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = resolve(ROOT, 'apps/api')

loadRootEnv()

const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('Usage: node scripts/api-ts-run.mjs <script.ts> [args...]')
  process.exit(1)
}

const result = spawnSync(
  'npx',
  ['ts-node', '--transpile-only', script, ...args],
  {
    cwd: API_DIR,
    stdio: 'inherit',
    env: process.env,
    ...cliSpawnOpts(),
  },
)

process.exit(result.status ?? 1)
